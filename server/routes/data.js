const express = require('express');
const {
    ID_PATTERN,
    readSourceType,
    writeSourceEntry,
    deleteSourceEntry,
    compileDataFromSource
} = require('../../scripts/lib/data-pipeline');

const router = express.Router();

const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
const writeLocks = new Map();

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
    const sourceData = await readSourceType(type);
    if (type === 'physical-exam') {
        return { addons: sourceData };
    }
    return sourceData;
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
            await writeSourceEntry(type, id, entryData);
            await compileDataFromSource();
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
            const removed = await deleteSourceEntry(type, id);
            if (removed) {
                await compileDataFromSource();
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
