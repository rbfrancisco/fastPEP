#!/usr/bin/env node

const { compileDataFromSource } = require('./lib/data-pipeline');

async function main() {
    try {
        const payload = await compileDataFromSource();
        console.log('Compiled data from data-src to data/:');
        console.log(`  medications: ${Object.keys(payload.medications).length}`);
        console.log(`  medication-classes: ${Object.keys(payload.medicationClasses).length}`);
        console.log(`  physical-exam addons: ${Object.keys(payload.physicalExam.addons).length}`);
        console.log(`  conditions: ${Object.keys(payload.conditions).length}`);
    } catch (error) {
        console.error('Data compilation failed:', error.message);
        process.exit(1);
    }
}

main();
