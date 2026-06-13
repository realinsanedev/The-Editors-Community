const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const FORUMS_FILE = path.join(__dirname, 'forums.json');

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const AUTH_TOKEN = 'secret-admin-token-123';
const JWT_SECRET = 'super-secret-jwt-key-for-users'; // In production, use env variable

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// Route to serve admin panel
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, uuidv4() + ext);
    }
});
const upload = multer({ storage });

// Helper to read users
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]');
}

// Helper to save users
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 4));
}

// Helper to read forums
function getForums() {
    if (!fs.existsSync(FORUMS_FILE)) return [];
    return JSON.parse(fs.readFileSync(FORUMS_FILE, 'utf8') || '[]');
}

// Helper to save forums
function saveForums(forums) {
    fs.writeFileSync(FORUMS_FILE, JSON.stringify(forums, null, 4));
}

// --- USER ROUTES ---

app.post('/api/users/register', upload.fields([{ name: 'profilePic', maxCount: 1 }, { name: 'profileBanner', maxCount: 1 }]), async (req, res) => {
    const { username, email, password, name } = req.body;
    if (!username || !email || !password || !name) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const users = getUsers();
    if (users.find(u => u.username === username || u.email === email)) {
        return res.status(400).json({ success: false, message: 'Username or Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    let profilePic = '';
    let profileBanner = '';
    if (req.files && req.files['profilePic']) {
        profilePic = '/uploads/' + req.files['profilePic'][0].filename;
    }
    if (req.files && req.files['profileBanner']) {
        profileBanner = '/uploads/' + req.files['profileBanner'][0].filename;
    }

    const newUser = {
        id: uuidv4(),
        username,
        email,
        name,
        bio: '',
        password: hashedPassword,
        profilePic,
        profileBanner
    };
    users.push(newUser);
    saveUsers(users);
    
    const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: newUser.id, username, email, name, bio: newUser.bio, profilePic, profileBanner } });
});

app.post('/api/users/login', async (req, res) => {
    const { username, password } = req.body;
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, name: user.name, bio: user.bio || '', profilePic: user.profilePic, profileBanner: user.profileBanner } });
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

app.get('/api/users/profile', authenticateUser, (req, res) => {
    const users = getUsers();
    const user = users.find(u => u.id === req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: { id: user.id, username: user.username, email: user.email, name: user.name, bio: user.bio || '', profilePic: user.profilePic, profileBanner: user.profileBanner } });
});

app.post('/api/users/profile', authenticateUser, upload.fields([{ name: 'profilePic', maxCount: 1 }, { name: 'profileBanner', maxCount: 1 }]), async (req, res) => {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === req.userId);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'User not found' });
    
    const user = users[userIndex];
    
    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (req.body.username) user.username = req.body.username;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.password) {
        user.password = await bcrypt.hash(req.body.password, 10);
    }
    
    if (req.files['profilePic']) {
        user.profilePic = '/uploads/' + req.files['profilePic'][0].filename;
    }
    if (req.files['profileBanner']) {
        user.profileBanner = '/uploads/' + req.files['profileBanner'][0].filename;
    }
    
    users[userIndex] = user;
    saveUsers(users);
    
    res.json({ success: true, message: 'Profile updated', user: { id: user.id, username: user.username, email: user.email, name: user.name, bio: user.bio || '', profilePic: user.profilePic, profileBanner: user.profileBanner } });
});

// --- FORUM ROUTES ---

app.get('/api/forums', (req, res) => {
    const forums = getForums();
    // Sort posts by newest first
    forums.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, forums });
});

app.post('/api/forums', authenticateUserOptional, upload.single('image'), (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required' });

    let authorId = null;
    let authorName = 'Anonymous';
    let authorAvatar = 'https://api.dicebear.com/6.x/initials/svg?seed=Anon';

    if (req.userId) {
        const users = getUsers();
        const user = users.find(u => u.id === req.userId);
        if (user) {
            authorId = user.id;
            authorName = user.username;
            authorAvatar = user.profilePic || 'https://api.dicebear.com/6.x/initials/svg?seed=' + user.name;
        }
    }

    let imageUrl = '';
    if (req.file) {
        imageUrl = '/uploads/' + req.file.filename;
    }

    const forums = getForums();
    const newPost = {
        id: uuidv4(),
        authorId,
        authorName,
        authorAvatar,
        title,
        content,
        imageUrl,
        createdAt: new Date().toISOString(),
        replies: []
    };

    forums.push(newPost);
    saveForums(forums);

    res.json({ success: true, post: newPost });
});

app.post('/api/forums/:id/reply', authenticateUserOptional, upload.single('image'), (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Content is required' });

    const forums = getForums();
    const postIndex = forums.findIndex(f => f.id === req.params.id);
    if (postIndex === -1) return res.status(404).json({ success: false, message: 'Post not found' });

    let authorId = null;
    let authorName = 'Anonymous';
    let authorAvatar = 'https://api.dicebear.com/6.x/initials/svg?seed=Anon';

    if (req.userId) {
        const users = getUsers();
        const user = users.find(u => u.id === req.userId);
        if (user) {
            authorId = user.id;
            authorName = user.username;
            authorAvatar = user.profilePic || 'https://api.dicebear.com/6.x/initials/svg?seed=' + user.name;
        }
    }

    let imageUrl = '';
    if (req.file) {
        imageUrl = '/uploads/' + req.file.filename;
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

    forums[postIndex].replies.push(newReply);
    saveForums(forums);

    res.json({ success: true, reply: newReply });
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
app.get('/api/data', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading data.json:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json(JSON.parse(data));
    });
});

// POST /api/data - Save new data (Protected)
app.post('/api/data', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const newData = req.body;
    fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 4), 'utf8', (err) => {
        if (err) {
            console.error('Error writing to data.json:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ success: true, message: 'Data saved successfully' });
    });
});

// Export for Vercel serverless
module.exports = app;

// Listen locally when not in Vercel
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
