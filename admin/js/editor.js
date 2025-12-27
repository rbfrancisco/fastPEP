// FastPEP Editor - JSON Generator with Autocomplete

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

document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();
    initTabs();
    initMedicationForm();
    initMedicationClassForm();
    initPhysicalExamForm();
    initConditionForm();
    initCopyButtons();
    initGlobalAutocomplete();
});

// ============ DATA LOADING ============
async function loadAllData() {
    const statusEl = document.createElement('div');
    statusEl.className = 'loading-status';
    statusEl.textContent = 'Carregando dados...';
    document.querySelector('.header').appendChild(statusEl);

    try {
        const [medications, classes, physicalExam, conditions] = await Promise.all([
            fetch('../data/medications.json').then(r => r.json()),
            fetch('../data/medication-classes.json').then(r => r.json()),
            fetch('../data/physical-exam.json').then(r => r.json()),
            fetch('../data/conditions.json').then(r => r.json())
        ]);

        dataStore.medications = medications;
        dataStore.medicationClasses = classes;
        dataStore.physicalExam = physicalExam;
        dataStore.conditions = conditions;
        dataStore.loaded = true;

        buildSuggestions();
        statusEl.textContent = `✓ Dados carregados (${suggestions.medicationIds.length} meds, ${suggestions.classIds.length} classes, ${suggestions.addonIds.length} addons, ${suggestions.conditionIds.length} condições)`;
        statusEl.classList.add('loaded');

        setTimeout(() => statusEl.remove(), 3000);
    } catch (err) {
        console.error('Erro ao carregar dados:', err);
        statusEl.textContent = '⚠ Erro ao carregar dados. Autocomplete indisponível.';
        statusEl.classList.add('error');
    }
}

function buildSuggestions() {
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
            if (addon.male) suggestions.addonTexts.push(addon.male);
            if (addon.female && addon.female !== addon.male) {
                suggestions.addonTexts.push(addon.female);
            }
        }
    }

    // Conditions
    for (const [id, cond] of Object.entries(dataStore.conditions)) {
        suggestions.conditionIds.push(id);

        // Collect conduct texts
        if (cond.conduct) {
            cond.conduct.forEach(text => {
                if (!suggestions.conductTexts.includes(text)) {
                    suggestions.conductTexts.push(text);
                }
            });
        }

        // Collect group IDs and labels
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

// ============ AUTOCOMPLETE SYSTEM ============
let activeAutocomplete = null;

function initGlobalAutocomplete() {
    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
        if (activeAutocomplete && !e.target.closest('.autocomplete-wrapper')) {
            closeAutocomplete();
        }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && activeAutocomplete) {
            closeAutocomplete();
        }
    });
}

