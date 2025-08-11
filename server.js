const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'mu_online_idle_mmo_secret_key_2024';
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL Database setup for Railway
const dbConfig = {
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'aoneymKedAyimncugWPdALaVPWAEdtFA',
  database: process.env.MYSQLDATABASE || 'railway',
  port: process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const db = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await db.getConnection();
    console.log('✅ Connected to Railway MySQL database successfully');
    console.log(`📍 Database: ${process.env.MYSQLHOST}:${process.env.MYSQLPORT}/${process.env.MYSQLDATABASE}`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Helper function for database queries
async function query(sql, params = []) {
  try {
    const [results] = await db.execute(sql, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'MuLegends.eu - MU Online Idle MMO Server is running!',
    status: 'active',
    timestamp: new Date().toISOString(),
    server: 'Railway Production'
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      // Test with a simple query
      const result = await query('SELECT COUNT(*) as count FROM users');
      res.json({ 
        status: 'healthy', 
        database: 'connected',
        server: 'MuLegends.eu Backend',
        userCount: result[0].count,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        error: 'Database connection failed'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      userId: result.insertId 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const users = await query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Character Routes
app.get('/api/characters/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const characters = await query(
      'SELECT * FROM characters WHERE user_id = ?',
      [userId]
    );

    res.json(characters);

  } catch (error) {
    console.error('Get characters error:', error);
    res.status(500).json({ error: 'Failed to get characters' });
  }
});

app.post('/api/character/create', authenticateToken, async (req, res) => {
  try {
    const { name, characterClass } = req.body;
    const userId = req.user.userId;

    if (!name || !characterClass) {
      return res.status(400).json({ error: 'Name and class required' });
    }

    // Check if character name exists
    const existing = await query(
      'SELECT id FROM characters WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Character name already exists' });
    }

    // Create character
    const result = await query(
      'INSERT INTO characters (user_id, name, class) VALUES (?, ?, ?)',
      [userId, name, characterClass]
    );

    // Get the created character
    const newCharacter = await query(
      'SELECT * FROM characters WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'Character created successfully',
      character: newCharacter[0]
    });

  } catch (error) {
    console.error('Create character error:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

app.get('/api/character/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const characters = await query(
      'SELECT * FROM characters WHERE id = ?',
      [id]
    );

    if (characters.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json(characters[0]);

  } catch (error) {
    console.error('Get character error:', error);
    res.status(500).json({ error: 'Failed to get character' });
  }
});

// Inventory endpoints
app.get('/api/inventory/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    // Get character items from database
    const items = await query(`
      SELECT ci.*, i.name, i.type, i.rarity, i.min_damage, i.max_damage, i.defense
      FROM character_items ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = ? AND ci.equipped = 0
    `, [characterId]);
    
    res.json(items);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

app.get('/api/equipment/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    // Get equipped items
    const equipment = await query(`
      SELECT ci.*, i.name, i.type, i.subtype, i.min_damage, i.max_damage, i.defense
      FROM character_items ci
      JOIN items i ON ci.item_id = i.id
      WHERE ci.character_id = ? AND ci.equipped = 1
    `, [characterId]);
    
    res.json(equipment);
  } catch (error) {
    console.error('Get equipment error:', error);
    res.status(500).json({ error: 'Failed to get equipment' });
  }
});

app.get('/api/character-stats/:characterId', authenticateToken, async (req, res) => {
  try {
    const { characterId } = req.params;
    
    const character = await query(
      'SELECT level, experience, health, mana, strength, agility, vitality, energy FROM characters WHERE id = ?',
      [characterId]
    );
    
    if (character.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    res.json(character[0]);
  } catch (error) {
    console.error('Get character stats error:', error);
    res.status(500).json({ error: 'Failed to get character stats' });
  }
});

// Equip item endpoint
app.post('/api/equip', authenticateToken, async (req, res) => {
  try {
    const { characterId, itemId } = req.body;
    
    // Update item as equipped
    await query(
      'UPDATE character_items SET equipped = 1 WHERE character_id = ? AND id = ?',
      [characterId, itemId]
    );
    
    res.json({ message: 'Item equipped successfully' });
  } catch (error) {
    console.error('Equip item error:', error);
    res.status(500).json({ error: 'Failed to equip item' });
  }
});

// Socket.IO connections
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });

  socket.on('join-game', (data) => {
    console.log('🎮 User joined game:', data);
    socket.emit('game-joined', { status: 'success' });
  });
});

// Start server
const startServer = async () => {
  console.log('🚀 Starting MuLegends.eu Server...');
  
  // Test database connection
  const isConnected = await testConnection();
  
  if (!isConnected) {
    console.error('❌ Failed to connect to database. Please check your database configuration.');
    console.error('Database config:', {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    process.exit(1);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎮 MuLegends.eu Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📍 Database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    console.log(`⚔️ Ready for players!`);
  });
};

startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
