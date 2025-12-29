const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '../../data');

// Map URL type parameter to actual file names
const FILE_MAP = {
    'medications': 'medications.json',
    'medication-classes': 'medication-classes.json',
    'physical-exam': 'physical-exam.json',
    'conditions': 'conditions.json'
};

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
    // Pretty print with 2-space indent and trailing newline
    await fs.writeFile(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
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
router.put('/data/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const entryData = req.body;

        if (!id || id.trim() === '') {
            return res.status(400).json({ error: 'ID is required' });
        }

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

        console.log(`Saved ${type}/${id}`);
        res.json({ success: true, id, message: `Entry "${id}" saved successfully` });
    } catch (error) {
        console.error(`PUT /api/data/${req.params.type}/${req.params.id} error:`, error.message);
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/data/:type/:id - Delete an entry
router.delete('/data/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        let data = await readDataFile(type);
        let deleted = false;

        if (type === 'physical-exam') {
            if (data.addons && data.addons[id]) {
                delete data.addons[id];
                deleted = true;
            }
        } else {
            if (data[id]) {
                delete data[id];
                deleted = true;
            }
        }

        if (!deleted) {
            return res.status(404).json({ error: `Entry "${id}" not found` });
        }

        await writeDataFile(type, data);

        console.log(`Deleted ${type}/${id}`);
        res.json({ success: true, id, message: `Entry "${id}" deleted successfully` });
    } catch (error) {
        console.error(`DELETE /api/data/${req.params.type}/${req.params.id} error:`, error.message);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
