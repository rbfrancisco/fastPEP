#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readJson(filename) {
    const fullPath = path.join(DATA_DIR, filename);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(raw);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function validate() {
    const errors = [];
    const warnings = [];

    const medications = readJson('medications.json');
    const medicationClasses = readJson('medication-classes.json');
    const physicalExam = readJson('physical-exam.json');
    const conditions = readJson('conditions.json');

    const addons = physicalExam.addons || {};

    const addError = (message) => errors.push(message);
    const addWarning = (message) => warnings.push(message);

    // Medications
    for (const [id, med] of Object.entries(medications)) {
        if (!ID_PATTERN.test(id)) {
            addError(`medications.${id}: invalid ID format`);
        }
        if (!isNonEmptyString(med.name)) {
            addError(`medications.${id}: missing/invalid "name"`);
        }
        if (!isNonEmptyString(med.instruction)) {
            addError(`medications.${id}: missing/invalid "instruction"`);
        }
        if (isNonEmptyString(med.instruction) && med.instruction.includes('{duration}') && !isNonEmptyString(med.defaultDuration)) {
            addError(`medications.${id}: instruction uses {duration} but defaultDuration is missing`);
        }
        if (med.inHospital === true && !isNonEmptyString(med.hospitalNote)) {
            addWarning(`medications.${id}: inHospital=true but hospitalNote is empty`);
        }
    }

    // Medication classes
    for (const [id, cls] of Object.entries(medicationClasses)) {
        if (!ID_PATTERN.test(id)) {
            addError(`medication-classes.${id}: invalid ID format`);
        }
        if (!isNonEmptyString(cls.label)) {
            addError(`medication-classes.${id}: missing/invalid "label"`);
        }
        if (!Array.isArray(cls.options) || cls.options.length === 0) {
            addError(`medication-classes.${id}: "options" must be a non-empty array`);
            continue;
        }

        const seen = new Set();
        for (const medId of cls.options) {
            if (!medications[medId]) {
                addError(`medication-classes.${id}: unknown medication "${medId}"`);
            }
            if (seen.has(medId)) {
                addWarning(`medication-classes.${id}: duplicate option "${medId}"`);
            }
            seen.add(medId);
        }
    }

    // Physical exam addons
    for (const [id, addon] of Object.entries(addons)) {
        if (!ID_PATTERN.test(id)) {
            addError(`physical-exam.addons.${id}: invalid ID format`);
        }
        if (!isNonEmptyString(addon.label)) {
            addError(`physical-exam.addons.${id}: missing/invalid "label"`);
        }

        if (typeof addon.text === 'string') {
            if (!isNonEmptyString(addon.text)) {
                addError(`physical-exam.addons.${id}: empty text`);
            }
        } else if (addon.text && typeof addon.text === 'object') {
            if (!isNonEmptyString(addon.text.masculino) || !isNonEmptyString(addon.text.feminino)) {
                addError(`physical-exam.addons.${id}: gendered text requires non-empty masculino/feminino`);
            }
        } else {
            addError(`physical-exam.addons.${id}: invalid "text" type`);
        }
    }

    // Conditions
    for (const [id, cond] of Object.entries(conditions)) {
        if (!ID_PATTERN.test(id)) {
            addError(`conditions.${id}: invalid ID format`);
        }
        if (!isNonEmptyString(cond.name)) {
            addError(`conditions.${id}: missing/invalid "name"`);
        }

        const addonSeen = new Set();
        for (const addonId of cond.physicalExamAddons || []) {
            if (!addons[addonId]) {
                addError(`conditions.${id}: unknown physical exam addon "${addonId}"`);
            }
            if (addonSeen.has(addonId)) {
                addWarning(`conditions.${id}: duplicate physical exam addon "${addonId}"`);
            }
            addonSeen.add(addonId);
        }

        const groups = cond.prescriptionGroups || [];
        const groupIds = groups.map(group => group.id).filter(Boolean);
        const duplicatedGroupIds = groupIds.filter((groupId, index) => groupIds.indexOf(groupId) !== index);
        for (const groupId of [...new Set(duplicatedGroupIds)]) {
            addError(`conditions.${id}: duplicate prescription group id "${groupId}"`);
        }

        for (const group of groups) {
            if (!isNonEmptyString(group.id)) {
                addError(`conditions.${id}: group with missing/invalid "id"`);
                continue;
            }
            if (!isNonEmptyString(group.label)) {
                addError(`conditions.${id}: group "${group.id}" missing/invalid "label"`);
            }

            if (group.type === 'radio') {
                if (!Array.isArray(group.options) || group.options.length === 0) {
                    addError(`conditions.${id}: radio group "${group.id}" must have non-empty options`);
                    continue;
                }
                for (const medId of group.options) {
                    if (!medications[medId]) {
                        addError(`conditions.${id}: group "${group.id}" unknown medication "${medId}"`);
                    }
                }
                if (!isNonEmptyString(group.default)) {
                    addWarning(`conditions.${id}: group "${group.id}" has empty default; first option will be used`);
                } else if (!group.options.includes(group.default)) {
                    addError(`conditions.${id}: group "${group.id}" default "${group.default}" is not in options`);
                }
            } else {
                if (!Array.isArray(group.items)) {
                    addError(`conditions.${id}: items group "${group.id}" must contain "items" array`);
                    continue;
                }

                group.items.forEach((item, index) => {
                    if (item.type === 'med') {
                        if (!medications[item.medId]) {
                            addError(`conditions.${id}: group "${group.id}" item ${index} unknown medication "${item.medId}"`);
                        }
                    } else if (item.type === 'class') {
                        const medClass = medicationClasses[item.classId];
                        if (!medClass) {
                            addError(`conditions.${id}: group "${group.id}" item ${index} unknown class "${item.classId}"`);
                            return;
                        }

                        if (isNonEmptyString(item.default) && !medClass.options.includes(item.default)) {
                            addError(`conditions.${id}: group "${group.id}" item ${index} default "${item.default}" is not in class "${item.classId}"`);
                        }
                    } else {
                        addError(`conditions.${id}: group "${group.id}" item ${index} has invalid type "${item.type}"`);
                    }
                });
            }
        }
    }

    return { errors, warnings };
}

function main() {
    try {
        const { errors, warnings } = validate();

        if (errors.length === 0 && warnings.length === 0) {
            console.log('Data validation passed with no issues.');
            process.exit(0);
        }

        if (errors.length > 0) {
            console.error(`Data validation found ${errors.length} error(s):`);
            for (const error of errors) {
                console.error(`  - ${error}`);
            }
        }

        if (warnings.length > 0) {
            console.warn(`Data validation found ${warnings.length} warning(s):`);
            for (const warning of warnings) {
                console.warn(`  - ${warning}`);
            }
        }

        process.exit(errors.length > 0 ? 1 : 0);
    } catch (error) {
        console.error('Validation script failed:', error.message);
        process.exit(1);
    }
}

main();
