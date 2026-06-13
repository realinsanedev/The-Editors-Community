require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('cloudinary').v2;

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
let serviceAccount;

if (process.env.FIREBASE_PRIVATE_KEY) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    // Remove enclosing quotes if they were copied from the JSON file
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    // Replace escaped newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
    };
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env variable:', e);
    }
} else {
    const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
    if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = require(serviceAccountPath);
    }
}

let db;
if (serviceAccount) {
    try {
        const pk = serviceAccount.privateKey || serviceAccount.private_key || '';
        console.log(`[Diagnostic] Private Key length: ${pk.length}`);
        console.log(`[Diagnostic] Starts with standard header: ${pk.startsWith('-----BEGIN PRIVATE KEY-----')}`);
        console.log(`[Diagnostic] Ends with standard footer: ${pk.trim().endsWith('-----END PRIVATE KEY-----')}`);
        console.log(`[Diagnostic] Contains actual newlines: ${pk.includes('\n')}`);
        console.log(`[Diagnostic] Contains literal '\\n' text: ${pk.includes('\\n')}`);
        
        // Bulletproof reconstruction of the private key PEM block
        let cleanKey = pk.trim();
        
        // Remove trailing comma if copied from JSON file
        if (cleanKey.endsWith(',')) {
            cleanKey = cleanKey.slice(0, -1).trim();
        }
        // Remove enclosing double quotes
        if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
            cleanKey = cleanKey.slice(1, -1).trim();
        }
        // Remove enclosing single quotes
        if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
            cleanKey = cleanKey.slice(1, -1).trim();
        }
        
        const header = '-----BEGIN PRIVATE KEY-----';
        const footer = '-----END PRIVATE KEY-----';
        
        const headerIndex = cleanKey.indexOf(header);
        const footerIndex = cleanKey.indexOf(footer);
        
        if (headerIndex !== -1 && footerIndex !== -1) {
            // Extract the precise key block, discarding any leading/trailing junk (like escaped quotes or commas)
            const keyBlock = cleanKey.slice(headerIndex, footerIndex + footer.length);
            
            // Extract the raw base64 data by removing headers, spaces, tabs, and any newline representations
            const base64Data = keyBlock
                .replace(header, '')
                .replace(footer, '')
                .replace(/\\n/g, '')  // Remove escaped newlines
                .replace(/\s+/g, ''); // Remove all raw spaces/newlines/tabs
            
            // Reconstruct the PEM block with standard newlines
            cleanKey = `${header}\n${base64Data}\n${footer}`;
        } else {
            // Fallback replacement if headers aren't matchable
            cleanKey = cleanKey.replace(/\\n/g, '\n');
        }
        
        // Ensure private key has normalized newlines and correct format
        if (serviceAccount.privateKey) {
            serviceAccount.privateKey = cleanKey;
        } else {
            serviceAccount.private_key = cleanKey;
        }

        initializeApp({
            credential: cert(serviceAccount)
        });
        db = getFirestore();
    } catch (err) {
        console.error("Firebase initialization failed:", err);
    }
} else {
    console.error("Firebase Service Account credentials not found! Ensure FIREBASE_PRIVATE_KEY or FIREBASE_SERVICE_ACCOUNT is set.");
}

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = 3000;

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const AUTH_TOKEN = 'secret-admin-token-123';
const JWT_SECRET = 'super-secret-jwt-key-for-users'; // In production, use env variable

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Middleware to check if database is initialized
app.use((req, res, next) => {
    if (!db && req.path.startsWith('/api')) {
        return res.status(500).json({ success: false, message: 'Database connection is not initialized. Check server logs.' });
    }
    next();
});

// Route to serve main homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Route to serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin.html'));
});

// Configure multer for memory storage (direct upload to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Helper to upload files to Cloudinary
function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve('');
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'editors_community' },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        uploadStream.end(file.buffer);
    });
}

// --- USER ROUTES ---

app.post('/api/users/register', upload.fields([{ name: 'profilePic', maxCount: 1 }, { name: 'profileBanner', maxCount: 1 }]), async (req, res) => {
    const { username, email, password, name } = req.body;
    if (!username || !email || !password || !name) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        // Check database
        const userSnap = await db.collection('users').where('username', '==', username).get();
        const emailSnap = await db.collection('users').where('email', '==', email).get();

        if (!userSnap.empty || !emailSnap.empty) {
            return res.status(400).json({ success: false, message: 'Username or Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let profilePic = '';
        let profileBanner = '';
        if (req.files && req.files['profilePic']) {
            profilePic = await uploadToCloudinary(req.files['profilePic'][0]);
        }
        if (req.files && req.files['profileBanner']) {
            profileBanner = await uploadToCloudinary(req.files['profileBanner'][0]);
        }

        const userId = uuidv4();
        const newUser = {
            id: userId,
            username,
            email,
            name,
            bio: '',
            password: hashedPassword,
            profilePic,
            profileBanner
        };

        await db.collection('users').doc(userId).set(newUser);
        
        const token = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: userId, username, email, name, bio: newUser.bio, profilePic, profileBanner } });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

app.post('/api/users/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userSnap = await db.collection('users').where('username', '==', username).get();
        if (userSnap.empty) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }
        
        const user = userSnap.docs[0].data();
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });
        
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, name: user.name, bio: user.bio || '', profilePic: user.profilePic, profileBanner: user.profileBanner } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

const authenticateUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

const authenticateUserOptional = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.id;
        } catch (err) {}
    }
    next();
};

