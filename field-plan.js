/* Crop-year plans are append-only batches in the existing settings store. */
(() => {
  const prefix = 'field-plan-v1:';
  const types = {
    herbicide: 'Herbicide program',
    prepay: 'Chemical prepay',
    fall: 'Fall herbicide',
    strip: 'Strip-till fertilizer',
    broadcast: 'Broadcast fertilizer'
  };
  const states = { planned: 'Planned', needed: 'Still needed', reported: 'Farmer-reported complete' };
  const node = (tag, label) => {
    const element = document.createElement(tag);
    if (label !== undefined) element.textContent = label;
    return element;
  };
  const option = (value, label) => Object.assign(node('option', label), { value });

  const panel = node('details');
  panel.id = 'cropYearFieldPlan';
  panel.className = 'panel';
  panel.innerHTML = `<summary>Crop-year Chemical &amp; Fertilizer Field Plan</summary>
    <p id="fpYear"></p>
    <label>Farmer <select id="fpFarmer"></select></label>
    <label>Crop <select id="fpCrop"></select></label>
    <form id="fpForm">
      <fieldset><legend>Fields to update</legend>
        <button type="button" id="fpSelectAll">Select all shown</button>
        <div id="fpFields"></div>
      </fieldset>
      <label>Plan or operation <select id="fpType"></select></label>
      <label>Status <select id="fpState"></select></label>
      <label id="fpWorkLabel" hidden>Reported work date (optional) <input id="fpWork" type="date"></label>
      <label>Plan or report details <textarea id="fpText" required maxlength="2000" rows="3"></textarea></label>
      <label id="fpRecipeLabel" hidden>Spray recipe (optional) <select id="fpRecipe"></select></label>
      <button type="submit" id="fpSave">Save to selected fields</button>
    </form>
    <p id="fpStatus" role="status"></p>`;
  const review = $('yearReviewFields').closest('details') || $('yearReviewFields').parentElement;
  review.after(panel);

  const farmer = $('fpFarmer'), crop = $('fpCrop'), type = $('fpType'), state = $('fpState');
  const work = $('fpWork'), note = $('fpText'), recipe = $('fpRecipe'), save = $('fpSave');
  let lastYear, tickets = 0, savingBatch = false, displayedHeads = new Map();
  type.replaceChildren(...Object.entries(types).map(([key, label]) => option(key, label)));

  function replaceOptions(select, options) {
    const previous = select.value;
    select.replaceChildren(...options);
    if (options.some(item => item.value === previous)) select.value = previous;
  }

  function stateOptions() {
    const isWork = ['fall', 'strip', 'broadcast'].includes(type.value);
    const options = Object.entries(states).filter(([key]) => isWork || key === 'planned');
    replaceOptions(state, options.map(([key, label]) => option(key, label)));
    $('fpWorkLabel').hidden = state.value !== 'reported';
    work.disabled = $('fpWorkLabel').hidden;
    $('fpRecipeLabel').hidden = !['herbicide', 'fall'].includes(type.value);
    recipe.disabled = $('fpRecipeLabel').hidden;
  }

  function matchingFields() {
    return yearFields().filter(field => field[4] === farmer.value && (!crop.value || crop.value === field[3]));
  }

  function historyFor(entries, id, category) {
    return entries.filter(entry => entry.type === category && entry.targets?.some(target => target.fieldId === id));
  }

  function headsFor(history, id) {
    const superseded = new Set(history.flatMap(entry => entry.targets.find(target => target.fieldId === id).previous || []));
    return history.filter(entry => !superseded.has(entry.id));
  }

  function describe(entry) {
    const status = states[entry.state] || entry.state;
    return status + ' · ' + entry.text + (entry.recipe ? ' · Recipe: ' + entry.recipe.name : '') +
      (entry.workDate ? ' · Work date: ' + entry.workDate : '') + ' · Entered ' + new Date(entry.createdAt).toLocaleString();
  }

  function fieldRow(field, entries, selected) {
    const [id, name, , fieldCrop] = field;
    const row = node('div');
    row.className = 'fp-row';
    const label = node('label');
    const checkbox = Object.assign(node('input'), { type: 'checkbox', value: id, checked: selected.has(id) });
    checkbox.disabled = !fieldYearConfirmed(id);
    label.append(checkbox, document.createTextNode(' ' + id + ' — ' + name + ' · ' + fieldCrop));
    row.append(label);
    const currentStatuses = [];
    const details = node('details');
    details.append(node('summary', 'Plan and history'));
    for (const [category, title] of Object.entries(types)) {
      const history = historyFor(entries, id, category);
      const heads = headsFor(history, id);
      displayedHeads.set(id + ':' + category, heads.map(entry => entry.id));
      if (!history.length) continue;
      currentStatuses.push(title + ' · ' + (heads.length > 1 ? 'Review overlapping updates' : states[heads[0]?.state] || 'Review history'));
      details.append(node('h4', title));
      if (heads.length > 1) details.append(node('p', 'Overlapping updates. Review each entry and save a correction to set the current plan.'));
      const list = node('ul');
      for (const entry of history) {
        const original = entry.targets.find(target => target.fieldId === id).previous.length === 0;
        const marker = original ? 'Initial entry · ' : '';
        const current = heads.includes(entry) ? (heads.length > 1 ? 'Needs review · ' : 'Current · ') : '';
        list.append(node('li', current + marker + describe(entry)));
      }
      details.append(list);
    }
    if (details.children.length === 1) details.append(node('p', 'No plan entries for this crop year.'));
    row.append(details);
    for (const status of currentStatuses) row.append(node('small', status));
    return row;
  }

  async function render() {
    if (!panel.open || !ready) return;
    const ticket = ++tickets;
    const year = cropYear;
    const previousScope = lastYear === year;
    const selected = new Set(previousScope ? [...panel.querySelectorAll('input[type=checkbox]:checked')].map(input => input.value) : []);
    save.disabled = true;
    try {
      const [settings, recipes] = await Promise.all([getAll('settings'), getSetting('spray-recipes-v1')]);
      if (ticket !== tickets || year !== cropYear) return;
      $('fpYear').textContent = 'Target crop year ' + year + ' · Confirm crop and acres before planning a field.';
      const available = yearFields();
      const farmers = [...new Set(available.map(field => field[4]))];
      replaceOptions(farmer, farmers.map(id => option(id, farmerNames[id] || id)));
      const crops = [...new Set(available.filter(field => field[4] === farmer.value).map(field => field[3]))].sort();
      replaceOptions(crop, [option('', 'All crops'), ...crops.map(name => option(name, name))]);
      const entries = settings.filter(item => item.key.startsWith(prefix) && item.value?.year === year)
        .map(item => item.value).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
      const candidates = matchingFields();
      replaceOptions(recipe, [option('', 'Choose recipe'), ...(recipes || []).filter(item => candidates.some(field => !item.crop || item.crop === field[3])).map(item => option(item.id, item.name))]);
      displayedHeads = new Map();
      $('fpFields').replaceChildren(...candidates.map(field => fieldRow(field, entries, selected)));
      if (!candidates.length) $('fpFields').textContent = 'No fields match these filters.';
      lastYear = year;
      stateOptions();
    } catch {
      $('fpStatus').textContent = 'Could not read field plans. Reopen the panel to retry.';
      lastYear = null;
    } finally {
      if (ticket === tickets) save.disabled = savingBatch || lastYear !== cropYear;
    }
  }

  panel.addEventListener('toggle', () => { void render(); });
  farmer.onchange = crop.onchange = () => { void render(); };
  type.onchange = state.onchange = stateOptions;
  $('fpSelectAll').onclick = () => {
    for (const input of panel.querySelectorAll('input[type=checkbox]:enabled')) input.checked = true;
  };
  window.addEventListener('fieldscout:field-context', () => { void render(); });
  $('fpForm').onsubmit = async event => {
    event.preventDefault();
    if (savingBatch || save.disabled || lastYear !== cropYear) return;
    const year = cropYear;
    const selected = [...panel.querySelectorAll('input[type=checkbox]:checked')].map(input => input.value);
    const targets = matchingFields().filter(field => selected.includes(field[0]) && fieldYearConfirmed(field[0]))
      .map(([fieldId, name, acres, fieldCrop, operator]) => ({
        fieldId, name, acres, crop: fieldCrop, operator,
        previous: displayedHeads.get(fieldId + ':' + type.value) || []
      }));
    const text = note.value.trim(), recipeId = recipe.disabled ? '' : recipe.value;
    if (!targets.length || !text) {
      $('fpStatus').textContent = 'Select at least one confirmed field and enter plan or report details.';
      return;
    }
    const entry = {
      id: crypto.randomUUID(), year, targets, text, type: type.value, state: state.value,
      createdAt: new Date().toISOString(), workDate: work.disabled ? '' : work.value
    };
    if (!confirm('Save this ' + year + ' update to ' + targets.length + ' field(s)?')) return;
    savingBatch = true;
    save.disabled = true;
    try {
      if (recipeId) {
        const savedRecipe = (await getSetting('spray-recipes-v1') || []).find(item => item.id === recipeId);
        if (!savedRecipe || targets.some(target => savedRecipe.crop && savedRecipe.crop !== target.crop)) {
          throw Error('Choose a recipe that applies to all selected fields.');
        }
        entry.recipe = { id: savedRecipe.id, name: savedRecipe.name };
      }
      await transaction(['settings'], 'readwrite', tx => {
        tx.objectStore('settings').add({ key: prefix + entry.id, value: entry });
      });
      if (note.value.trim() === text) note.value = '';
      $('fpStatus').textContent = 'Saved on this device for ' + targets.length + ' field(s) in ' + year + '.';
      await render();
    } catch (error) {
      $('fpStatus').textContent = 'Could not save: ' + error.message;
    } finally {
      savingBatch = false;
      save.disabled = lastYear !== cropYear;
    }
  };
  stateOptions();
})();
