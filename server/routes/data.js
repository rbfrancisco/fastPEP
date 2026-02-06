const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '../../data');
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const writeLocks = new Map();

// Map URL type parameter to actual file names
const FILE_MAP = {
    'medications': 'medications.json',
    'medication-classes': 'medication-classes.json',
    'physical-exam': 'physical-exam.json',
    'conditions': 'conditions.json'
};

function isValidId(id) {
    return ID_PATTERN.test(id);
}

function requireAdminToken(req, res, next) {
    if (!ADMIN_API_TOKEN) {
        return res.status(503).json({
            error: 'Write operations are disabled. Set ADMIN_API_TOKEN to enable saving/deleting.'
        });
    }

    const providedToken = req.get('x-admin-token');
    if (!providedToken || providedToken !== ADMIN_API_TOKEN) {
        return res.status(401).json({ error: 'Invalid or missing admin token' });
    }

    next();
}

async function withWriteLock(type, task) {
    const previous = writeLocks.get(type) || Promise.resolve();
    const current = previous.then(task, task);
    writeLocks.set(type, current.catch(() => {}));
    return current;
}

// Helper: Read JSON file
async function readDataFile(type) {
    const filename = FILE_MAP[type];
    if (!filename) {
        throw new Error(`Invalid data type: ${type}`);
    }
    const filepath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
}

// Helper: Write JSON file with pretty formatting
async function writeDataFile(type, data) {
    const filename = FILE_MAP[type];
    if (!filename) {
        throw new Error(`Invalid data type: ${type}`);
    }
    const filepath = path.join(DATA_DIR, filename);
    const tempFilepath = `${filepath}.tmp-${process.pid}-${Date.now()}`;
    const serialized = JSON.stringify(data, null, 2) + '\n';

    // Atomic write: write temp file then rename over target
    await fs.writeFile(tempFilepath, serialized, 'utf-8');
    await fs.rename(tempFilepath, filepath);
}

// GET /api/data/:type - Get all data for a type
router.get('/data/:type', async (req, res) => {
    try {
        const data = await readDataFile(req.params.type);
        res.json(data);
    } catch (error) {
        console.error(`GET /api/data/${req.params.type} error:`, error.message);
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/data/:type/:id - Create or update a single entry
router.put('/data/:type/:id', requireAdminToken, async (req, res) => {
    try {
        const { type, id } = req.params;
        const entryData = req.body;

        if (!id || id.trim() === '') {
            return res.status(400).json({ error: 'ID is required' });
        }

        if (!isValidId(id)) {
            return res.status(400).json({
                error: 'Invalid ID format. Use lowercase letters, numbers, and hyphens only.'
            });
        }

        await withWriteLock(type, async () => {
            let data = await readDataFile(type);

            // Special handling for physical-exam (nested under "addons")
            if (type === 'physical-exam') {
                if (!data.addons) {
                    data.addons = {};
                }
                data.addons[id] = entryData;
            } else {
                data[id] = entryData;
            }

            await writeDataFile(type, data);
        });

        console.log(`Saved ${type}/${id}`);
        res.json({ success: true, id, message: `Entry "${id}" saved successfully` });
    } catch (error) {
        console.error(`PUT /api/data/${req.params.type}/${req.params.id} error:`, error.message);
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/data/:type/:id - Delete an entry
router.delete('/data/:type/:id', requireAdminToken, async (req, res) => {
    try {
        const { type, id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                error: 'Invalid ID format. Use lowercase letters, numbers, and hyphens only.'
            });
        }

        const deleted = await withWriteLock(type, async () => {
            let data = await readDataFile(type);
            let removed = false;

            if (type === 'physical-exam') {
                if (data.addons && data.addons[id]) {
                    delete data.addons[id];
                    removed = true;
                }
            } else if (data[id]) {
                delete data[id];
                removed = true;
            }

            if (removed) {
                await writeDataFile(type, data);
            }

            return removed;
        });

        if (!deleted) {
            return res.status(404).json({ error: `Entry "${id}" not found` });
        }

        console.log(`Deleted ${type}/${id}`);
        res.json({ success: true, id, message: `Entry "${id}" deleted successfully` });
    } catch (error) {
        console.error(`DELETE /api/data/${req.params.type}/${req.params.id} error:`, error.message);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
