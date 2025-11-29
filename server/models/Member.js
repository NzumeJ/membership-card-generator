const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    birthDate: {
        type: Date,
        default: null
    },
    birthPlace: {
        type: String,
        default: '',
        trim: true
    },
    idNumber: {
        type: String,
        default: '',
        trim: true,
        uppercase: true
    },
    activity: {
        type: String,
        default: '',
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    photo: {
        type: String,
        default: ''
    },
    qrCode: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    memberId: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true
    },
    issuedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
memberSchema.index({ idNumber: 1 }, { unique: true });
memberSchema.index({ fullName: 'text', idNumber: 'text', email: 'text' });

module.exports = mongoose.model('Member', memberSchema);
