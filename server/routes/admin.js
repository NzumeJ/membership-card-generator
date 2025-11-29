const express = require('express');
const router = express.Router();
const passport = require('passport');
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');

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
