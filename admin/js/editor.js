// FastPEP Editor - JSON Generator with Edit Mode and Reordering

// ============ API CONFIGURATION ============
const API_BASE = '/api';
let serverAvailable = false;

// Check if server is available (for save functionality)
async function checkServerAvailability() {
    try {
        const response = await fetch(`${API_BASE}/data/medications`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        serverAvailable = response.ok;
    } catch {
        serverAvailable = false;
    }
    return serverAvailable;
}

// Save entry to server
async function saveToServer(type, id, data) {
    const response = await fetch(`${API_BASE}/data/${type}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
    }

    return response.json();
}

// Delete entry from server
async function deleteFromServer(type, id) {
    const response = await fetch(`${API_BASE}/data/${type}/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete');
    }

    return response.json();
}

// Update local dataStore after successful save
function updateLocalDataStore(type, id, data) {
    switch (type) {
        case 'medications':
            dataStore.medications[id] = data;
            break;
        case 'medication-classes':
            dataStore.medicationClasses[id] = data;
            break;
        case 'physical-exam':
            if (!dataStore.physicalExam.addons) dataStore.physicalExam.addons = {};
            dataStore.physicalExam.addons[id] = data;
            break;
        case 'conditions':
            dataStore.conditions[id] = data;
            break;
    }
    // Rebuild suggestions with new data
    buildSuggestions();
}


// ============ DATA STORE ============
const dataStore = {
    medications: {},
    medicationClasses: {},
    physicalExam: { addons: {} },
    conditions: {},
    loaded: false
};

// Derived suggestions from loaded data
const suggestions = {
    medicationIds: [],
    medicationNames: [],
    medicationInstructions: [],
    classIds: [],
    classLabels: [],
    addonIds: [],
    addonTexts: [],
    conductTexts: [],
    conditionIds: [],
    groupIds: [],
    groupLabels: []
};

// Current edit mode state
const editState = {
    medication: { mode: 'new', currentId: null },
    class: { mode: 'new', currentId: null },
    exam: { mode: 'new', currentId: null },
    condition: { mode: 'new', currentId: null }
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();
    initTabs();
    initModeSelectors();
    initMedicationForm();
    initMedicationClassForm();
    initPhysicalExamForm();
    initConditionForm();
    initCopyButtons();
    initClearButtons();
    initSaveButtons();
    initDeleteButtons();
    initRefreshButton();
    initGlobalAutocomplete();
    initDragAndDrop();
    attachInitialAutocompletes();

    // Check if server is available and show save/delete buttons
    if (await checkServerAvailability()) {
        document.querySelectorAll('.save-btn, .delete-btn').forEach(btn => {
            btn.classList.remove('hidden');
        });
        console.log('Server disponível - botões de salvar/excluir ativados');
    } else {
        console.log('Server não disponível - use "npm run server" para habilitar salvamento direto');
    }
});

// ============ REFRESH BUTTON ============
function initRefreshButton() {
    const btn = document.getElementById('refresh-data-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
        const originalText = btn.textContent;
        btn.textContent = '↻ Atualizando...';
        btn.disabled = true;

        try {
            await loadAllData();
            btn.textContent = '✓ Atualizado!';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1500);
        } catch (error) {
            console.error('Refresh error:', error);
            btn.textContent = '✗ Erro!';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = false;
            }, 1500);
        }
    });
}

// ============ DATA LOADING ============
async function loadAllData() {
    const statusEl = document.createElement('div');
    statusEl.className = 'loading-status';
    statusEl.textContent = 'Carregando dados...';
    document.querySelector('.header').appendChild(statusEl);

    try {
        const cacheBuster = `?v=${Date.now()}`;
        const [medications, classes, physicalExam, conditions] = await Promise.all([
            fetch('../data/medications.json' + cacheBuster).then(r => r.json()),
            fetch('../data/medication-classes.json' + cacheBuster).then(r => r.json()),
            fetch('../data/physical-exam.json' + cacheBuster).then(r => r.json()),
            fetch('../data/conditions.json' + cacheBuster).then(r => r.json())
        ]);

        dataStore.medications = medications;
        dataStore.medicationClasses = classes;
        dataStore.physicalExam = physicalExam;
        dataStore.conditions = conditions;
        dataStore.loaded = true;

        buildSuggestions();
        populateSelectors();

        statusEl.textContent = `✓ Dados carregados (${suggestions.medicationIds.length} meds, ${suggestions.classIds.length} classes, ${suggestions.addonIds.length} addons, ${suggestions.conditionIds.length} condições)`;
        statusEl.classList.add('loaded');

        setTimeout(() => statusEl.remove(), 3000);
    } catch (err) {
        console.error('Erro ao carregar dados:', err);
        statusEl.textContent = '⚠ Erro ao carregar dados. Modo edição indisponível.';
        statusEl.classList.add('error');
    }
}

function buildSuggestions() {
    // Clear existing suggestions first
    suggestions.medicationIds = [];
    suggestions.medicationNames = [];
    suggestions.medicationInstructions = [];
    suggestions.classIds = [];
    suggestions.classLabels = [];
    suggestions.addonIds = [];
    suggestions.addonTexts = [];
    suggestions.conductTexts = [];
    suggestions.conditionIds = [];
    suggestions.groupIds = [];
    suggestions.groupLabels = [];

    // Medications
    for (const [id, med] of Object.entries(dataStore.medications)) {
        suggestions.medicationIds.push(id);
        suggestions.medicationNames.push(med.name);
        if (med.instruction && !suggestions.medicationInstructions.includes(med.instruction)) {
            suggestions.medicationInstructions.push(med.instruction);
        }
    }

    // Medication Classes
    for (const [id, cls] of Object.entries(dataStore.medicationClasses)) {
        suggestions.classIds.push(id);
        suggestions.classLabels.push(cls.label);
    }

    // Physical Exam Addons
    if (dataStore.physicalExam.addons) {
        for (const [id, addon] of Object.entries(dataStore.physicalExam.addons)) {
            suggestions.addonIds.push(id);
            if (addon.text) suggestions.addonTexts.push(addon.text);
        }
    }

    // Conditions
    for (const [id, cond] of Object.entries(dataStore.conditions)) {
        suggestions.conditionIds.push(id);

        if (cond.conduct) {
            cond.conduct.forEach(text => {
                if (!suggestions.conductTexts.includes(text)) {
                    suggestions.conductTexts.push(text);
                }
            });
        }

        if (cond.prescriptionGroups) {
            cond.prescriptionGroups.forEach(group => {
                if (group.id && !suggestions.groupIds.includes(group.id)) {
                    suggestions.groupIds.push(group.id);
                }
                if (group.label && !suggestions.groupLabels.includes(group.label)) {
                    suggestions.groupLabels.push(group.label);
                }
            });
        }
    }
}