app.get('/api/users/profile', authenticateUser, async (req, res) => {
    try {
        const userDoc = await db.collection('users').doc(req.userId).get();
        if (!userDoc.exists) return res.status(404).json({ success: false, message: 'User not found' });
        const user = userDoc.data();
        res.json({ success: true, user: { id: user.id, username: user.username, email: user.email, name: user.name, bio: user.bio || '', profilePic: user.profilePic, profileBanner: user.profileBanner } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error fetching profile' });
    }
});

app.post('/api/users/profile', authenticateUser, upload.fields([{ name: 'profilePic', maxCount: 1 }, { name: 'profileBanner', maxCount: 1 }]), async (req, res) => {
    try {
        const userDocRef = db.collection('users').doc(req.userId);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) return res.status(404).json({ success: false, message: 'User not found' });
        
        const user = userDoc.data();
        
        if (req.body.name) user.name = req.body.name;
        if (req.body.email) user.email = req.body.email;
        if (req.body.username) user.username = req.body.username;
        if (req.body.bio !== undefined) user.bio = req.body.bio;
        if (req.body.password) {
            user.password = await bcrypt.hash(req.body.password, 10);
        }
        
        if (req.files && req.files['profilePic']) {
            user.profilePic = await uploadToCloudinary(req.files['profilePic'][0]);
        }
        if (req.files && req.files['profileBanner']) {
            user.profileBanner = await uploadToCloudinary(req.files['profileBanner'][0]);
        }
        
        await userDocRef.set(user);
        
        res.json({ success: true, message: 'Profile updated', user: { id: user.id, username: user.username, email: user.email, name: user.name, bio: user.bio || '', profilePic: user.profilePic, profileBanner: user.profileBanner } });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ success: false, message: 'Server error updating profile' });
    }
});

// --- FORUM ROUTES ---

app.get('/api/forums', async (req, res) => {
    try {
        const forumSnap = await db.collection('forums').get();
        const forums = [];
        forumSnap.forEach(doc => forums.push(doc.data()));
        // Sort posts by newest first
        forums.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, forums });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error fetching forums' });
    }
});

app.post('/api/forums', authenticateUserOptional, upload.single('image'), async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required' });

    try {
        let authorId = null;
        let authorName = 'Anonymous';
        let authorAvatar = 'https://api.dicebear.com/6.x/initials/svg?seed=Anon';

        if (req.userId) {
            const userDoc = await db.collection('users').doc(req.userId).get();
            if (userDoc.exists) {
                const user = userDoc.data();
                authorId = user.id;
                authorName = user.username;
                authorAvatar = user.profilePic || 'https://api.dicebear.com/6.x/initials/svg?seed=' + user.name;
            }
        }

        let imageUrl = '';
        if (req.file) {
            imageUrl = await uploadToCloudinary(req.file);
        }

        const postId = uuidv4();
        const newPost = {
            id: postId,
            authorId,
            authorName,
            authorAvatar,
            title,
            content,
            imageUrl,
            createdAt: new Date().toISOString(),
            replies: []
        };

        await db.collection('forums').doc(postId).set(newPost);
        res.json({ success: true, post: newPost });
    } catch (err) {
        console.error('Forum posting error:', err);
        res.status(500).json({ success: false, message: 'Server error posting' });
    }
});

app.post('/api/forums/:id/reply', authenticateUserOptional, upload.single('image'), async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Content is required' });

    try {
        const postRef = db.collection('forums').doc(req.params.id);
        const postDoc = await postRef.get();
        if (!postDoc.exists) return res.status(404).json({ success: false, message: 'Post not found' });

        const post = postDoc.data();

        let authorId = null;
        let authorName = 'Anonymous';
        let authorAvatar = 'https://api.dicebear.com/6.x/initials/svg?seed=Anon';

        if (req.userId) {
            const userDoc = await db.collection('users').doc(req.userId).get();
            if (userDoc.exists) {
                const user = userDoc.data();
                authorId = user.id;
                authorName = user.username;
                authorAvatar = user.profilePic || 'https://api.dicebear.com/6.x/initials/svg?seed=' + user.name;
            }
        }

        let imageUrl = '';
        if (req.file) {
            imageUrl = await uploadToCloudinary(req.file);
        }

        const newReply = {
            id: uuidv4(),
            authorId,
            authorName,
            authorAvatar,
            content,
            imageUrl,
            createdAt: new Date().toISOString()
        };

        post.replies.push(newReply);
        await postRef.update({ replies: post.replies });

        res.json({ success: true, reply: newReply });
    } catch (err) {
        console.error('Forum reply error:', err);
        res.status(500).json({ success: false, message: 'Server error posting reply' });
    }
});

// --- ADMIN ROUTES ---

// POST /api/login - Authenticate admin
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        res.json({ success: true, token: AUTH_TOKEN });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// GET /api/data - Fetch the current data
app.get('/api/data', async (req, res) => {
    try {
        const siteDoc = await db.collection('site').doc('data').get();
        if (!siteDoc.exists) {
            return res.status(404).json({ error: 'Site data not found' });
        }
        res.json(siteDoc.data());
    } catch (err) {
        console.error('Error reading Firestore site/data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/data - Save new data (Protected)
app.post('/api/data', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const newData = req.body;
        await db.collection('site').doc('data').set(newData);
        res.json({ success: true, message: 'Data saved successfully' });
    } catch (err) {
        console.error('Error writing to Firestore site/data:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export for Vercel serverless
module.exports = app;

// Listen locally when not in Vercel
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
