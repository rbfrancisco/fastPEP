#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const {
    SOURCE_DIR,
    TYPE_CONFIG,
    ID_PATTERN,
    buildCompiledPayload,
    readCompiledFile
} = require('./lib/data-pipeline');
const { validateAgainstSchema } = require('./lib/simple-schema-validator');

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

async function loadSchema(filename) {
    const schemaPath = path.join(__dirname, '..', 'schemas', filename);
    const content = await fs.readFile(schemaPath, 'utf-8');
    return JSON.parse(content);
}

async function validateSourceLayout(errors) {
    for (const [type, config] of Object.entries(TYPE_CONFIG)) {
        const typeDir = path.join(SOURCE_DIR, config.sourceDir);
        await fs.mkdir(typeDir, { recursive: true });
        const files = await fs.readdir(typeDir);

        for (const file of files) {
            if (!file.endsWith('.json')) {
                errors.push(`data-src/${config.sourceDir}/${file}: only .json files are allowed`);
                continue;
            }
            const id = file.slice(0, -5);
            if (!ID_PATTERN.test(id)) {
                errors.push(`data-src/${config.sourceDir}/${file}: invalid ID format`);
            }
        }

        if (files.filter(name => name.endsWith('.json')).length === 0) {
            errors.push(`data-src/${config.sourceDir}: folder is empty`);
        }

        if (!type) {
            errors.push('Invalid type configuration');
        }
    }
}

function validateSchemaCompliance(payload, schemas, errors) {
    const entityChecks = [
        {
            label: 'medications',
            entries: payload.medications,
            schema: schemas.medication
        },
        {
            label: 'medication-classes',
            entries: payload.medicationClasses,
            schema: schemas.medicationClass
        },
        {
            label: 'physical-exam',
            entries: payload.physicalExam.addons,
            schema: schemas.physicalExamAddon
        },
        {
            label: 'conditions',
            entries: payload.conditions,
            schema: schemas.condition
        }
    ];

    for (const check of entityChecks) {
        for (const [id, entry] of Object.entries(check.entries)) {
            const schemaErrors = validateAgainstSchema(entry, check.schema, `${check.label}.${id}`);
            errors.push(...schemaErrors);
        }
    }
}

function validateCrossReferences(payload, errors, warnings) {
    const medications = payload.medications;
    const medicationClasses = payload.medicationClasses;
    const physicalExamAddons = payload.physicalExam.addons || {};
    const conditions = payload.conditions;

    for (const [id, med] of Object.entries(medications)) {
        if (isNonEmptyString(med.instruction) && med.instruction.includes('{duration}') && !isNonEmptyString(med.defaultDuration)) {
            errors.push(`medications.${id}: instruction uses {duration} but defaultDuration is missing`);
        }
        if (med.inHospital === true && !isNonEmptyString(med.hospitalNote)) {
            warnings.push(`medications.${id}: inHospital=true but hospitalNote is empty`);
        }
    }

    for (const [id, medClass] of Object.entries(medicationClasses)) {
        const seen = new Set();
        for (const medId of medClass.options || []) {
            if (!medications[medId]) {
                errors.push(`medication-classes.${id}: unknown medication "${medId}"`);
            }
            if (seen.has(medId)) {
                warnings.push(`medication-classes.${id}: duplicate option "${medId}"`);
            }
            seen.add(medId);
        }
    }

    for (const [id, cond] of Object.entries(conditions)) {
        const addonSeen = new Set();
        for (const addonId of cond.physicalExamAddons || []) {
            if (!physicalExamAddons[addonId]) {
                errors.push(`conditions.${id}: unknown physical exam addon "${addonId}"`);
            }
            if (addonSeen.has(addonId)) {
                warnings.push(`conditions.${id}: duplicate physical exam addon "${addonId}"`);
            }
            addonSeen.add(addonId);
        }

        const groups = cond.prescriptionGroups || [];
        const groupIds = groups.map(group => group.id).filter(Boolean);
        const duplicatedGroupIds = groupIds.filter((groupId, index) => groupIds.indexOf(groupId) !== index);
        for (const groupId of [...new Set(duplicatedGroupIds)]) {
            errors.push(`conditions.${id}: duplicate prescription group id "${groupId}"`);
        }

        for (const group of groups) {
            if (group.type === 'radio') {
                for (const medId of group.options || []) {
                    if (!medications[medId]) {
                        errors.push(`conditions.${id}: group "${group.id}" unknown medication "${medId}"`);
                    }
                }
                if (group.default && !group.options.includes(group.default)) {
                    errors.push(`conditions.${id}: group "${group.id}" default "${group.default}" is not in options`);
                }
            } else {
                for (const [index, item] of (group.items || []).entries()) {
                    if (item.type === 'med') {
                        if (!medications[item.medId]) {
                            errors.push(`conditions.${id}: group "${group.id}" item ${index} unknown medication "${item.medId}"`);
                        }
                    } else if (item.type === 'class') {
                        const medClass = medicationClasses[item.classId];
                        if (!medClass) {
                            errors.push(`conditions.${id}: group "${group.id}" item ${index} unknown class "${item.classId}"`);
                        } else if (item.default && !medClass.options.includes(item.default)) {
                            errors.push(`conditions.${id}: group "${group.id}" item ${index} default "${item.default}" is not in class "${item.classId}"`);
                        }
                    } else {
                        errors.push(`conditions.${id}: group "${group.id}" item ${index} invalid type "${item.type}"`);
                    }
                }
            }
        }
    }
}

async function validateCompiledSync(payload, errors) {
    const compiled = {
        medications: await readCompiledFile('medications'),
        medicationClasses: await readCompiledFile('medication-classes'),
        physicalExam: await readCompiledFile('physical-exam'),
        conditions: await readCompiledFile('conditions')
    };

    if (JSON.stringify(compiled.medications) !== JSON.stringify(payload.medications)) {
        errors.push('data/medications.json is out of sync with data-src (run: npm run compile-data)');
    }
    if (JSON.stringify(compiled.medicationClasses) !== JSON.stringify(payload.medicationClasses)) {
        errors.push('data/medication-classes.json is out of sync with data-src (run: npm run compile-data)');
    }
    if (JSON.stringify(compiled.physicalExam) !== JSON.stringify(payload.physicalExam)) {
        errors.push('data/physical-exam.json is out of sync with data-src (run: npm run compile-data)');
    }
    if (JSON.stringify(compiled.conditions) !== JSON.stringify(payload.conditions)) {
        errors.push('data/conditions.json is out of sync with data-src (run: npm run compile-data)');
    }
}

async function main() {
    const errors = [];
    const warnings = [];

    try {
        await validateSourceLayout(errors);

        const schemas = {
            medication: await loadSchema('medication.schema.json'),
            medicationClass: await loadSchema('medication-class.schema.json'),
            physicalExamAddon: await loadSchema('physical-exam-addon.schema.json'),
            condition: await loadSchema('condition.schema.json')
        };

        const payload = await buildCompiledPayload();

        validateSchemaCompliance(payload, schemas, errors);
        validateCrossReferences(payload, errors, warnings);
        await validateCompiledSync(payload, errors);

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