function populateSelectors() {
    // Medications
    const medSelect = document.getElementById('medication-select');
    medSelect.innerHTML = '<option value="">-- Escolha um medicamento --</option>';
    Object.entries(dataStore.medications)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .forEach(([id, med]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${med.name} (${id})`;
            medSelect.appendChild(option);
        });

    // Classes
    const classSelect = document.getElementById('class-select');
    classSelect.innerHTML = '<option value="">-- Escolha uma classe --</option>';
    Object.entries(dataStore.medicationClasses)
        .sort((a, b) => a[1].label.localeCompare(b[1].label))
        .forEach(([id, cls]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${cls.label} (${id})`;
            classSelect.appendChild(option);
        });

    // Addons
    const examSelect = document.getElementById('exam-select');
    examSelect.innerHTML = '<option value="">-- Escolha um addon --</option>';
    if (dataStore.physicalExam.addons) {
        Object.entries(dataStore.physicalExam.addons)
            .sort((a, b) => (a[1].label || a[0]).localeCompare(b[1].label || b[0]))
            .forEach(([id, addon]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `${addon.label || id} (${id})`;
                examSelect.appendChild(option);
            });
    }

    // Conditions
    const condSelect = document.getElementById('condition-select');
    condSelect.innerHTML = '<option value="">-- Escolha uma condição --</option>';
    Object.entries(dataStore.conditions)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .forEach(([id, cond]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = `${cond.name} (${id})`;
            condSelect.appendChild(option);
        });
}

// ============ MODE SELECTORS ============
function initModeSelectors() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = btn.dataset.form;
            const mode = btn.dataset.mode;

            // Update button states
            document.querySelectorAll(`.mode-btn[data-form="${form}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update edit state
            editState[form].mode = mode;

            // Show/hide entry selector
            const selector = document.getElementById(`${form}-entry-selector`);
            if (selector) {
                selector.classList.toggle('hidden', mode === 'new');
            }

            // Update title
            const titleMap = {
                medication: { new: 'Novo Medicamento', edit: 'Editar Medicamento' },
                class: { new: 'Nova Classe de Medicamento', edit: 'Editar Classe de Medicamento' },
                exam: { new: 'Novo Addon de Exame Físico', edit: 'Editar Addon de Exame Físico' },
                condition: { new: 'Nova Condição / Diagnóstico', edit: 'Editar Condição / Diagnóstico' }
            };
            const titleEl = document.getElementById(`${form}-form-title`);
            if (titleEl && titleMap[form]) {
                titleEl.textContent = titleMap[form][mode];
            }

            // Clear form when switching modes
            clearForm(form);
        });
    });

    // Entry selectors
    document.getElementById('medication-select').addEventListener('change', (e) => loadMedication(e.target.value));
    document.getElementById('class-select').addEventListener('change', (e) => loadMedicationClass(e.target.value));
    document.getElementById('exam-select').addEventListener('change', (e) => loadPhysicalExam(e.target.value));
    document.getElementById('condition-select').addEventListener('change', (e) => loadCondition(e.target.value));
}

// ============ CLEAR BUTTONS ============
function initClearButtons() {
    document.querySelectorAll('.btn-clear').forEach(btn => {
        btn.addEventListener('click', () => {
            const form = btn.dataset.form;
            clearForm(form);

            // Reset selector
            const select = document.getElementById(`${form}-select`) ||
                          document.getElementById(`${form === 'medication' ? 'medication' : form}-select`);
            if (select) select.value = '';
        });
    });
}

function clearForm(form) {
    editState[form].currentId = null;

    switch (form) {
        case 'medication':
            document.getElementById('med-id').value = '';
            document.getElementById('med-id').dataset.manualEdit = '';
            document.getElementById('med-name').value = '';
            document.getElementById('med-instruction').value = '';
            document.getElementById('med-duration').value = '';
            document.getElementById('med-in-hospital').checked = false;
            document.getElementById('med-hospital-note').value = '';
            document.getElementById('hospital-note-group').classList.add('hidden');
            document.getElementById('medication-output').textContent = 'Preencha o formulário acima para gerar o JSON';
            break;

        case 'class':
            document.getElementById('class-id').value = '';
            document.getElementById('class-label').value = '';
            const classContainer = document.getElementById('class-options-container');
            classContainer.innerHTML = `
                <div class="class-option-row sortable-item">
                    <span class="drag-handle">⋮⋮</span>
                    <input type="text" class="class-option" placeholder="ID do medicamento (ex: cetoprofeno-100mg)">
                    <button type="button" class="btn-remove" title="Remover">×</button>
                </div>`;
            const classOutput = document.getElementById('class-output');
            classOutput.textContent = 'Preencha o formulário acima para gerar o JSON';
            classOutput.classList.remove('has-errors', 'has-warnings');
            break;

        case 'exam':
            document.getElementById('exam-id').value = '';
            document.getElementById('exam-label').value = '';
            document.getElementById('exam-text').value = '';
            document.getElementById('exam-text-masc').value = '';
            document.getElementById('exam-text-fem').value = '';
            document.getElementById('exam-gendered').checked = false;
            document.getElementById('exam-text-simple').classList.remove('hidden');
            document.getElementById('exam-text-gendered').classList.add('hidden');
            document.getElementById('exam-output').textContent = 'Preencha o formulário acima para gerar o JSON';
            break;

        case 'condition':
            document.getElementById('cond-id').value = '';
            document.getElementById('cond-name').value = '';

            // Default addons: geral-bom, cv-normal, resp-normal
            document.getElementById('cond-addons-container').innerHTML = `
                <div class="addon-row sortable-item">
                    <span class="drag-handle">⋮⋮</span>
                    <input type="text" class="cond-addon" value="geral-bom" placeholder="ID do addon">
                    <button type="button" class="btn-remove" title="Remover">×</button>
                </div>
                <div class="addon-row sortable-item">
                    <span class="drag-handle">⋮⋮</span>
                    <input type="text" class="cond-addon" value="cv-normal" placeholder="ID do addon">
                    <button type="button" class="btn-remove" title="Remover">×</button>
                </div>
                <div class="addon-row sortable-item">
                    <span class="drag-handle">⋮⋮</span>
                    <input type="text" class="cond-addon" value="resp-normal" placeholder="ID do addon">
                    <button type="button" class="btn-remove" title="Remover">×</button>
                </div>`;

            document.getElementById('cond-conduct-container').innerHTML = `
                <div class="conduct-row sortable-item">
                    <span class="drag-handle">⋮⋮</span>
                    <input type="text" class="cond-conduct" placeholder="ex: Explico sobre a condição e esclareço dúvidas">
                    <button type="button" class="btn-remove" title="Remover">×</button>
                </div>`;

            document.getElementById('prescription-groups-container').innerHTML = '';
            const conditionOutput = document.getElementById('condition-output');
            conditionOutput.textContent = 'Preencha o formulário acima para gerar o JSON';
            conditionOutput.classList.remove('has-errors', 'has-warnings');
            break;
    }

    // Re-attach autocomplete to newly created initial inputs
    attachInitialAutocompletes();
}

// ============ LOAD EXISTING DATA ============
function loadMedication(id) {
    if (!id) return;

    const med = dataStore.medications[id];
    if (!med) return;

    editState.medication.currentId = id;

    document.getElementById('med-id').value = id;
    document.getElementById('med-id').dataset.manualEdit = 'true';
    document.getElementById('med-name').value = med.name;
    document.getElementById('med-instruction').value = med.instruction;
    document.getElementById('med-duration').value = med.defaultDuration || '';
    document.getElementById('med-in-hospital').checked = !!med.inHospital;
    document.getElementById('med-hospital-note').value = med.hospitalNote || '';
    document.getElementById('hospital-note-group').classList.toggle('hidden', !med.inHospital);
}

function loadMedicationClass(id) {
    if (!id) return;

    const cls = dataStore.medicationClasses[id];
    if (!cls) return;

    editState.class.currentId = id;

    document.getElementById('class-id').value = id;
    document.getElementById('class-label').value = cls.label;

    const container = document.getElementById('class-options-container');
    container.innerHTML = '';

    cls.options.forEach(optId => {
        const row = document.createElement('div');
        row.className = 'class-option-row sortable-item';
        row.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <input type="text" class="class-option" value="${optId}" placeholder="ID do medicamento">
            <button type="button" class="btn-remove" title="Remover">×</button>
        `;
        container.appendChild(row);
    });

    initDragAndDrop();
}

