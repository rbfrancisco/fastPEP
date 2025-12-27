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

    // DOM Elements
    const elements = {
        genderRadios: null,
        searchInput: null,
        dropdown: null,
        physicalExamContent: null,
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
        // Gender selection
        elements.genderRadios.forEach(radio => {
            radio.addEventListener('change', handleGenderChange);
        });

        // Search input
        elements.searchInput.addEventListener('input', handleSearchInput);
        elements.searchInput.addEventListener('focus', handleSearchFocus);
        elements.searchInput.addEventListener('keydown', handleSearchKeydown);

        // Click outside to close dropdown
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                hideDropdown();
            }
        });

        // Copy buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', handleCopy);
        });
    }

    // Handle gender change
    function handleGenderChange(e) {
        currentGender = e.target.value;
        if (currentCondition) {
            renderAll();
        }
    }

    // Handle search input
    function handleSearchInput(e) {
        const query = e.target.value.toLowerCase().trim();

        if (query.length === 0) {
            showAllConditions();
            return;
        }

        const filtered = filterConditions(query);
        renderDropdown(filtered, query);
    }

    // Handle search focus
    function handleSearchFocus() {
        if (elements.searchInput.value.trim() === '') {
            showAllConditions();
        } else {
            handleSearchInput({ target: elements.searchInput });
        }
    }

    // Handle keyboard navigation
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

    // Show all conditions in dropdown
    function showAllConditions() {
        const sorted = getSortedConditions();
        renderDropdown(sorted, '');
    }

    // Get conditions sorted alphabetically
    function getSortedConditions() {
        return Object.entries(conditions)
            .map(([id, data]) => ({ id, name: data.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }

    // Filter conditions by query (fuzzy search - matches any word)
    function filterConditions(query) {
        const queryWords = query.split(/\s+/).filter(w => w.length > 0);

        return getSortedConditions().filter(({ name }) => {
            const nameLower = name.toLowerCase();
            return queryWords.every(word => nameLower.includes(word));
        });
    }

    // Render dropdown
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

    // Highlight matching text
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

    // Escape regex special characters
    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Show/hide dropdown
    function showDropdown() {
        elements.dropdown.classList.remove('hidden');
    }

    function hideDropdown() {
        elements.dropdown.classList.add('hidden');
    }

    // Select a condition
    function selectCondition(conditionId) {
        currentCondition = conditionId;
        const condition = conditions[conditionId];

        elements.searchInput.value = condition.name;
        hideDropdown();

        initializeSelections(condition);
        renderAll();
    }

    // Initialize selections with defaults
    function initializeSelections(condition) {
        currentSelections = {};

        if (!condition.prescriptionGroups) return;

        condition.prescriptionGroups.forEach(group => {
            // Old format: radio type at group level (for antibiotics)
            if (group.type === 'radio') {
                currentSelections[group.id] = {
                    type: 'radio',
                    selected: group.default
                };
            }
            // New format: items array with med and class types
            else if (group.items) {
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
                            selected: item.default
                        };
                    }
                });
            }
        });
    }

    // Render all sections
    function renderAll() {
        renderPhysicalExam();
        renderTreatmentOptions();
        renderConduct();
        renderPrescription();
    }

    // Render physical exam
    function renderPhysicalExam() {
        if (!currentCondition) return;

        const condition = conditions[currentCondition];
        let text = physicalExam.base[currentGender];

        if (condition.physicalExamAddons && condition.physicalExamAddons.length > 0) {
            const addons = condition.physicalExamAddons
                .map(addonId => physicalExam.addons[addonId]?.text)
                .filter(Boolean)
                .join('\n');

            if (addons) {
                text += '\n' + addons;
            }
        }

        elements.physicalExamContent.textContent = text;
    }

    // Render treatment options
    function renderTreatmentOptions() {
        if (!currentCondition) return;

        const condition = conditions[currentCondition];

        // Check if there are any options to show
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

            // Old format: radio type at group level
            if (group.type === 'radio') {
                group.options.forEach(medId => {
                    const med = medications[medId];
                    if (!med) return;

                    const isChecked = currentSelections[group.id]?.selected === medId;
                    const hospitalNote = med.inHospital ? ` <span class="hospital-note">${med.hospitalNote}</span>` : '';

                    html += `
                        <label class="treatment-option">
                            <input type="radio"
                                   name="radio-${group.id}"
                                   value="${medId}"
                                   data-group="${group.id}"
                                   data-type="radio"
                                   ${isChecked ? 'checked' : ''}>
                            <span class="treatment-option-text">${med.name}${hospitalNote}</span>
                        </label>
                    `;
                });
            }
            // New format: items array
            else if (group.items) {
                group.items.forEach((item, index) => {
                    const itemKey = `${group.id}-${index}`;
                    const itemState = currentSelections[group.id]?.items?.[itemKey];

                    if (item.type === 'med') {
                        const med = medications[item.medId];
                        if (!med) return;

                        const isChecked = itemState?.checked;
                        const hospitalNote = med.inHospital ? ` <span class="hospital-note">${med.hospitalNote}</span>` : '';

                        html += `
                            <label class="treatment-option">
                                <input type="checkbox"
                                       data-group="${group.id}"
                                       data-item-key="${itemKey}"
                                       data-type="med"
                                       ${isChecked ? 'checked' : ''}>
                                <span class="treatment-option-text">${med.name}${hospitalNote}</span>
                            </label>
                        `;
                    } else if (item.type === 'class') {
                        const medClass = medicationClasses[item.classId];
                        if (!medClass) return;

                        const isChecked = itemState?.checked;
                        const selectedMed = itemState?.selected;

                        html += `
                            <div class="treatment-class-item">
                                <label class="treatment-option treatment-class-checkbox">
                                    <input type="checkbox"
                                           data-group="${group.id}"
                                           data-item-key="${itemKey}"
                                           data-type="class-toggle"
                                           ${isChecked ? 'checked' : ''}>
                                    <span class="treatment-option-text treatment-class-label">${medClass.label}:</span>
                                </label>
                                <div class="treatment-class-options ${isChecked ? '' : 'disabled'}">
                        `;

                        medClass.options.forEach(medId => {
                            const med = medications[medId];
                            if (!med) return;

                            const isSelected = selectedMed === medId;

                            html += `
                                <label class="treatment-class-radio">
                                    <input type="radio"
                                           name="class-${itemKey}"
                                           value="${medId}"
                                           data-group="${group.id}"
                                           data-item-key="${itemKey}"
                                           data-type="class-select"
                                           ${isSelected ? 'checked' : ''}
                                           ${isChecked ? '' : 'disabled'}>
                                    <span>${med.name}</span>
                                </label>
                            `;
                        });

                        html += `</div></div>`;
                    }
                });
            }

            html += `</div></div>`;
        });

        elements.treatmentOptionsContent.innerHTML = html;

        // Add change handlers
        elements.treatmentOptionsContent.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', handleTreatmentChange);
        });
    }

    // Handle treatment option change
    function handleTreatmentChange(e) {
        const input = e.target;
        const groupId = input.dataset.group;
        const itemKey = input.dataset.itemKey;
        const type = input.dataset.type;

        if (type === 'radio') {
            // Old format: simple radio group
            currentSelections[groupId].selected = input.value;
        } else if (type === 'med') {
            // Med checkbox toggle
            currentSelections[groupId].items[itemKey].checked = input.checked;
        } else if (type === 'class-toggle') {
            // Class checkbox toggle
            currentSelections[groupId].items[itemKey].checked = input.checked;

            // Enable/disable the nested radios
            const classOptions = input.closest('.treatment-class-item').querySelector('.treatment-class-options');
            if (classOptions) {
                classOptions.classList.toggle('disabled', !input.checked);
                classOptions.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.disabled = !input.checked;
                });
            }
        } else if (type === 'class-select') {
            // Class radio selection
            currentSelections[groupId].items[itemKey].selected = input.value;
        }

        renderPrescription();
    }

    // Render conduct
    function renderConduct() {
        if (!currentCondition) return;

        const condition = conditions[currentCondition];
        const text = condition.conduct.map(item => `- ${item}`).join('\n');
        elements.conductContent.textContent = text;
    }

    // Render prescription
    function renderPrescription() {
        if (!currentCondition) return;

        const condition = conditions[currentCondition];
        const selectedMeds = [];

        if (condition.prescriptionGroups) {
            condition.prescriptionGroups.forEach(group => {
                const groupState = currentSelections[group.id];
                if (!groupState) return;

                if (groupState.type === 'radio') {
                    // Old format: simple radio
                    if (groupState.selected) {
                        selectedMeds.push(groupState.selected);
                    }
                } else if (groupState.type === 'items') {
                    // New format: items
                    // Preserve order from original items array
                    group.items.forEach((item, index) => {
                        const itemKey = `${group.id}-${index}`;
                        const itemState = groupState.items[itemKey];

                        if (!itemState || !itemState.checked) return;

                        if (itemState.type === 'med') {
                            selectedMeds.push(itemState.medId);
                        } else if (itemState.type === 'class') {
                            selectedMeds.push(itemState.selected);
                        }
                    });
                }
            });
        }

        // Filter out medications that are given in hospital
        const homeMeds = selectedMeds.filter(medId => {
            const med = medications[medId];
            return med && !med.inHospital;
        });

        if (homeMeds.length === 0) {
            elements.prescriptionContent.innerHTML = '<p class="placeholder-text">Nenhum medicamento para prescrição domiciliar</p>';
            return;
        }

        let html = '';
        homeMeds.forEach((medId, index) => {
            const med = medications[medId];
            if (!med) return;

            html += `<div class="prescription-item"><div><span class="prescription-number">${index + 1}.</span> <span class="prescription-name">${med.name}</span></div><div class="prescription-instruction">${med.instruction}</div></div>`;
        });

        elements.prescriptionContent.innerHTML = html;
    }

    // Handle copy
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

    // Show toast notification
    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.classList.remove('hidden');
        elements.toast.classList.add('show');

        setTimeout(() => {
            elements.toast.classList.remove('show');
            setTimeout(() => elements.toast.classList.add('hidden'), 150);
        }, 1500);
    }

    // Start application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
