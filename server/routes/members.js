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
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: function(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Error: Images only (JPEG, JPG, PNG, GIF)'));
        }
    }
});

// Error handling middleware for multer
const multerErrorHandler = (err, req, res, next) => {
    if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({
            success: false,
            message: err.message || 'Error uploading file'
        });
    }
    next();
};

// Test route to check if API is working
router.get('/test', (req, res) => {
    console.log('Test route hit');
    res.json({ success: true, message: 'API is working' });
});

// =========================
// CREATE NEW MEMBER (Public endpoint - no authentication required)
// =========================
router.post("/", upload.single("photo"), multerErrorHandler, async (req, res) => {
    console.log('POST /api/members - Request received');
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);

    try {
        const { fullName, email, phone, birthDate, birthPlace, activity, idNumber } = req.body;

        // Basic validation
        if (!fullName || !email || !phone) {
            console.log('Validation failed - missing required fields');
            // Clean up uploaded file if validation fails
            if (req.file) {
                fs.unlinkSync(req.file.path);
                console.log('Deleted uploaded file due to validation error');
            }
            return res.apiError("Full name, email and phone are required", 400);
        }

        // Duplicate email check
        const exists = await Member.findOne({ email });
        if (exists) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.apiError("A member with this email already exists", 400);
        }

        // Create new member
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
        try {
            const qrValue = (process.env.BASE_URL || "http://localhost:3000") + "/verify/" + member._id;
            const qrFilePath = path.join(qrDir, `${member._id}.png`);
            await QRCode.toFile(qrFilePath, qrValue);
            member.qrCode = "/qrcodes/" + member._id + ".png";
        } catch (qrError) {
            console.error('Error generating QR code:', qrError);
            // Don't fail the request if QR code generation fails
            member.qrCode = null;
        }

        console.log('Saving member to database:', member);
        await member.save();
        console.log('Member saved successfully');

        // Use the API success helper
        return res.apiSuccess(member, 'Member created successfully', 201);

    } catch (err) {
        console.error('Error saving member:', err);
        // Clean up uploaded file if there's an error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            console.log('Deleted uploaded file due to error');
        }
        return res.apiError('Failed to create member', 500, err);
    }
});

// =========================
// GET ALL MEMBERS (Protected - requires authentication)
// =========================
router.get("/", ensureAuthenticated, async (req, res) => {
    console.log('GET /api/members - Fetching members');
    
    try {
        // Check if this is a DataTables request
        const isDataTableRequest = req.query.draw !== undefined;
        
        if (isDataTableRequest) {
            // Handle DataTables server-side processing
            const start = parseInt(req.query.start) || 0;
            const length = parseInt(req.query.length) || 10;
            const search = req.query.search?.value || '';
            const draw = parseInt(req.query.draw) || 1;

            // Build query for search
            let query = {};
            if (search) {
                query = {
                    $or: [
                        { fullName: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { phone: { $regex: search, $options: 'i' } },
                        { memberId: { $regex: search, $options: 'i' } }
                    ]
                };
            }

            // Get counts and data in parallel
            const [totalRecords, filteredRecords, members] = await Promise.all([
                Member.countDocuments(),
                search ? Member.countDocuments(query) : Promise.resolve(null),
                Member.find(query)
                    .sort({ createdAt: -1 })
                    .skip(start)
                    .limit(length)
            ]);

            // Format data for DataTables
            const data = members.map(member => ({
                _id: member._id,
                fullName: member.fullName,
                email: member.email,
                phone: member.phone,
                photo: member.photo,
                status: member.status,
                memberId: member.memberId,
                birthDate: member.birthDate,
                birthPlace: member.birthPlace,
                activity: member.activity,
                approvedAt: member.approvedAt,
                createdAt: member.createdAt
            }));

            console.log(`Returning ${data.length} members (filtered from ${filteredRecords || totalRecords} total)`);

            return res.json({
                draw,
                recordsTotal: totalRecords,
                recordsFiltered: search !== '' ? filteredRecords : totalRecords,
                data: data
            });
        } else {
            // Handle regular API request (non-DataTables)
            const members = await Member.find().sort({ createdAt: -1 });
            console.log(`Returning ${members.length} members`);
            return res.json({
                success: true,
                count: members.length,
                members
            });
        }

    } catch (err) {
        console.error('Error fetching members:', err);
        res.status(500).json({
            success: false,
            message: "Server error: " + err.message
        });
    }
});

// =========================
// TEST ROUTE: GET ALL MEMBERS (For debugging)
// =========================
router.get('/test/all', async (req, res) => {
    try {
        const members = await Member.find({}).sort({ createdAt: -1 });
        console.log('All members from DB:', members);
        return res.json({
            success: true,
            count: members.length,
            members
        });
    } catch (err) {
        console.error('Error fetching all members:', err);
        return res.status(500).json({
            success: false,
            message: 'Error fetching members'
        });
    }
});

// =========================
// GET ONE MEMBER
// =========================
router.get("/:id", ensureAuthenticated, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id).lean();

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        // Ensure all required fields are present with defaults
        const memberData = {
            _id: member._id,
            fullName: member.fullName || 'N/A',
            email: member.email || 'N/A',
            phone: member.phone || 'N/A',
            photo: member.photo || '/images/default-avatar.png',
            status: member.status || 'pending',
            memberId: member.memberId || 'N/A',
            birthDate: member.birthDate || null,
            birthPlace: member.birthPlace || 'N/A',
            activity: member.activity || 'N/A',
            approvedAt: member.approvedAt || null,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt
        };

        res.json({
            success: true,
            member: memberData
        });

    } catch (err) {
        console.error('Error fetching member:', err);
        return res.status(500).json({
            success: false,
            message: "Server error: " + (process.env.NODE_ENV === 'development' ? err.message : 'An error occurred')
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

        // If there's a photo, delete it from the filesystem
        if (member.photo) {
            const filePath = path.join(__dirname, '../../public', member.photo);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        return res.json({
            success: true,
            message: "Member deleted successfully"
        });

    } catch (err) {
        console.error('Error deleting member:', err);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =========================
// DOWNLOAD MEMBER PHOTO
// =========================
router.get("/:id/photo", ensureAuthenticated, async (req, res) => {
    try {
        const member = await Member.findById(req.params.id);
        
        if (!member || !member.photo) {
            return res.status(404).json({
                success: false,
                message: "Member or photo not found"
            });
        }

        // Get the file extension from the photo path
        const fileExt = path.extname(member.photo).toLowerCase();
        const fileName = `${member.fullName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${fileExt}`;
        const filePath = path.join(__dirname, '../../public', member.photo);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: "Photo file not found"
            });
        }

        // Set headers for file download
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        success: false,
                        message: "Error downloading photo"
                    });
                }
            }
        });

    } catch (err) {
        console.error('Error in photo download:', err);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

// =========================
// UPDATE MEMBER STATUS
// =========================
router.patch("/:id/status", ensureAuthenticated, async (req, res) => {
    try {
        const { status } = req.body;
        
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be 'pending', 'approved', or 'rejected'"
            });
        }

        const member = await Member.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!member) {
            return res.status(404).json({
                success: false,
                message: "Member not found"
            });
        }

        return res.json({
            success: true,
            message: `Member ${status} successfully`,
            member
        });

    } catch (err) {
        console.error('Error updating member status:', err);
        return res.status(500).json({
            success: false,
            message: "Server error: " + err.message
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