function loadPhysicalExam(id) {
    if (!id) return;

    const addon = dataStore.physicalExam.addons?.[id];
    if (!addon) return;

    editState.exam.currentId = id;

    document.getElementById('exam-id').value = id;
    document.getElementById('exam-label').value = addon.label || '';

    // Handle gendered vs simple text
    const isGendered = typeof addon.text === 'object';
    document.getElementById('exam-gendered').checked = isGendered;
    document.getElementById('exam-text-simple').classList.toggle('hidden', isGendered);
    document.getElementById('exam-text-gendered').classList.toggle('hidden', !isGendered);

    if (isGendered) {
        document.getElementById('exam-text-masc').value = addon.text.masculino || '';
        document.getElementById('exam-text-fem').value = addon.text.feminino || '';
        document.getElementById('exam-text').value = '';
    } else {
        document.getElementById('exam-text').value = addon.text || '';
        document.getElementById('exam-text-masc').value = '';
        document.getElementById('exam-text-fem').value = '';
    }
}

function loadCondition(id) {
    if (!id) return;

    const cond = dataStore.conditions[id];
    if (!cond) return;

    editState.condition.currentId = id;

    document.getElementById('cond-id').value = id;
    document.getElementById('cond-name').value = cond.name;

    // Load addons
    const addonsContainer = document.getElementById('cond-addons-container');
    addonsContainer.innerHTML = '';
    (cond.physicalExamAddons || []).forEach(addonId => {
        const row = document.createElement('div');
        row.className = 'addon-row sortable-item';
        row.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <input type="text" class="cond-addon" value="${addonId}" placeholder="ID do addon">
            <button type="button" class="btn-remove" title="Remover">×</button>
        `;
        addonsContainer.appendChild(row);
    });
    if (addonsContainer.children.length === 0) {
        addonsContainer.innerHTML = `
            <div class="addon-row sortable-item">
                <span class="drag-handle">⋮⋮</span>
                <input type="text" class="cond-addon" placeholder="ID do addon">
                <button type="button" class="btn-remove" title="Remover">×</button>
            </div>`;
    }

    // Load conduct
    const conductContainer = document.getElementById('cond-conduct-container');
    conductContainer.innerHTML = '';
    (cond.conduct || []).forEach(text => {
        const row = document.createElement('div');
        row.className = 'conduct-row sortable-item';
        row.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <input type="text" class="cond-conduct" value="${escapeHtml(text)}" placeholder="Conduta">
            <button type="button" class="btn-remove" title="Remover">×</button>
        `;
        conductContainer.appendChild(row);
    });
    if (conductContainer.children.length === 0) {
        conductContainer.innerHTML = `
            <div class="conduct-row sortable-item">
                <span class="drag-handle">⋮⋮</span>
                <input type="text" class="cond-conduct" placeholder="Conduta">
                <button type="button" class="btn-remove" title="Remover">×</button>
            </div>`;
    }

    // Load prescription groups
    const groupsContainer = document.getElementById('prescription-groups-container');
    groupsContainer.innerHTML = '';
    (cond.prescriptionGroups || []).forEach(group => {
        if (group.type === 'radio') {
            loadRadioGroup(groupsContainer, group);
        } else {
            loadItemsGroup(groupsContainer, group);
        }
    });

    initDragAndDrop();
}

