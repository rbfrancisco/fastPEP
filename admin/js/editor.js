// FastPEP Editor - JSON Generator

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initMedicationForm();
    initMedicationClassForm();
    initPhysicalExamForm();
    initConditionForm();
    initCopyButtons();
});

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

    inHospitalCheckbox.addEventListener('change', () => {
        hospitalNoteGroup.classList.toggle('hidden', !inHospitalCheckbox.checked);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        generateMedicationJSON();
    });
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

    const medication = {
        name,
        instruction
    };

    if (duration) {
        medication.defaultDuration = duration;
    }

    if (inHospital) {
        medication.inHospital = true;
        if (hospitalNote) {
            medication.hospitalNote = hospitalNote;
        }
    }

    const output = `"${id}": ${JSON.stringify(medication, null, 2)}`;
    document.getElementById('medication-output').textContent = output;
}

// ============ MEDICATION CLASS FORM ============
function initMedicationClassForm() {
    const form = document.getElementById('medication-class-form');
    const container = document.getElementById('class-options-container');
    const addBtn = document.getElementById('add-class-option');

    addBtn.addEventListener('click', () => {
        addDynamicRow(container, 'class-option');
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

    const classData = {
        label,
        options
    };

    const output = `"${id}": ${JSON.stringify(classData, null, 2)}`;
    document.getElementById('class-output').textContent = output;
}

// ============ PHYSICAL EXAM FORM ============
function initPhysicalExamForm() {
    const form = document.getElementById('physical-exam-form');

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

    const examData = {
        male: textMale,
        female: textFemale
    };

    const output = `"${id}": ${JSON.stringify(examData, null, 2)}`;
    document.getElementById('exam-output').textContent = output;
}

// ============ CONDITION FORM ============
function initConditionForm() {
    const form = document.getElementById('condition-form');

    // Addons
    const addonsContainer = document.getElementById('cond-addons-container');
    document.getElementById('add-cond-addon').addEventListener('click', () => {
        addDynamicRow(addonsContainer, 'cond-addon', 'addon-row');
    });
    addonsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove')) {
            removeRow(e.target, addonsContainer, 'addon-row');
        }
    });

    // Conduct
    const conductContainer = document.getElementById('cond-conduct-container');
    document.getElementById('add-cond-conduct').addEventListener('click', () => {
        addDynamicRow(conductContainer, 'cond-conduct', 'conduct-row');
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

    // Remove group
    if (target.classList.contains('btn-remove-group')) {
        const group = target.closest('.prescription-group');
        if (group) group.remove();
        return;
    }

    // Remove option or item
    if (target.classList.contains('btn-remove')) {
        const row = target.closest('.group-option-row, .item-row');
        if (row) row.remove();
        return;
    }

    // Add radio group option
    if (target.classList.contains('add-group-option')) {
        const optionsContainer = target.closest('.form-group').querySelector('.group-options-container');
        const row = document.createElement('div');
        row.className = 'group-option-row';
        row.innerHTML = `
            <input type="text" class="group-option" placeholder="ID do medicamento">
            <button type="button" class="btn-remove" title="Remover">×</button>
        `;
        optionsContainer.appendChild(row);
        return;
    }

    // Add medication item
    if (target.classList.contains('add-med-item')) {
        const itemsContainer = target.closest('.form-group').querySelector('.group-items-container');
        const template = document.getElementById('med-item-template');
        const clone = template.content.cloneNode(true);
        itemsContainer.appendChild(clone);
        return;
    }

    // Add class item
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

    const condition = {
        name,
        physicalExamAddons: addons,
        conduct,
        prescriptionGroups
    };

    const output = `"${id}": ${JSON.stringify(condition, null, 2)}`;
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