function attachAutocomplete(input, suggestionList, options = {}) {
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

            if (text.includes('Preencha') || text.includes('Erro')) {
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

// ============ MEDICATION FORM ============
function initMedicationForm() {
    const form = document.getElementById('medication-form');
    const inHospitalCheckbox = document.getElementById('med-in-hospital');
    const hospitalNoteGroup = document.getElementById('hospital-note-group');

    // Attach autocomplete to instruction field
    const instructionInput = document.getElementById('med-instruction');
    attachAutocomplete(instructionInput, suggestions.medicationInstructions);

    inHospitalCheckbox.addEventListener('change', () => {
        hospitalNoteGroup.classList.toggle('hidden', !inHospitalCheckbox.checked);
    });

    // Auto-generate ID from name
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
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
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

    // Check for duplicate ID
    if (dataStore.medications[id]) {
        document.getElementById('medication-output').textContent = `⚠ Aviso: ID "${id}" já existe! O JSON abaixo irá substituir o existente.\n\n"${id}": ${JSON.stringify({ name, instruction, ...(duration && { defaultDuration: duration }), ...(inHospital && { inHospital: true }), ...(hospitalNote && { hospitalNote }) }, null, 2)}`;
        return;
    }

    const medication = { name, instruction };
    if (duration) medication.defaultDuration = duration;
    if (inHospital) {
        medication.inHospital = true;
        if (hospitalNote) medication.hospitalNote = hospitalNote;
    }

    const output = `"${id}": ${JSON.stringify(medication, null, 2)}`;
    document.getElementById('medication-output').textContent = output;
}

// ============ MEDICATION CLASS FORM ============
function initMedicationClassForm() {
    const form = document.getElementById('medication-class-form');
    const container = document.getElementById('class-options-container');
    const addBtn = document.getElementById('add-class-option');

    // Attach autocomplete to first option
    const firstInput = container.querySelector('.class-option');
    if (firstInput) {
        attachAutocomplete(firstInput, suggestions.medicationIds);
    }

    addBtn.addEventListener('click', () => {
        addDynamicRowWithAutocomplete(container, 'class-option', 'class-option-row', suggestions.medicationIds);
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
    const options = getInputValues('.class-option');

    if (!id || !label || options.length === 0) {
        document.getElementById('class-output').textContent = 'Erro: Preencha todos os campos obrigatórios';
        return;
    }

    // Validate medication IDs exist
    const invalidMeds = options.filter(opt => !dataStore.medications[opt]);
    if (invalidMeds.length > 0) {
        document.getElementById('class-output').textContent = `⚠ Aviso: Os seguintes IDs de medicamento não existem: ${invalidMeds.join(', ')}\n\nCertifique-se de adicionar esses medicamentos primeiro.\n\n"${id}": ${JSON.stringify({ label, options }, null, 2)}`;
        return;
    }

    const classData = { label, options };
    const output = `"${id}": ${JSON.stringify(classData, null, 2)}`;
    document.getElementById('class-output').textContent = output;
}

// ============ PHYSICAL EXAM FORM ============
function initPhysicalExamForm() {
    const form = document.getElementById('physical-exam-form');

    // Attach autocomplete to text fields
    const maleInput = document.getElementById('exam-text-male');
    const femaleInput = document.getElementById('exam-text-female');

    attachAutocomplete(maleInput, suggestions.addonTexts);
    attachAutocomplete(femaleInput, suggestions.addonTexts);

    // Auto-copy male to female if empty
    maleInput.addEventListener('blur', () => {
        if (!femaleInput.value.trim() && maleInput.value.trim()) {
            femaleInput.value = maleInput.value;
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        generatePhysicalExamJSON();
    });
}

function generatePhysicalExamJSON() {
    const id = document.getElementById('exam-id').value.trim();
    const textMale = document.getElementById('exam-text-male').value.trim();
    const textFemale = document.getElementById('exam-text-female').value.trim();

    if (!id || !textMale || !textFemale) {
        document.getElementById('exam-output').textContent = 'Erro: Preencha todos os campos obrigatórios (*)';
        return;
    }

    // Check for duplicate
    if (dataStore.physicalExam.addons && dataStore.physicalExam.addons[id]) {
        document.getElementById('exam-output').textContent = `⚠ Aviso: ID "${id}" já existe em addons!\n\n"${id}": ${JSON.stringify({ male: textMale, female: textFemale }, null, 2)}`;
        return;
    }

    const examData = { male: textMale, female: textFemale };
    const output = `"${id}": ${JSON.stringify(examData, null, 2)}`;
    document.getElementById('exam-output').textContent = output;
}

// ============ CONDITION FORM ============
function initConditionForm() {
    const form = document.getElementById('condition-form');

    // Addons with autocomplete
    const addonsContainer = document.getElementById('cond-addons-container');
    const firstAddonInput = addonsContainer.querySelector('.cond-addon');
    if (firstAddonInput) {
        attachAutocomplete(firstAddonInput, suggestions.addonIds);
    }

    document.getElementById('add-cond-addon').addEventListener('click', () => {
        addDynamicRowWithAutocomplete(addonsContainer, 'cond-addon', 'addon-row', suggestions.addonIds);
    });
    addonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            removeRow(e.target, addonsContainer, 'addon-row');
        }
    });

    // Conduct with autocomplete
    const conductContainer = document.getElementById('cond-conduct-container');
    const firstConductInput = conductContainer.querySelector('.cond-conduct');
    if (firstConductInput) {
        attachAutocomplete(firstConductInput, suggestions.conductTexts);
    }

    document.getElementById('add-cond-conduct').addEventListener('click', () => {
        addDynamicRowWithAutocomplete(conductContainer, 'cond-conduct', 'conduct-row', suggestions.conductTexts);
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
    });

    document.getElementById('add-items-group').addEventListener('click', () => {
        addPrescriptionGroup(groupsContainer, 'items');
    });

    groupsContainer.addEventListener('click', (e) => {
        handleGroupContainerClick(e, groupsContainer);
    });

    // Setup autocomplete for dynamically added inputs in groups
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
            // For default medication in class items, suggest meds from that class
            const classIdInput = target.closest('.item-row').querySelector('.item-class-id');
            const classId = classIdInput?.value;
            const classData = dataStore.medicationClasses[classId];
            const classMeds = classData ? classData.options : suggestions.medicationIds;
            attachAutocomplete(target, classMeds);
            target.dataset.autocompleteAttached = 'true';
        } else if (target.classList.contains('group-default') && !target.dataset.autocompleteAttached) {
            // Suggest from the group's options
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
        row.className = 'group-option-row';
        row.innerHTML = `
            <input type="text" class="group-option" placeholder="ID do medicamento">
            <button type="button" class="btn-remove" title="Remover">×</button>
        `;
        optionsContainer.appendChild(row);
        const input = row.querySelector('input');
        attachAutocomplete(input, suggestions.medicationIds);
        input.focus();
        return;
    }

    if (target.classList.contains('add-med-item')) {
        const itemsContainer = target.closest('.form-group').querySelector('.group-items-container');
        const template = document.getElementById('med-item-template');
        const clone = template.content.cloneNode(true);
        itemsContainer.appendChild(clone);
        return;
    }

    if (target.classList.contains('add-class-item')) {
        const itemsContainer = target.closest('.form-group').querySelector('.group-items-container');
        const template = document.getElementById('class-item-template');
        const clone = template.content.cloneNode(true);
        itemsContainer.appendChild(clone);
        return;
    }
}

function generateConditionJSON() {
    const id = document.getElementById('cond-id').value.trim();
    const name = document.getElementById('cond-name').value.trim();
    const addons = getInputValues('.cond-addon');
    const conduct = getInputValues('.cond-conduct');
    const prescriptionGroups = getPrescriptionGroups();

    if (!id || !name) {
        document.getElementById('condition-output').textContent = 'Erro: Preencha ID e Nome da condição';
        return;
    }

    // Validate addons exist
    const invalidAddons = addons.filter(a => !dataStore.physicalExam.addons || !dataStore.physicalExam.addons[a]);
    let warnings = [];
    if (invalidAddons.length > 0) {
        warnings.push(`Addons não encontrados: ${invalidAddons.join(', ')}`);
    }

    // Check for duplicate
    if (dataStore.conditions[id]) {
        warnings.push(`ID "${id}" já existe e será substituído`);
    }

    const condition = {
        name,
        physicalExamAddons: addons,
        conduct,
        prescriptionGroups
    };

    let output = '';
    if (warnings.length > 0) {
        output = `⚠ Avisos:\n${warnings.map(w => '  • ' + w).join('\n')}\n\n`;
    }
    output += `"${id}": ${JSON.stringify(condition, null, 2)}`;
    document.getElementById('condition-output').textContent = output;
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
function addDynamicRow(container, inputClass, rowClass = 'class-option-row') {
    const row = document.createElement('div');
    row.className = rowClass;
    row.innerHTML = `
        <input type="text" class="${inputClass}" placeholder="">
        <button type="button" class="btn-remove" title="Remover">×</button>
    `;
    container.appendChild(row);
    row.querySelector('input').focus();
}

function addDynamicRowWithAutocomplete(container, inputClass, rowClass, suggestionList) {
    const row = document.createElement('div');
    row.className = rowClass;
    row.innerHTML = `
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
    }
}

function getInputValues(selector) {
    const values = [];
    document.querySelectorAll(selector).forEach(input => {
        const val = input.value.trim();
        if (val) values.push(val);
    });
    return values;
}