function loadRadioGroup(container, group) {
    const template = document.getElementById('radio-group-template');
    const clone = template.content.cloneNode(true);
    const groupEl = clone.querySelector('.prescription-group');

    groupEl.querySelector('.group-id').value = group.id || '';
    groupEl.querySelector('.group-label').value = group.label || '';
    groupEl.querySelector('.group-default').value = group.default || '';

    const optionsContainer = groupEl.querySelector('.group-options-container');
    optionsContainer.innerHTML = '';
    (group.options || []).forEach(optId => {
        const row = document.createElement('div');
        row.className = 'group-option-row sortable-item';
        row.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <input type="text" class="group-option" value="${optId}" placeholder="ID do medicamento">
            <button type="button" class="btn-remove" title="Remover">×</button>
        `;
        optionsContainer.appendChild(row);
    });

    container.appendChild(clone);
}

function loadItemsGroup(container, group) {
    const template = document.getElementById('items-group-template');
    const clone = template.content.cloneNode(true);
    const groupEl = clone.querySelector('.prescription-group');

    groupEl.querySelector('.group-id').value = group.id || '';
    groupEl.querySelector('.group-label').value = group.label || '';

    const itemsContainer = groupEl.querySelector('.group-items-container');
    (group.items || []).forEach(item => {
        if (item.type === 'med') {
            const medTemplate = document.getElementById('med-item-template');
            const medClone = medTemplate.content.cloneNode(true);
            const row = medClone.querySelector('.item-row');
            row.querySelector('.item-med-id').value = item.medId || '';
            row.querySelector('.item-checked').checked = item.checked !== false;
            itemsContainer.appendChild(medClone);
        } else if (item.type === 'class') {
            const classTemplate = document.getElementById('class-item-template');
            const classClone = classTemplate.content.cloneNode(true);
            const row = classClone.querySelector('.item-row');
            row.querySelector('.item-class-id').value = item.classId || '';
            row.querySelector('.item-default').value = item.default || '';
            row.querySelector('.item-duration').value = item.duration || '';
            row.querySelector('.item-checked').checked = item.checked !== false;
            itemsContainer.appendChild(classClone);
        }
    });

    container.appendChild(clone);
}

// ============ DRAG AND DROP ============
function initDragAndDrop() {
    document.querySelectorAll('.sortable-container').forEach(container => {
        setupSortable(container);
    });
}

function setupSortable(container) {
    let draggedItem = null;

    container.querySelectorAll('.sortable-item').forEach(item => {
        const handle = item.querySelector('.drag-handle');
        if (!handle) return;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            draggedItem = item;
            item.classList.add('dragging');

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    });

    function onMouseMove(e) {
        if (!draggedItem) return;

        const siblings = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const rect = sibling.getBoundingClientRect();
            return e.clientY < rect.top + rect.height / 2;
        });

        siblings.forEach(s => s.classList.remove('drag-over'));
        if (nextSibling) {
            nextSibling.classList.add('drag-over');
        }
    }

    function onMouseUp(e) {
        if (!draggedItem) return;

        const siblings = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
        const nextSibling = siblings.find(sibling => {
            const rect = sibling.getBoundingClientRect();
            return e.clientY < rect.top + rect.height / 2;
        });

        siblings.forEach(s => s.classList.remove('drag-over'));
        draggedItem.classList.remove('dragging');

        if (nextSibling) {
            container.insertBefore(draggedItem, nextSibling);
        } else {
            container.appendChild(draggedItem);
        }

        draggedItem = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

// ============ AUTOCOMPLETE SYSTEM ============
let activeAutocomplete = null;

function initGlobalAutocomplete() {
    document.addEventListener('click', (e) => {
        if (activeAutocomplete && !e.target.closest('.autocomplete-wrapper')) {
            closeAutocomplete();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeAutocomplete) {
            closeAutocomplete();
        }
    });
}

function attachAutocomplete(input, suggestionList, options = {}) {
    if (input.closest('.autocomplete-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    wrapper.appendChild(dropdown);

    let selectedIndex = -1;
    let filteredItems = [];

    const showDropdown = () => {
        const query = input.value.toLowerCase().trim();
        filteredItems = suggestionList.filter(item =>
            item.toLowerCase().includes(query)
        ).slice(0, 10);

        if (filteredItems.length === 0) {
            dropdown.classList.remove('visible');
            return;
        }

        dropdown.innerHTML = filteredItems.map((item, i) => `
            <div class="autocomplete-item ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
                ${highlightMatch(item, query)}
            </div>
        `).join('');

        dropdown.classList.add('visible');
        activeAutocomplete = { input, dropdown, wrapper };
    };

    const selectItem = (index) => {
        if (filteredItems[index]) {
            input.value = options.valueExtractor
                ? options.valueExtractor(filteredItems[index])
                : filteredItems[index];
            closeAutocomplete();
            input.dispatchEvent(new Event('input', { bubbles: true }));
            if (options.onSelect) options.onSelect(filteredItems[index]);
        }
    };

    input.addEventListener('focus', showDropdown);
    input.addEventListener('input', () => {
        selectedIndex = -1;
        showDropdown();
    });

    input.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('visible')) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
            showDropdown();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            showDropdown();
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            selectItem(selectedIndex);
        } else if (e.key === 'Tab' && filteredItems.length > 0) {
            if (selectedIndex < 0) selectedIndex = 0;
            selectItem(selectedIndex);
        }
    });

    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            selectItem(parseInt(item.dataset.index));
        }
    });

    return { wrapper, dropdown };
}

function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function closeAutocomplete() {
    if (activeAutocomplete) {
        activeAutocomplete.dropdown.classList.remove('visible');
        activeAutocomplete = null;
    }
}

// Attach autocomplete to all initial/existing inputs
function attachInitialAutocompletes() {
    // Medication class options
    document.querySelectorAll('#class-options-container .class-option').forEach(input => {
        if (!input.dataset.autocompleteAttached) {
            attachAutocomplete(input, suggestions.medicationIds);
            input.dataset.autocompleteAttached = 'true';
        }
    });

    // Condition addons
    document.querySelectorAll('#cond-addons-container .cond-addon').forEach(input => {
        if (!input.dataset.autocompleteAttached) {
            attachAutocomplete(input, suggestions.addonIds);
            input.dataset.autocompleteAttached = 'true';
        }
    });

    // Condition conduct
    document.querySelectorAll('#cond-conduct-container .cond-conduct').forEach(input => {
        if (!input.dataset.autocompleteAttached) {
            attachAutocomplete(input, suggestions.conductTexts);
            input.dataset.autocompleteAttached = 'true';
        }
    });
}

// ============ TAB NAVIGATION ============
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
}

// ============ COPY BUTTONS ============
function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.dataset.target;
            const outputEl = document.getElementById(targetId);
            const text = outputEl.textContent;

            if (text.includes('Preencha') || text.includes('Erro:')) {
                return;
            }

            try {
                await navigator.clipboard.writeText(text);
                btn.textContent = 'Copiado!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = 'Copiar';
                    btn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Erro ao copiar:', err);
            }
        });
    });
}

// ============ SAVE BUTTONS ============
function initSaveButtons() {
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const form = btn.dataset.form;
            await handleSave(form, btn);
        });
    });
}

// ============ DELETE BUTTONS ============
function initDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const form = btn.dataset.form;
            await handleDelete(form, btn);
        });
    });
}

async function handleDelete(form, btn) {
    // Map form to editState key
    const stateKey = form === 'medication' ? 'medication' : form;
    const state = editState[stateKey];

    // Check if we're in edit mode with a loaded entry
    if (state.mode !== 'edit' || !state.currentId) {
        alert('Selecione uma entrada existente para excluir');
        return;
    }

    const id = state.currentId;
    const typeName = {
        'medication': 'medicamento',
        'class': 'classe',
        'exam': 'addon de exame físico',
        'condition': 'condição'
    }[form];

    // Confirm deletion
    if (!confirm(`Tem certeza que deseja excluir ${typeName} "${id}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    const originalText = btn.textContent;

    try {
        btn.textContent = 'Excluindo...';
        btn.disabled = true;
        btn.classList.add('deleting');

        // Map form type to API type
        const typeMap = {
            'medication': 'medications',
            'class': 'medication-classes',
            'exam': 'physical-exam',
            'condition': 'conditions'
        };
        const type = typeMap[form];

        // Delete from server
        await deleteFromServer(type, id);

        // Reload all data from server
        await loadAllData();

        // Clear the form
        clearForm(form);

        // Reset selector
        const select = document.getElementById(`${form === 'medication' ? 'medication' : form}-select`);
        if (select) select.value = '';

        // Switch back to "new" mode
        const newModeBtn = document.querySelector(`.mode-btn[data-form="${stateKey}"][data-mode="new"]`);
        if (newModeBtn) newModeBtn.click();

        // Show success
        btn.textContent = 'Excluído!';
        btn.classList.remove('deleting');
        btn.classList.add('deleted');

        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('deleted');
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Delete error:', error);

        btn.textContent = 'Erro!';
        btn.classList.remove('deleting');
        btn.classList.add('delete-error');

        alert(`Erro ao excluir: ${error.message}`);

        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('delete-error');
            btn.disabled = false;
        }, 2000);
    }
}

