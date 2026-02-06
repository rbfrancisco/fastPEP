const express = require('express');
const cors = require('cors');
const path = require('path');
const dataRoutes = require('./routes/data');
const { compileDataFromSource } = require('../scripts/lib/data-pipeline');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_CORS_ORIGIN = process.env.ADMIN_CORS_ORIGIN;

// Middleware
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// CORS is disabled by default. If you need cross-origin admin access, set ADMIN_CORS_ORIGIN.
if (ADMIN_CORS_ORIGIN) {
    app.use(cors({
        origin: ADMIN_CORS_ORIGIN,
        methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-Admin-Token']
    }));
}

// Serve static files (main app and admin)
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api', dataRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

async function startServer() {
    // Keep runtime data/ synchronized with split source files.
    await compileDataFromSource();

    app.listen(PORT, HOST, () => {
        console.log('');
        console.log('='.repeat(50));
        console.log('  FastPEP Editor Server');
        console.log('='.repeat(50));
        console.log(`  Server running at: http://${HOST}:${PORT}`);
        console.log(`  Editor available at: http://${HOST}:${PORT}/admin/`);
        console.log(`  Main app at: http://${HOST}:${PORT}/`);
        if (ADMIN_CORS_ORIGIN) {
            console.log(`  CORS enabled for: ${ADMIN_CORS_ORIGIN}`);
        } else {
            console.log('  CORS disabled (same-origin only)');
        }
        console.log('='.repeat(50));
        console.log('');
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error.message);
    process.exit(1);
});
