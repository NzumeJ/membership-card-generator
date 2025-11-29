const express = require('express');
const router = express.Router();
const passport = require('passport');
const Member = require('../models/Member');
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');

// Dashboard statistics
router.get('/dashboard/stats', ensureAuthenticated, async (req, res) => {
    try {
        const totalMembers = await Member.countDocuments();
        const activeMembers = await Member.countDocuments({ status: 'approved' });
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const newMembers = await Member.countDocuments({ 
            createdAt: { $gte: oneMonthAgo } 
        });

        res.json({
            success: true,
            stats: {
                totalMembers,
                activeMembers,
                newMembers
            }
        });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Recent members
router.get('/dashboard/recent-members', ensureAuthenticated, async (req, res) => {
    try {
        const recentMembers = await Member.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .select('fullName idNumber activity status createdAt')
            .lean();

        res.json({
            success: true,
            members: recentMembers
        });
    } catch (err) {
        console.error('Error fetching recent members:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Export members to CSV
router.get('/members/export', ensureAuthenticated, async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 }).lean();
        
        // Convert to CSV
        const fields = [
            'fullName', 
            'email', 
            'phone', 
            'idNumber', 
            'birthDate',
            'birthPlace',
            'activity', 
            'status',
            'createdAt'
        ];
        
        let csv = fields.join(',') + '\n';
        
        members.forEach(member => {
            let row = fields.map(field => {
                let value = '';
                
                // Format date fields
                if (field === 'birthDate' && member[field]) {
                    value = new Date(member[field]).toISOString().split('T')[0]; // Format as YYYY-MM-DD
                } else if (field === 'createdAt' && member[field]) {
                    value = new Date(member[field]).toISOString();
                } else {
                    value = String(member[field] || '');
                }
                
                // Escape quotes and wrap in quotes
                value = value.replace(/"/g, '""');
                return `"${value}"`;
            }).join(',');
            
            csv += row + '\n';
        });

        // Set headers for file download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `members-export-${timestamp}.csv`;
        
        res.header('Content-Type', 'text/csv');
        res.attachment(filename);
        return res.send(csv);
    } catch (err) {
        console.error('Error exporting members:', err);
        res.status(500).json({ success: false, message: 'Error exporting members: ' + err.message });
    }
});

// Admin login page (GET)
router.get('/', forwardAuthenticated, (req, res) => {
    res.render('admin/login', { 
        message: req.flash('error'),
        path: req.path 
    });
});

// Admin login (POST)
router.post('/login', 
    passport.authenticate('local', {
        successReturnToOrRedirect: '/admin/dashboard',
        failureRedirect: '/admin',
        failureFlash: 'Invalid username or password.'
    })
);

// Admin dashboard
router.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.render('admin/dashboard', { 
        title: 'Dashboard',
        user: req.user,
        path: '/admin/dashboard'
    });
});

// Members list page
router.get('/members', ensureAuthenticated, (req, res) => {
    res.render('admin/members', {
        title: 'Members',
        user: req.user,
        path: '/admin/members'
    });
});

// Logout
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { return next(err); }
        req.flash('success', 'You have been logged out.');
        res.redirect('/admin');
    });
});

module.exports = router;