async function handleSave(form, btn) {
    const originalText = btn.textContent;

    try {
        btn.textContent = 'Salvando...';
        btn.disabled = true;
        btn.classList.add('saving');

        let type, id, data, outputEl;

        switch (form) {
            case 'medication':
                type = 'medications';
                id = document.getElementById('med-id').value.trim();
                data = buildMedicationData();
                outputEl = document.getElementById('medication-output');
                break;
            case 'class':
                type = 'medication-classes';
                id = document.getElementById('class-id').value.trim();
                data = buildMedicationClassData();
                outputEl = document.getElementById('class-output');
                break;
            case 'exam':
                type = 'physical-exam';
                id = document.getElementById('exam-id').value.trim();
                data = buildPhysicalExamData();
                outputEl = document.getElementById('exam-output');
                break;
            case 'condition':
                type = 'conditions';
                id = document.getElementById('cond-id').value.trim();
                data = buildConditionData();
                outputEl = document.getElementById('condition-output');
                break;
            default:
                throw new Error('Unknown form type');
        }

        // Validate ID
        if (!id) {
            throw new Error('ID é obrigatório');
        }

        // Validate data
        if (!data) {
            throw new Error('Dados inválidos - verifique os campos obrigatórios');
        }

        // Check for validation errors in output
        if (outputEl && outputEl.classList.contains('has-errors')) {
            throw new Error('Corrija os erros de validação antes de salvar');
        }

        // Save to server
        await saveToServer(type, id, data);

        // Reload all data from server to sync
        await loadAllData();

        // Clear the form
        clearForm(form);

        // Reset selector if in edit mode
        const select = document.getElementById(`${form === 'medication' ? 'medication' : form}-select`);
        if (select) select.value = '';

        // Show success
        btn.textContent = 'Salvo!';
        btn.classList.remove('saving');
        btn.classList.add('saved');

        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('saved');
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Save error:', error);

        btn.textContent = 'Erro!';
        btn.classList.remove('saving');
        btn.classList.add('save-error');

        alert(`Erro ao salvar: ${error.message}`);

        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('save-error');
            btn.disabled = false;
        }, 2000);
    }
}

// ============ BUILD DATA FUNCTIONS ============
function buildMedicationData() {
    const name = document.getElementById('med-name').value.trim();
    const instruction = document.getElementById('med-instruction').value.trim();
    const duration = document.getElementById('med-duration').value.trim();
    const inHospital = document.getElementById('med-in-hospital').checked;
    const hospitalNote = document.getElementById('med-hospital-note').value.trim();

    if (!name || !instruction) {
        return null;
    }

    const medication = { name, instruction };
    if (duration) medication.defaultDuration = duration;
    if (inHospital) {
        medication.inHospital = true;
        if (hospitalNote) medication.hospitalNote = hospitalNote;
    }

    return medication;
}

function buildMedicationClassData() {
    const label = document.getElementById('class-label').value.trim();
    const options = getInputValuesOrdered('#class-options-container .class-option');

    if (!label || options.length === 0) {
        return null;
    }

    return { label, options };
}

function buildPhysicalExamData() {
    const label = document.getElementById('exam-label').value.trim();
    const isGendered = document.getElementById('exam-gendered').checked;

    if (!label) {
        return null;
    }

    let text;
    if (isGendered) {
        const masc = document.getElementById('exam-text-masc').value.trim();
        const fem = document.getElementById('exam-text-fem').value.trim();
        if (!masc || !fem) {
            return null;
        }
        text = { masculino: masc, feminino: fem };
    } else {
        text = document.getElementById('exam-text').value.trim();
        if (!text) {
            return null;
        }
    }

    return { label, text };
}

