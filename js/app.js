// FastPEP - Main Application
(function() {
    'use strict';

    // Data storage
    let conditions = {};
    let physicalExam = {};
    let medications = {};
    let medicationClasses = {};

    // Current state
    let currentGender = 'feminino';
    let currentCondition = null;
    let currentSelections = {};
    let currentSystemSelections = {}; // For physical exam system addons

    // DOM Elements
    const elements = {
        genderRadios: null,
        searchInput: null,
        dropdown: null,
        physicalExamContent: null,
        physicalExamOptionsSection: null,
        physicalExamOptionsContent: null,
        treatmentOptionsSection: null,
        treatmentOptionsContent: null,
        conductContent: null,
        prescriptionContent: null,
        toast: null
    };

    // Initialize application
    async function init() {
        cacheElements();
        await loadData();
        setupEventListeners();
    }

    // Cache DOM elements
    function cacheElements() {
        elements.genderRadios = document.querySelectorAll('input[name="gender"]');
        elements.searchInput = document.getElementById('diagnosis-search');
        elements.dropdown = document.getElementById('diagnosis-dropdown');
        elements.physicalExamContent = document.getElementById('physical-exam-content');
        elements.physicalExamOptionsSection = document.getElementById('physical-exam-options-section');
        elements.physicalExamOptionsContent = document.getElementById('physical-exam-options-content');
        elements.treatmentOptionsSection = document.getElementById('treatment-options-section');
        elements.treatmentOptionsContent = document.getElementById('treatment-options-content');
        elements.conductContent = document.getElementById('conduct-content');
        elements.prescriptionContent = document.getElementById('prescription-content');
        elements.toast = document.getElementById('toast');
    }

    // Load JSON data
    async function loadData() {
        try {
            const [conditionsData, physicalExamData, medicationsData, classesData] = await Promise.all([
                fetch('data/conditions.json').then(r => r.json()),
                fetch('data/physical-exam.json').then(r => r.json()),
                fetch('data/medications.json').then(r => r.json()),
                fetch('data/medication-classes.json').then(r => r.json())
            ]);

            conditions = conditionsData;
            physicalExam = physicalExamData;
            medications = medicationsData;
            medicationClasses = classesData;
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }

    // Setup event listeners
    function setupEventListeners() {
        elements.genderRadios.forEach(radio => {
            radio.addEventListener('change', handleGenderChange);
        });

        elements.searchInput.addEventListener('input', handleSearchInput);
        elements.searchInput.addEventListener('focus', handleSearchFocus);
        elements.searchInput.addEventListener('keydown', handleSearchKeydown);

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                hideDropdown();
            }
        });

        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', handleCopy);
        });
    }

    function handleGenderChange(e) {
        currentGender = e.target.value;
        if (currentCondition) {
            renderAll();
        }
    }

    function handleSearchInput(e) {
        const query = e.target.value.toLowerCase().trim();
        if (query.length === 0) {
            showAllConditions();
            return;
        }
        const filtered = filterConditions(query);
        renderDropdown(filtered, query);
    }

    function handleSearchFocus() {
        // If input has value (diagnosis selected), clear it for new search
        if (elements.searchInput.value.trim() !== '') {
            elements.searchInput.value = '';
        }
        showAllConditions();
    }

    function handleSearchKeydown(e) {
        const items = elements.dropdown.querySelectorAll('.dropdown-item');
        const activeItem = elements.dropdown.querySelector('.dropdown-item.active');
        let activeIndex = Array.from(items).indexOf(activeItem);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (activeIndex < items.length - 1) {
                    if (activeItem) activeItem.classList.remove('active');
                    items[activeIndex + 1].classList.add('active');
                    items[activeIndex + 1].scrollIntoView({ block: 'nearest' });
                } else if (activeIndex === -1 && items.length > 0) {
                    items[0].classList.add('active');
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (activeIndex > 0) {
                    if (activeItem) activeItem.classList.remove('active');
                    items[activeIndex - 1].classList.add('active');
                    items[activeIndex - 1].scrollIntoView({ block: 'nearest' });
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (activeItem) {
                    selectCondition(activeItem.dataset.id);
                }
                break;
            case 'Escape':
                hideDropdown();
                elements.searchInput.blur();
                break;
        }
    }

    function showAllConditions() {
        const sorted = getSortedConditions();
        renderDropdown(sorted, '');
    }

    function getSortedConditions() {
        return Object.entries(conditions)
            .map(([id, data]) => ({ id, name: data.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    function filterConditions(query) {
        const queryWords = query.split(/\s+/).filter(w => w.length > 0);
        return getSortedConditions().filter(({ name }) => {
            const nameLower = name.toLowerCase();
            return queryWords.every(word => nameLower.includes(word));
        });
    }

    function renderDropdown(items, query) {
        if (items.length === 0) {
            elements.dropdown.innerHTML = '<div class="dropdown-item">Nenhum diagnóstico encontrado</div>';
            showDropdown();
            return;
        }

        elements.dropdown.innerHTML = items.map(({ id, name }) => {
            const highlighted = highlightMatches(name, query);
            const selectedClass = currentCondition === id ? 'selected' : '';
            return `<div class="dropdown-item ${selectedClass}" data-id="${id}">${highlighted}</div>`;
        }).join('');

        elements.dropdown.querySelectorAll('.dropdown-item[data-id]').forEach(item => {
            item.addEventListener('click', () => selectCondition(item.dataset.id));
        });

        showDropdown();
    }

    function highlightMatches(text, query) {
        if (!query) return text;
        const words = query.split(/\s+/).filter(w => w.length > 0);
        let result = text;
        words.forEach(word => {
            const regex = new RegExp(`(${escapeRegex(word)})`, 'gi');
            result = result.replace(regex, '<span class="highlight">$1</span>');
        });
        return result;
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function showDropdown() {
        elements.dropdown.classList.remove('hidden');
    }

    function hideDropdown() {
        elements.dropdown.classList.add('hidden');
    }

    function selectCondition(conditionId) {
        currentCondition = conditionId;
        const condition = conditions[conditionId];
        elements.searchInput.value = condition.name;
        hideDropdown();
        initializeSystemSelections();
        initializeSelections(condition);
        renderAll();
    }

    // Initialize physical exam system selections (default: base for all systems)
    function initializeSystemSelections() {
        currentSystemSelections = {};
        if (!physicalExam.systems) return;

        Object.keys(physicalExam.systems).forEach(systemId => {
            const system = physicalExam.systems[systemId];
            if (system.default) {
                currentSystemSelections[systemId] = 'base'; // 'base' means the default base text
            }
        });
    }

    // Initialize selections with defaults (including duration)
    function initializeSelections(condition) {
        currentSelections = {};
        if (!condition.prescriptionGroups) return;

        condition.prescriptionGroups.forEach(group => {
            if (group.type === 'radio') {
                currentSelections[group.id] = {
                    type: 'radio',
                    selected: group.default
                };
            } else if (group.items) {
                currentSelections[group.id] = {
                    type: 'items',
                    items: {}
                };

                group.items.forEach((item, index) => {
                    const itemKey = `${group.id}-${index}`;
                    if (item.type === 'med') {
                        currentSelections[group.id].items[itemKey] = {
                            type: 'med',
                            medId: item.medId,
                            checked: item.checked
                        };
                    } else if (item.type === 'class') {
                        currentSelections[group.id].items[itemKey] = {
                            type: 'class',
                            classId: item.classId,
                            checked: item.checked,
                            selected: item.default,
                            duration: item.duration // Store duration override from condition
                        };
                    }
                });
            }
        });
    }

    function renderAll() {
        renderPhysicalExamOptions();
        renderPhysicalExam();
        renderTreatmentOptions();
        renderConduct();
        renderPrescription();
    }

    // Render physical exam options (system variant selectors)
    function renderPhysicalExamOptions() {
        if (!currentCondition || !physicalExam.systems) {
            elements.physicalExamOptionsSection.classList.add('hidden');
            return;
        }

        // Check if any system has addons
        const hasOptions = Object.values(physicalExam.systems).some(system =>
            system.addons && Object.keys(system.addons).length > 0
        );

        if (!hasOptions) {
            elements.physicalExamOptionsSection.classList.add('hidden');
            return;
        }

        elements.physicalExamOptionsSection.classList.remove('hidden');
        let html = '';

        Object.entries(physicalExam.systems).forEach(([systemId, system]) => {
            if (!system.addons || Object.keys(system.addons).length === 0) return;

            const currentSelection = currentSystemSelections[systemId] || 'base';

            html += `<div class="treatment-group">`;
            html += `<span class="treatment-group-label">${system.label}:</span>`;
            html += `<div class="treatment-options">`;

            // Base option (default normal exam)
            const baseLabel = system.label === 'Estado Geral' ? 'Bom estado geral' : 'Normal';
            html += `<label class="treatment-option">
                <input type="radio" name="system-${systemId}" value="base" data-system="${systemId}" ${currentSelection === 'base' ? 'checked' : ''}>
                <span class="treatment-option-text">${baseLabel}</span>
            </label>`;

            // Addon options (variants)
            Object.entries(system.addons).forEach(([addonId, addon]) => {
                html += `<label class="treatment-option">
                    <input type="radio" name="system-${systemId}" value="${addonId}" data-system="${systemId}" ${currentSelection === addonId ? 'checked' : ''}>
                    <span class="treatment-option-text">${addon.label}</span>
                </label>`;
            });

            html += `</div></div>`;
        });

        elements.physicalExamOptionsContent.innerHTML = html;

        // Add event listeners
        elements.physicalExamOptionsContent.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', handleSystemChange);
        });
    }

    function handleSystemChange(e) {
        const systemId = e.target.dataset.system;
        const value = e.target.value;
        currentSystemSelections[systemId] = value;
        renderPhysicalExam();
    }

    function renderPhysicalExam() {
        if (!currentCondition) return;
        const condition = conditions[currentCondition];
        let textParts = [];

        // Build text from systems
        if (physicalExam.systems) {
            Object.entries(physicalExam.systems).forEach(([systemId, system]) => {
                if (!system.default && !currentSystemSelections[systemId]) return;

                const selection = currentSystemSelections[systemId] || 'base';

                if (selection === 'base') {
                    // Use base text
                    if (typeof system.base === 'object') {
                        textParts.push(system.base[currentGender]);
                    } else {
                        textParts.push(system.base);
                    }
                } else {
                    // Use addon text
                    const addon = system.addons?.[selection];
                    if (addon) {
                        if (typeof addon.base === 'object') {
                            textParts.push(addon.base[currentGender]);
                        } else {
                            textParts.push(addon.base);
                        }
                    }
                }
            });
        } else if (physicalExam.base) {
            // Backward compatibility: old structure with single base
            textParts.push(physicalExam.base[currentGender]);
        }

        // Add condition-specific addons
        if (condition.physicalExamAddons && condition.physicalExamAddons.length > 0) {
            condition.physicalExamAddons.forEach(addonId => {
                const addon = physicalExam.addons?.[addonId];
                if (addon?.text) {
                    textParts.push(addon.text);
                }
            });
        }

        elements.physicalExamContent.textContent = textParts.join('\n');
    }

    // Render treatment options - reordered: simple meds first, then classes
    function renderTreatmentOptions() {
        if (!currentCondition) return;
        const condition = conditions[currentCondition];

        const hasOptions = condition.prescriptionGroups?.some(g =>
            g.type === 'radio' ||
            (g.items && g.items.some(item => item.type === 'class' || g.items.length > 1))
        );

        if (!hasOptions) {
            elements.treatmentOptionsSection.classList.add('hidden');
            return;
        }

        elements.treatmentOptionsSection.classList.remove('hidden');
        let html = '';

        condition.prescriptionGroups.forEach(group => {
            html += `<div class="treatment-group">`;
            html += `<span class="treatment-group-label">${group.label}:</span>`;
            html += `<div class="treatment-options">`;

            if (group.type === 'radio') {
                // Radio group for antibiotics
                group.options.forEach(medId => {
                    const med = medications[medId];
                    if (!med) return;
                    const isChecked = currentSelections[group.id]?.selected === medId;
                    const hospitalNote = med.inHospital ? ` <span class="hospital-note">${med.hospitalNote}</span>` : '';
                    html += `<label class="treatment-option"><input type="radio" name="radio-${group.id}" value="${medId}" data-group="${group.id}" data-type="radio" ${isChecked ? 'checked' : ''}><span class="treatment-option-text">${med.name}${hospitalNote}</span></label>`;
                });
            } else if (group.items) {
                // Separate items into meds and classes
                const medItems = [];
                const classItems = [];

                group.items.forEach((item, index) => {
                    const itemKey = `${group.id}-${index}`;
                    if (item.type === 'med') {
                        medItems.push({ item, index, itemKey });
                    } else if (item.type === 'class') {
                        classItems.push({ item, index, itemKey });
                    }
                });

                // Render simple med checkboxes first
                medItems.forEach(({ item, itemKey }) => {
                    const med = medications[item.medId];
                    if (!med) return;
                    const itemState = currentSelections[group.id]?.items?.[itemKey];
                    const isChecked = itemState?.checked;
                    const hospitalNote = med.inHospital ? ` <span class="hospital-note">${med.hospitalNote}</span>` : '';
                    html += `<label class="treatment-option"><input type="checkbox" data-group="${group.id}" data-item-key="${itemKey}" data-type="med" ${isChecked ? 'checked' : ''}><span class="treatment-option-text">${med.name}${hospitalNote}</span></label>`;
                });

                // Render class items (checkbox + radios) after
                classItems.forEach(({ item, itemKey }) => {
                    const medClass = medicationClasses[item.classId];
                    if (!medClass) return;
                    const itemState = currentSelections[group.id]?.items?.[itemKey];
                    const isChecked = itemState?.checked;
                    const selectedMed = itemState?.selected;

                    html += `<div class="treatment-class-item"><label class="treatment-option treatment-class-checkbox"><input type="checkbox" data-group="${group.id}" data-item-key="${itemKey}" data-type="class-toggle" ${isChecked ? 'checked' : ''}><span class="treatment-option-text treatment-class-label">${medClass.label}:</span></label><div class="treatment-class-options ${isChecked ? '' : 'disabled'}">`;

                    medClass.options.forEach(medId => {
                        const med = medications[medId];
                        if (!med) return;
                        const isSelected = selectedMed === medId;
                        html += `<label class="treatment-class-radio"><input type="radio" name="class-${itemKey}" value="${medId}" data-group="${group.id}" data-item-key="${itemKey}" data-type="class-select" ${isSelected ? 'checked' : ''} ${isChecked ? '' : 'disabled'}><span>${med.name}</span></label>`;
                    });

                    html += `</div></div>`;
                });
            }

            html += `</div></div>`;
        });

        elements.treatmentOptionsContent.innerHTML = html;

        elements.treatmentOptionsContent.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', handleTreatmentChange);
        });
    }

    function handleTreatmentChange(e) {
        const input = e.target;
        const groupId = input.dataset.group;
        const itemKey = input.dataset.itemKey;
        const type = input.dataset.type;

        if (type === 'radio') {
            currentSelections[groupId].selected = input.value;
        } else if (type === 'med') {
            currentSelections[groupId].items[itemKey].checked = input.checked;
        } else if (type === 'class-toggle') {
            currentSelections[groupId].items[itemKey].checked = input.checked;
            const classOptions = input.closest('.treatment-class-item').querySelector('.treatment-class-options');
            if (classOptions) {
                classOptions.classList.toggle('disabled', !input.checked);
                classOptions.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.disabled = !input.checked;
                });
            }
        } else if (type === 'class-select') {
            currentSelections[groupId].items[itemKey].selected = input.value;
        }

        renderPrescription();
    }

    function renderConduct() {
        if (!currentCondition) return;
        const condition = conditions[currentCondition];
        const text = condition.conduct.map(item => `- ${item}`).join('\n');
        elements.conductContent.textContent = text;
    }

    // Get instruction with duration placeholder replaced
    function getInstructionWithDuration(med, duration) {
        if (!med.instruction.includes('{duration}')) {
            return med.instruction;
        }
        const actualDuration = duration || med.defaultDuration || '3';
        return med.instruction.replace('{duration}', actualDuration);
    }

    // Render prescription with duration support
    function renderPrescription() {
        if (!currentCondition) return;
        const condition = conditions[currentCondition];
        const selectedMeds = []; // { medId, duration }

        if (condition.prescriptionGroups) {
            condition.prescriptionGroups.forEach(group => {
                const groupState = currentSelections[group.id];
                if (!groupState) return;

                if (groupState.type === 'radio') {
                    if (groupState.selected) {
                        selectedMeds.push({ medId: groupState.selected, duration: null });
                    }
                } else if (groupState.type === 'items') {
                    // Preserve original order from JSON (important for patient adherence)
                    group.items.forEach((item, index) => {
                        const itemKey = `${group.id}-${index}`;
                        const itemState = groupState.items[itemKey];
                        if (!itemState || !itemState.checked) return;

                        if (itemState.type === 'med') {
                            selectedMeds.push({ medId: itemState.medId, duration: null });
                        } else if (itemState.type === 'class') {
                            selectedMeds.push({ medId: itemState.selected, duration: itemState.duration });
                        }
                    });
                }
            });
        }

        // Filter out medications that are given in hospital
        const homeMeds = selectedMeds.filter(({ medId }) => {
            const med = medications[medId];
            return med && !med.inHospital;
        });

        if (homeMeds.length === 0) {
            elements.prescriptionContent.innerHTML = '<p class="placeholder-text">Nenhum medicamento para prescrição domiciliar</p>';
            return;
        }

        let html = '';
        homeMeds.forEach(({ medId, duration }, index) => {
            const med = medications[medId];
            if (!med) return;
            const instruction = getInstructionWithDuration(med, duration);
            html += `<div class="prescription-item"><div><span class="prescription-number">${index + 1}.</span> <span class="prescription-name">${med.name}</span></div><div class="prescription-instruction">${instruction}</div></div>`;
        });

        elements.prescriptionContent.innerHTML = html;
    }

    function handleCopy(e) {
        const btn = e.currentTarget;
        const targetId = btn.dataset.target;
        const targetElement = document.getElementById(targetId);
        if (!targetElement) return;

        let text = '';
        if (targetId === 'prescription-content') {
            const items = targetElement.querySelectorAll('.prescription-item');
            const lines = [];
            items.forEach((item, index) => {
                const name = item.querySelector('.prescription-name')?.textContent || '';
                const instruction = item.querySelector('.prescription-instruction')?.textContent || '';
                lines.push(`${index + 1}. ${name}`);
                lines.push(instruction);
                lines.push('');
            });
            text = lines.join('\n').trim();
        } else {
            text = targetElement.textContent;
        }

        navigator.clipboard.writeText(text).then(() => {
            showToast('Copiado!');
            btn.classList.add('copied');
            const originalText = btn.querySelector('.copy-text');
            if (originalText) {
                const original = originalText.textContent;
                originalText.textContent = 'Copiado!';
                setTimeout(() => {
                    originalText.textContent = original;
                    btn.classList.remove('copied');
                }, 1500);
            } else {
                setTimeout(() => btn.classList.remove('copied'), 1500);
            }
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            showToast('Erro ao copiar');
        });
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.remove('hidden');
        elements.toast.classList.add('show');
        setTimeout(() => {
            elements.toast.classList.remove('show');
            setTimeout(() => elements.toast.classList.add('hidden'), 150);
        }, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
