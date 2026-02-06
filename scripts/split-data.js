#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const {
    COMPILED_DIR,
    SOURCE_DIR,
    TYPE_CONFIG,
    sortObjectByKeys
} = require('./lib/data-pipeline');

async function readJson(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

async function clearJsonFiles(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
    const entries = await fs.readdir(dirPath);
    await Promise.all(
        entries
            .filter(name => name.endsWith('.json'))
            .map(name => fs.unlink(path.join(dirPath, name)))
    );
}

async function writeSplitFiles(type, entries) {
    const sourceDir = path.join(SOURCE_DIR, TYPE_CONFIG[type].sourceDir);
    await clearJsonFiles(sourceDir);

    const sortedEntries = sortObjectByKeys(entries);
    await Promise.all(
        Object.entries(sortedEntries).map(async ([id, entry]) => {
            const filePath = path.join(sourceDir, `${id}.json`);
            await fs.writeFile(filePath, JSON.stringify(entry, null, 2) + '\n', 'utf-8');
        })
    );
}

async function main() {
    try {
        const medications = await readJson(path.join(COMPILED_DIR, TYPE_CONFIG.medications.compiledFile));
        const medicationClasses = await readJson(path.join(COMPILED_DIR, TYPE_CONFIG['medication-classes'].compiledFile));
        const physicalExam = await readJson(path.join(COMPILED_DIR, TYPE_CONFIG['physical-exam'].compiledFile));
        const conditions = await readJson(path.join(COMPILED_DIR, TYPE_CONFIG.conditions.compiledFile));

        await writeSplitFiles('medications', medications);
        await writeSplitFiles('medication-classes', medicationClasses);
        await writeSplitFiles('physical-exam', physicalExam.addons || {});
        await writeSplitFiles('conditions', conditions);

        console.log('Split compiled data into data-src/');
        console.log(`  medications: ${Object.keys(medications).length}`);
        console.log(`  medication-classes: ${Object.keys(medicationClasses).length}`);
        console.log(`  physical-exam addons: ${Object.keys(physicalExam.addons || {}).length}`);
        console.log(`  conditions: ${Object.keys(conditions).length}`);
    } catch (error) {
        console.error('Data split failed:', error.message);
        process.exit(1);
    }
}

main();