function buildConditionData() {
    const name = document.getElementById('cond-name').value.trim();
    const addons = getInputValuesOrdered('#cond-addons-container .cond-addon');
    const conduct = getInputValuesOrdered('#cond-conduct-container .cond-conduct');
    const prescriptionGroups = getPrescriptionGroups();

    if (!name) {
        return null;
    }

    return {
        name,
        physicalExamAddons: addons,
        conduct,
        prescriptionGroups
    };
}

// ============ MEDICATION FORM ============
function initMedicationForm() {
    const form = document.getElementById('medication-form');
    const inHospitalCheckbox = document.getElementById('med-in-hospital');
    const hospitalNoteGroup = document.getElementById('hospital-note-group');

    const instructionInput = document.getElementById('med-instruction');
    attachAutocomplete(instructionInput, suggestions.medicationInstructions);

    inHospitalCheckbox.addEventListener('change', () => {
        hospitalNoteGroup.classList.toggle('hidden', !inHospitalCheckbox.checked);
    });

    const nameInput = document.getElementById('med-name');
    const idInput = document.getElementById('med-id');
    nameInput.addEventListener('input', () => {
        if (!idInput.dataset.manualEdit) {
            idInput.value = generateId(nameInput.value);
        }
    });
    idInput.addEventListener('input', () => {
        idInput.dataset.manualEdit = 'true';
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        generateMedicationJSON();
    });
}

function generateId(name) {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function generateMedicationJSON() {
    const id = document.getElementById('med-id').value.trim();
    const name = document.getElementById('med-name').value.trim();
    const instruction = document.getElementById('med-instruction').value.trim();
    const duration = document.getElementById('med-duration').value.trim();
    const inHospital = document.getElementById('med-in-hospital').checked;
    const hospitalNote = document.getElementById('med-hospital-note').value.trim();

    if (!id || !name || !instruction) {
        document.getElementById('medication-output').textContent = 'Erro: Preencha todos os campos obrigatórios (*)';
        return;
    }

    const medication = { name, instruction };
    if (duration) medication.defaultDuration = duration;
    if (inHospital) {
        medication.inHospital = true;
        if (hospitalNote) medication.hospitalNote = hospitalNote;
    }

    const isEdit = editState.medication.mode === 'edit' && editState.medication.currentId === id;
    const prefix = isEdit ? '// SUBSTITUIR entrada existente:\n' : '';

    const output = `${prefix}"${id}": ${JSON.stringify(medication, null, 2)}`;
    document.getElementById('medication-output').textContent = output;
}

// ============ MEDICATION CLASS FORM ============
function initMedicationClassForm() {
    const form = document.getElementById('medication-class-form');
    const container = document.getElementById('class-options-container');
    const addBtn = document.getElementById('add-class-option');

    addBtn.addEventListener('click', () => {
        addDynamicRowWithAutocomplete(container, 'class-option', 'class-option-row', suggestions.medicationIds, true);
        initDragAndDrop();
    });

    container.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            removeRow(e.target, container, 'class-option-row');
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        generateMedicationClassJSON();
    });
}

function generateMedicationClassJSON() {
    const id = document.getElementById('class-id').value.trim();
    const label = document.getElementById('class-label').value.trim();
    const options = getInputValuesOrdered('#class-options-container .class-option');
    const outputEl = document.getElementById('class-output');

    if (!id || !label || options.length === 0) {
        outputEl.textContent = 'Erro: Preencha todos os campos obrigatórios';
        outputEl.classList.add('has-errors');
        return;
    }

    const classData = { label, options };
    const isEdit = editState.class.mode === 'edit' && editState.class.currentId === id;

    // Validate references
    const { errors, warnings } = validateMedicationClass(id, options);
    const jsonOutput = `"${id}": ${JSON.stringify(classData, null, 2)}`;
    const output = formatValidationOutput(jsonOutput, errors, warnings, isEdit);

    outputEl.textContent = output;
    outputEl.classList.toggle('has-errors', errors.length > 0);
    outputEl.classList.toggle('has-warnings', errors.length === 0 && warnings.length > 0);
}

// ============ PHYSICAL EXAM FORM ============
function initPhysicalExamForm() {
    const form = document.getElementById('physical-exam-form');

    const textInput = document.getElementById('exam-text');
    attachAutocomplete(textInput, suggestions.addonTexts);

    // Gendered checkbox toggle
    const genderedCheckbox = document.getElementById('exam-gendered');
    genderedCheckbox.addEventListener('change', () => {
        document.getElementById('exam-text-simple').classList.toggle('hidden', genderedCheckbox.checked);
        document.getElementById('exam-text-gendered').classList.toggle('hidden', !genderedCheckbox.checked);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        generatePhysicalExamJSON();
    });
}

function generatePhysicalExamJSON() {
    const id = document.getElementById('exam-id').value.trim();
    const label = document.getElementById('exam-label').value.trim();
    const isGendered = document.getElementById('exam-gendered').checked;

    let text;
    if (isGendered) {
        const masc = document.getElementById('exam-text-masc').value.trim();
        const fem = document.getElementById('exam-text-fem').value.trim();
        if (!masc || !fem) {
            document.getElementById('exam-output').textContent = 'Erro: Preencha ambos os textos (masculino e feminino)';
            return;
        }
        text = { masculino: masc, feminino: fem };
    } else {
        text = document.getElementById('exam-text').value.trim();
        if (!text) {
            document.getElementById('exam-output').textContent = 'Erro: Preencha o texto do addon';
            return;
        }
    }

    if (!id || !label) {
        document.getElementById('exam-output').textContent = 'Erro: Preencha todos os campos obrigatórios (*)';
        return;
    }

    const examData = { label, text };

    const isEdit = editState.exam.mode === 'edit' && editState.exam.currentId === id;
    const prefix = isEdit ? '// SUBSTITUIR entrada existente:\n' : '';

    const output = `${prefix}"${id}": ${JSON.stringify(examData, null, 2)}`;
    document.getElementById('exam-output').textContent = output;
}

