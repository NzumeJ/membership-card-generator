/**
 * Middleware to check if user is authenticated
 * Redirects to login page if not authenticated
 */
exports.ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to view this page');
    res.redirect('/admin');
};

/**
 * Middleware to check if user is not authenticated
 * Redirects to dashboard if already logged in
 */
exports.forwardAuthenticated = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/admin/dashboard');
};

/**
 * Middleware to check if user has admin role
 * Must be used after ensureAuthenticated
 */
exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    req.flash('error', 'Access denied. Admin privileges required.');
    res.redirect('/admin/dashboard');
};
