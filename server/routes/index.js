const express = require('express');
const router = express.Router();
const path = require('path');

// Home page route
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Handle form submission
router.post('/api/members', (req, res) => {
    // This will be handled by the members route
    res.redirect('/api/members');
});

module.exports = router;