// ============ CONDITION FORM ============
function initConditionForm() {
    const form = document.getElementById('condition-form');

    // Addons
    const addonsContainer = document.getElementById('cond-addons-container');
    document.getElementById('add-cond-addon').addEventListener('click', () => {
        addDynamicRowWithAutocomplete(addonsContainer, 'cond-addon', 'addon-row', suggestions.addonIds, true);
        initDragAndDrop();
    });
    addonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            removeRow(e.target, addonsContainer, 'addon-row');
        }
    });

    // Conduct
    const conductContainer = document.getElementById('cond-conduct-container');
    document.getElementById('add-cond-conduct').addEventListener('click', () => {
        addDynamicRowWithAutocomplete(conductContainer, 'cond-conduct', 'conduct-row', suggestions.conductTexts, true);
        initDragAndDrop();
    });
    conductContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            removeRow(e.target, conductContainer, 'conduct-row');
        }
    });

    // Prescription Groups
    const groupsContainer = document.getElementById('prescription-groups-container');

    document.getElementById('add-radio-group').addEventListener('click', () => {
        addPrescriptionGroup(groupsContainer, 'radio');
        initDragAndDrop();
    });

    document.getElementById('add-items-group').addEventListener('click', () => {
        addPrescriptionGroup(groupsContainer, 'items');
        initDragAndDrop();
    });

    groupsContainer.addEventListener('click', (e) => {
        handleGroupContainerClick(e, groupsContainer);
    });

    groupsContainer.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target.classList.contains('group-option') && !target.dataset.autocompleteAttached) {
            attachAutocomplete(target, suggestions.medicationIds);
            target.dataset.autocompleteAttached = 'true';
        } else if (target.classList.contains('group-id') && !target.dataset.autocompleteAttached) {
            attachAutocomplete(target, suggestions.groupIds);
            target.dataset.autocompleteAttached = 'true';
        } else if (target.classList.contains('group-label') && !target.dataset.autocompleteAttached) {
            attachAutocomplete(target, suggestions.groupLabels);
            target.dataset.autocompleteAttached = 'true';
        } else if (target.classList.contains('item-med-id') && !target.dataset.autocompleteAttached) {
            attachAutocomplete(target, suggestions.medicationIds);
            target.dataset.autocompleteAttached = 'true';
        } else if (target.classList.contains('item-class-id') && !target.dataset.autocompleteAttached) {
            attachAutocomplete(target, suggestions.classIds);
            target.dataset.autocompleteAttached = 'true';
        } else if (target.classList.contains('item-default') && !target.dataset.autocompleteAttached) {
            const classIdInput = target.closest('.item-row').querySelector('.item-class-id');
            const classId = classIdInput?.value;
            const classData = dataStore.medicationClasses[classId];
            const classMeds = classData ? classData.options : suggestions.medicationIds;
            attachAutocomplete(target, classMeds);
            target.dataset.autocompleteAttached = 'true';
        } else if (target.classList.contains('group-default') && !target.dataset.autocompleteAttached) {
            const groupEl = target.closest('.prescription-group');
            const optionInputs = groupEl.querySelectorAll('.group-option');
            const groupMeds = Array.from(optionInputs).map(i => i.value.trim()).filter(Boolean);
            attachAutocomplete(target, groupMeds.length > 0 ? groupMeds : suggestions.medicationIds);
            target.dataset.autocompleteAttached = 'true';
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        generateConditionJSON();
    });
}

function addPrescriptionGroup(container, type) {
    const templateId = type === 'radio' ? 'radio-group-template' : 'items-group-template';
    const template = document.getElementById(templateId);
    const clone = template.content.cloneNode(true);
    container.appendChild(clone);
}

function handleGroupContainerClick(e, groupsContainer) {
    const target = e.target;

    if (target.classList.contains('btn-remove-group')) {
        const group = target.closest('.prescription-group');
        if (group) group.remove();
        return;
    }

    if (target.classList.contains('btn-remove')) {
        const row = target.closest('.group-option-row, .item-row');
        if (row) row.remove();
        return;
    }

    if (target.classList.contains('add-group-option')) {
        const optionsContainer = target.closest('.form-group').querySelector('.group-options-container');
        const row = document.createElement('div');
        row.className = 'group-option-row sortable-item';
        row.innerHTML = `
            <span class="drag-handle">⋮⋮</span>
            <input type="text" class="group-option" placeholder="ID do medicamento">
            <button type="button" class="btn-remove" title="Remover">×</button>
        `;
        optionsContainer.appendChild(row);
        const input = row.querySelector('input');
        attachAutocomplete(input, suggestions.medicationIds);
        input.focus();
        initDragAndDrop();
        return;
    }

    if (target.classList.contains('add-med-item')) {
        const itemsContainer = target.closest('.form-group').querySelector('.group-items-container');
        const template = document.getElementById('med-item-template');
        const clone = template.content.cloneNode(true);
        itemsContainer.appendChild(clone);
        initDragAndDrop();
        return;
    }

    if (target.classList.contains('add-class-item')) {
        const itemsContainer = target.closest('.form-group').querySelector('.group-items-container');
        const template = document.getElementById('class-item-template');
        const clone = template.content.cloneNode(true);
        itemsContainer.appendChild(clone);
        initDragAndDrop();
        return;
    }
}

function generateConditionJSON() {
    const id = document.getElementById('cond-id').value.trim();
    const name = document.getElementById('cond-name').value.trim();
    const addons = getInputValuesOrdered('#cond-addons-container .cond-addon');
    const conduct = getInputValuesOrdered('#cond-conduct-container .cond-conduct');
    const prescriptionGroups = getPrescriptionGroups();
    const outputEl = document.getElementById('condition-output');

    if (!id || !name) {
        outputEl.textContent = 'Erro: Preencha ID e Nome da condição';
        outputEl.classList.add('has-errors');
        return;
    }

    const condition = {
        name,
        physicalExamAddons: addons,
        conduct,
        prescriptionGroups
    };

    const isEdit = editState.condition.mode === 'edit' && editState.condition.currentId === id;

    // Validate references
    const { errors, warnings } = validateCondition(condition);
    const jsonOutput = `"${id}": ${JSON.stringify(condition, null, 2)}`;
    const output = formatValidationOutput(jsonOutput, errors, warnings, isEdit);

    outputEl.textContent = output;
    outputEl.classList.toggle('has-errors', errors.length > 0);
    outputEl.classList.toggle('has-warnings', errors.length === 0 && warnings.length > 0);
}

