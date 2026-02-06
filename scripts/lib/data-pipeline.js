const fs = require('fs').promises;
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'data-src');
const COMPILED_DIR = path.join(ROOT_DIR, 'data');
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const TYPE_CONFIG = {
    medications: {
        sourceDir: 'medications',
        compiledFile: 'medications.json',
        wrap: false
    },
    'medication-classes': {
        sourceDir: 'medication-classes',
        compiledFile: 'medication-classes.json',
        wrap: false
    },
    'physical-exam': {
        sourceDir: 'physical-exam',
        compiledFile: 'physical-exam.json',
        wrap: true
    },
    conditions: {
        sourceDir: 'conditions',
        compiledFile: 'conditions.json',
        wrap: false
    }
};

function getTypeConfig(type) {
    const config = TYPE_CONFIG[type];
    if (!config) {
        throw new Error(`Invalid data type: ${type}`);
    }
    return config;
}

function sortObjectByKeys(obj) {
    return Object.fromEntries(
        Object.entries(obj).sort(([a], [b]) => a.localeCompare(b, 'en'))
    );
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeJsonAtomic(filePath, data) {
    const serialized = JSON.stringify(data, null, 2) + '\n';
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, serialized, 'utf-8');
    await fs.rename(tempPath, filePath);
}

function getSourceTypeDir(type) {
    const config = getTypeConfig(type);
    return path.join(SOURCE_DIR, config.sourceDir);
}

function getSourceEntryPath(type, id) {
    return path.join(getSourceTypeDir(type), `${id}.json`);
}

async function readSourceType(type) {
    const dirPath = getSourceTypeDir(type);
    await ensureDir(dirPath);

    const files = (await fs.readdir(dirPath))
        .filter(file => file.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b, 'en'));

    const result = {};
    for (const file of files) {
        const id = file.slice(0, -5);
        if (!ID_PATTERN.test(id)) {
            throw new Error(`Invalid source filename/id "${id}" in ${dirPath}`);
        }

        const filePath = path.join(dirPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        result[id] = JSON.parse(content);
    }

    return sortObjectByKeys(result);
}

async function buildCompiledPayload() {
    const medications = await readSourceType('medications');
    const medicationClasses = await readSourceType('medication-classes');
    const physicalExamAddons = await readSourceType('physical-exam');
    const conditions = await readSourceType('conditions');

    return {
        medications,
        medicationClasses,
        physicalExam: { addons: physicalExamAddons },
        conditions
    };
}

async function compileDataFromSource() {
    const payload = await buildCompiledPayload();
    await ensureDir(COMPILED_DIR);

    await writeJsonAtomic(
        path.join(COMPILED_DIR, TYPE_CONFIG.medications.compiledFile),
        payload.medications
    );
    await writeJsonAtomic(
        path.join(COMPILED_DIR, TYPE_CONFIG['medication-classes'].compiledFile),
        payload.medicationClasses
    );
    await writeJsonAtomic(
        path.join(COMPILED_DIR, TYPE_CONFIG['physical-exam'].compiledFile),
        payload.physicalExam
    );
    await writeJsonAtomic(
        path.join(COMPILED_DIR, TYPE_CONFIG.conditions.compiledFile),
        payload.conditions
    );

    return payload;
}

async function writeSourceEntry(type, id, entry) {
    const dirPath = getSourceTypeDir(type);
    await ensureDir(dirPath);
    await writeJsonAtomic(getSourceEntryPath(type, id), entry);
}

async function deleteSourceEntry(type, id) {
    const filePath = getSourceEntryPath(type, id);
    try {
        await fs.unlink(filePath);
        return true;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

async function readCompiledFile(type) {
    const config = getTypeConfig(type);
    const filePath = path.join(COMPILED_DIR, config.compiledFile);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
}

module.exports = {
    ROOT_DIR,
    SOURCE_DIR,
    COMPILED_DIR,
    TYPE_CONFIG,
    ID_PATTERN,
    sortObjectByKeys,
    buildCompiledPayload,
    compileDataFromSource,
    readSourceType,
    writeSourceEntry,
    deleteSourceEntry,
    readCompiledFile
};
