const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const Member = require('../models/Member');
const { ensureAuthenticated } = require('../middleware/auth');

// Ensure directories exist
const uploadsDir = path.join(__dirname, '../../public/uploads');
const qrDir = path.join(__dirname, '../../public/qrcodes');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

// Multer configuration
const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, "member-" + unique + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter(req, file, cb) {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only images allowed"));
        }
        cb(null, true);
    }
});

// Handle multer errors globally
function multerErrorHandler(err, req, res, next) {
    if (err instanceof multer.MulterError || err.message.includes("image")) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next(err);
}

// =========================
// CREATE NEW MEMBER
// =========================
router.post("/", upload.single("photo"), multerErrorHandler, async (req, res) => {
    try {
        const { fullName, email, phone, birthDate, birthPlace, activity, idNumber } = req.body;

        // Basic validation
        if (!fullName || !email || !phone) {
            if (req.file) fs.unlinkSync(req.file.path);

            return res.status(400).json({
                success: false,
                message: "Full name, email and phone are required"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            if (req.file) fs.unlinkSync(req.file.path);

            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        // Duplicate email check
        const exists = await Member.findOne({ email });
        if (exists) {
            if (req.file) fs.unlinkSync(req.file.path);

            return res.status(400).json({
                success: false,
                message: "A member with this email already exists"
            });
        }

        // Prepare new member record
        const member = new Member({
            fullName,
            email,
            phone,
            birthDate: birthDate || null,
            birthPlace: birthPlace || null,
            activity: activity || null,
            idNumber: idNumber || null,
            status: "pending",
            memberId: "MEM" + Date.now().toString().slice(-6),
            photo: req.file ? "/uploads/" + req.file.filename : null
        });

        // Generate unique QR
        const qrValue = (process.env.BASE_URL || "http://localhost:3000") + "/verify/" + member._id;
        const qrFilePath = path.join(qrDir, `${member._id}.png`);

        await QRCode.toFile(qrFilePath, qrValue);
        member.qrCode = "/qrcodes/" + member._id + ".png";

        await member.save();

        return res.status(201).json({
            success: true,
            message: "Member created successfully",
            member
        });

    } catch (err) {
        console.error("CREATE MEMBER ERROR:", err);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
});

// =========================
// GET ALL MEMBERS
// =========================
router.get("/", ensureAuthenticated, async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });

        return res.json({
            success: true,
            members
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =========================
// GET ONE MEMBER
// =========================
router.get("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        res.json({
            success: true,
            member
        });

    } catch {
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =========================
// DELETE MEMBER
// =========================
router.delete("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const member = await Member.findByIdAndDelete(req.params.id);

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        if (member.photo) {
            const p = path.join(__dirname, '../../public', member.photo);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }

        if (member.qrCode) {
            const q = path.join(__dirname, '../../public', member.qrCode);
            if (fs.existsSync(q)) fs.unlinkSync(q);
        }

        return res.json({
            success: true,
            message: "Member deleted successfully"
        });

    } catch {
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

module.exports = router;
