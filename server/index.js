const express = require('express');
const cors = require('cors');
const path = require('path');
const dataRoutes = require('./routes/data');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (main app and admin)
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api', dataRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  FastPEP Editor Server');
    console.log('='.repeat(50));
    console.log(`  Server running at: http://localhost:${PORT}`);
    console.log(`  Editor available at: http://localhost:${PORT}/admin/`);
    console.log(`  Main app at: http://localhost:${PORT}/`);
    console.log('='.repeat(50));
    console.log('');
});
