const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const jwt = require('jsonwebtoken');

const ADMIN_PASSWORD = "@25DSI-DA"; // Nouveau mot de passe
const SECRET_KEY = "countdown_secret";

const app = express();
app.use(cors());
app.use(express.json());
const httpServer = createServer(app);

// Middleware d'authentification
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:2261",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Database setup
const db = new sqlite3.Database('./countdown.db', (err) => {
  if (err) console.error(err.message);
  console.log('Connected to SQLite database.');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS countdown_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      duration INTEGER NOT NULL,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send current duration to new client
  db.get('SELECT duration FROM countdown_settings ORDER BY last_updated DESC LIMIT 1', 
    (err, row) => {
      if (!err && row) {
        socket.emit('duration_update', row.duration);
      }
    });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Login endpoint
app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }

  const token = jwt.sign({ role: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
  res.json({ token });
});

// Protected admin API endpoint
app.post('/api/set-duration', authenticateToken, (req, res) => {
  const { duration } = req.body;
  if (!duration || isNaN(duration)) {
    return res.status(400).json({ error: 'Invalid duration' });
  }

  db.run(
    'INSERT INTO countdown_settings (duration) VALUES (?)',
    [duration],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      io.emit('duration_update', duration);
      res.json({ success: true });
    }
  );
});

// Start timer endpoint
app.post('/api/start-timer', authenticateToken, (req, res) => {
  const { isActive } = req.body;
  io.emit('timer_control', { action: 'set_active', value: isActive });
  res.json({ success: true });
});

// Reset timer endpoint
app.post('/api/reset-timer', authenticateToken, (req, res) => {
  io.emit('timer_control', { action: 'reset' });
  res.json({ success: true });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