function getPrescriptionGroups() {
    const groups = [];
    const groupElements = document.querySelectorAll('#prescription-groups-container .prescription-group');

    groupElements.forEach(groupEl => {
        const isRadio = groupEl.classList.contains('radio-group-item');
        const id = groupEl.querySelector('.group-id').value.trim();
        const label = groupEl.querySelector('.group-label').value.trim();

        if (!id || !label) return;

        if (isRadio) {
            const options = [];
            groupEl.querySelectorAll('.group-option').forEach(input => {
                const val = input.value.trim();
                if (val) options.push(val);
            });
            const defaultVal = groupEl.querySelector('.group-default').value.trim();

            groups.push({
                id,
                label,
                type: 'radio',
                options,
                default: defaultVal || options[0] || ''
            });
        } else {
            const items = [];
            groupEl.querySelectorAll('.item-row').forEach(itemEl => {
                if (itemEl.classList.contains('med-item')) {
                    const medId = itemEl.querySelector('.item-med-id').value.trim();
                    const checked = itemEl.querySelector('.item-checked').checked;
                    if (medId) {
                        items.push({ type: 'med', medId, checked });
                    }
                } else if (itemEl.classList.contains('class-item')) {
                    const classId = itemEl.querySelector('.item-class-id').value.trim();
                    const defaultMed = itemEl.querySelector('.item-default').value.trim();
                    const duration = itemEl.querySelector('.item-duration').value.trim();
                    const checked = itemEl.querySelector('.item-checked').checked;
                    if (classId) {
                        const item = { type: 'class', classId, default: defaultMed, checked };
                        if (duration) item.duration = duration;
                        items.push(item);
                    }
                }
            });

            groups.push({ id, label, items });
        }
    });

    return groups;
}

// ============ UTILITY FUNCTIONS ============
function addDynamicRowWithAutocomplete(container, inputClass, rowClass, suggestionList, withHandle = false) {
    const row = document.createElement('div');
    row.className = `${rowClass} sortable-item`;
    row.innerHTML = `
        ${withHandle ? '<span class="drag-handle">⋮⋮</span>' : ''}
        <input type="text" class="${inputClass}" placeholder="">
        <button type="button" class="btn-remove" title="Remover">×</button>
    `;
    container.appendChild(row);
    const input = row.querySelector('input');
    attachAutocomplete(input, suggestionList);
    input.focus();
}

function removeRow(btn, container, rowClass) {
    const rows = container.querySelectorAll(`.${rowClass}`);
    if (rows.length > 1) {
        btn.closest(`.${rowClass}`).remove();
    } else {
        // Clear the input instead of removing
        const input = btn.closest(`.${rowClass}`).querySelector('input');
        if (input) input.value = '';
    }
}

function getInputValuesOrdered(selector) {
    const values = [];
    document.querySelectorAll(selector).forEach(input => {
        const val = input.value.trim();
        if (val) values.push(val);
    });
    return values;
}

// ============ VALIDATION ============
function validateMedicationClass(classId, options) {
    const errors = [];
    const warnings = [];

    for (const medId of options) {
        if (!dataStore.medications[medId]) {
            errors.push(`Medicamento "${medId}" não existe`);
        }
    }

    return { errors, warnings };
}

function validateCondition(conditionData) {
    const errors = [];
    const warnings = [];

    // Validate addons
    for (const addonId of conditionData.physicalExamAddons || []) {
        if (!dataStore.physicalExam.addons?.[addonId]) {
            errors.push(`Addon de exame físico "${addonId}" não existe`);
        }
    }

    // Validate prescription groups
    for (const group of conditionData.prescriptionGroups || []) {
        if (group.type === 'radio') {
            // Validate radio options
            for (const medId of group.options || []) {
                if (!dataStore.medications[medId]) {
                    errors.push(`Grupo "${group.label}": medicamento "${medId}" não existe`);
                }
            }
            // Validate default
            if (group.default && group.options && !group.options.includes(group.default)) {
                warnings.push(`Grupo "${group.label}": default "${group.default}" não está nas opções`);
            }
            if (group.default && !dataStore.medications[group.default]) {
                errors.push(`Grupo "${group.label}": medicamento default "${group.default}" não existe`);
            }
        } else {
            // Validate items
            for (const item of group.items || []) {
                if (item.type === 'med') {
                    if (!dataStore.medications[item.medId]) {
                        errors.push(`Grupo "${group.label}": medicamento "${item.medId}" não existe`);
                    }
                } else if (item.type === 'class') {
                    if (!dataStore.medicationClasses[item.classId]) {
                        errors.push(`Grupo "${group.label}": classe "${item.classId}" não existe`);
                    } else {
                        // Validate default medication
                        if (item.default) {
                            if (!dataStore.medications[item.default]) {
                                errors.push(`Grupo "${group.label}": medicamento default "${item.default}" não existe`);
                            } else {
                                const classOptions = dataStore.medicationClasses[item.classId].options || [];
                                if (!classOptions.includes(item.default)) {
                                    warnings.push(`Grupo "${group.label}": medicamento "${item.default}" não pertence à classe "${item.classId}"`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return { errors, warnings };
}

function formatValidationOutput(jsonOutput, errors, warnings, isEdit) {
    let output = '';

    if (errors.length > 0) {
        output += '⛔ ERROS (corrija antes de usar):\n';
        errors.forEach(err => output += `  • ${err}\n`);
        output += '\n';
    }

    if (warnings.length > 0) {
        output += '⚠️ AVISOS:\n';
        warnings.forEach(warn => output += `  • ${warn}\n`);
        output += '\n';
    }

    if (errors.length === 0) {
        if (isEdit) {
            output += '// SUBSTITUIR entrada existente:\n';
        }
        output += jsonOutput;
    } else {
        output += '// JSON gerado com erros (não recomendado usar):\n';
        if (isEdit) {
            output += '// SUBSTITUIR entrada existente:\n';
        }
        output += jsonOutput;
    }

    return output;
}
