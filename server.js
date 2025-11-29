require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const QRCode = require('qrcode');
const flash = require('connect-flash');

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API response formatter middleware
app.use((req, res, next) => {
    // Only apply to API routes
    if (req.originalUrl.startsWith('/api/')) {
        // Set default content type for API routes
        res.setHeader('Content-Type', 'application/json');
        
        // Create a custom json method to standardize responses
        res.apiSuccess = (data, message = 'Success', statusCode = 200) => {
            return res.status(statusCode).json({
                success: true,
                message,
                data
            });
        };
        
        res.apiError = (message = 'An error occurred', statusCode = 400, error = {}) => {
            return res.status(statusCode).json({
                success: false,
                message,
                error: process.env.NODE_ENV === 'development' ? error : {}
            });
        };
    }
    next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// CORS handling middleware
app.use((req, res, next) => {
    // Allow from same origin
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Session middleware must come before passport
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/asbbic-membership',
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        httpOnly: true,
        sameSite: 'lax' // Changed from 'strict' to 'lax' for better compatibility
    }
}));

// Passport configuration
require('./server/config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Make user and flash messages available to all views
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Database connection with improved error handling
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/asbbic-membership', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        
        // Log when MongoDB is connected
        mongoose.connection.on('connected', () => {
            console.log('Mongoose connected to DB');
        });
        
        // Log when MongoDB is disconnected
        mongoose.connection.on('disconnected', () => {
            console.log('Mongoose disconnected from DB');
        });
        
        // Handle connection errors
        mongoose.connection.on('error', (err) => {
            console.error('Mongoose connection error:', err);
        });
        
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

// Connect to MongoDB
connectDB();

// Public API routes (no authentication required)
app.use('/api/members', require('./server/routes/members'));

// Admin routes (protected)
app.use('/admin', require('./server/routes/admin'));

// Other public routes
app.use('/', require('./server/routes/index'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error stack:', err.stack);
    
    // Handle JSON parse errors
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('JSON Parse Error:', err);
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON in request body',
                error: process.env.NODE_ENV === 'development' ? err.message : {}
            });
        }
    }
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
        console.error('Multer Error:', err);
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(400).json({
                success: false,
                message: `File upload error: ${err.message}`,
                error: process.env.NODE_ENV === 'development' ? err : {}
            });
        }
    }
    
    // Handle other errors
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: process.env.NODE_ENV === 'development' ? err.message : {}
        });
    }
    
    // For non-API routes, render an error page
    res.status(500).render('error', {
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
