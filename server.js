const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
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

// MySQL Database setup
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'idle_mmo_game',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const db = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
  try {
    const connection = await db.getConnection();
    console.log('✅ Connected to MySQL database successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Error connecting to MySQL database:', error.message);
    process.exit(1);
  }
}

// Initialize database tables
async function initializeDatabase() {
  try {
    console.log('🔧 Initializing database tables...');
    
    // Note: Table creation is handled by the mysql_schema.sql file
    // This function can be used for additional initialization if needed
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Helper function to execute queries
async function executeQuery(query, params = []) {
  try {
    const [results] = await db.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function for single row queries
async function executeQuerySingle(query, params = []) {
  try {
    const [results] = await db.execute(query, params);
    return results[0] || null;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Characters table with MU Online classes
  db.run(`CREATE TABLE IF NOT EXISTS characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    strength INTEGER DEFAULT 10,
    agility INTEGER DEFAULT 10,
    vitality INTEGER DEFAULT 10,
    energy INTEGER DEFAULT 10,
    command INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 50,
    current_map TEXT DEFAULT 'Lorencia',
    x INTEGER DEFAULT 130,
    y INTEGER DEFAULT 125,
    zen INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Items table - Enhanced for equipment system
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    enhancement INTEGER DEFAULT 0,
    durability INTEGER DEFAULT 100,
    max_durability INTEGER DEFAULT 100,
    equipped BOOLEAN DEFAULT FALSE,
    slot TEXT,
    damage_min INTEGER DEFAULT 0,
    damage_max INTEGER DEFAULT 0,
    defense INTEGER DEFAULT 0,
    required_level INTEGER DEFAULT 1,
    required_strength INTEGER DEFAULT 0,
    required_agility INTEGER DEFAULT 0,
    required_vitality INTEGER DEFAULT 0,
    required_energy INTEGER DEFAULT 0,
    options TEXT,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // Skills table
  db.run(`CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    skill_name TEXT NOT NULL,
    skill_level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // Guilds table
  db.run(`CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    master_id INTEGER,
    logo TEXT,
    notice TEXT,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    zen INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (master_id) REFERENCES characters (id)
  )`);

  // Guild members table
  db.run(`CREATE TABLE IF NOT EXISTS guild_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER,
    character_id INTEGER,
    rank TEXT DEFAULT 'Member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id),
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // PvP logs table
  db.run(`CREATE TABLE IF NOT EXISTS pvp_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attacker_id INTEGER,
    defender_id INTEGER,
    winner_id INTEGER,
    damage_dealt INTEGER,
    zen_gained INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attacker_id) REFERENCES characters (id),
    FOREIGN KEY (defender_id) REFERENCES characters (id),
    FOREIGN KEY (winner_id) REFERENCES characters (id)
  )`);

  // Update characters table with PvP stats (safely add columns if they don't exist)
  db.serialize(() => {
    db.all("PRAGMA table_info(characters)", (err, columns) => {
      if (err) return;
      
      const existingColumns = columns.map(col => col.name);
      
      if (!existingColumns.includes('kills')) {
        db.run(`ALTER TABLE characters ADD COLUMN kills INTEGER DEFAULT 0`);
      }
      if (!existingColumns.includes('deaths')) {
        db.run(`ALTER TABLE characters ADD COLUMN deaths INTEGER DEFAULT 0`);
      }
      if (!existingColumns.includes('guild_id')) {
        db.run(`ALTER TABLE characters ADD COLUMN guild_id INTEGER DEFAULT NULL`);
      }
      if (!existingColumns.includes('pk_level')) {
        db.run(`ALTER TABLE characters ADD COLUMN pk_level INTEGER DEFAULT 0`);
      }
      if (!existingColumns.includes('reset_count')) {
        db.run(`ALTER TABLE characters ADD COLUMN reset_count INTEGER DEFAULT 0`);
      }
    });
  });

  // Hunting logs
  db.run(`CREATE TABLE IF NOT EXISTS hunting_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    monster_name TEXT NOT NULL,
    experience_gained INTEGER,
    zen_gained INTEGER,
    items_found TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // PvP Arena System
  db.run(`CREATE TABLE IF NOT EXISTS arena_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER,
    player2_id INTEGER,
    winner_id INTEGER,
    player1_damage INTEGER DEFAULT 0,
    player2_damage INTEGER DEFAULT 0,
    zen_reward INTEGER DEFAULT 0,
    exp_reward INTEGER DEFAULT 0,
    match_duration INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES characters (id),
    FOREIGN KEY (player2_id) REFERENCES characters (id),
    FOREIGN KEY (winner_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS arena_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER UNIQUE,
    level_min INTEGER,
    level_max INTEGER,
    queue_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // Guild System
  db.run(`CREATE TABLE IF NOT EXISTS guilds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    master_id INTEGER,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    zen INTEGER DEFAULT 0,
    max_members INTEGER DEFAULT 20,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (master_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS guild_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER,
    character_id INTEGER UNIQUE,
    rank TEXT DEFAULT 'Member',
    contribution INTEGER DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds (id),
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // Chat System
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    character_name TEXT,
    channel TEXT DEFAULT 'global',
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS private_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    sender_name TEXT,
    receiver_name TEXT,
    message TEXT NOT NULL,
    read_status INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES characters (id),
    FOREIGN KEY (receiver_id) REFERENCES characters (id)
  )`);

  // Advanced Features - Item Enhancement
  db.run(`CREATE TABLE IF NOT EXISTS enhancement_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    item_id INTEGER,
    enhancement_type TEXT,
    success INTEGER DEFAULT 0,
    cost INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id),
    FOREIGN KEY (item_id) REFERENCES items (id)
  )`);

  // Trading System
  db.run(`CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER,
    buyer_id INTEGER,
    item_id INTEGER,
    price INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (seller_id) REFERENCES characters (id),
    FOREIGN KEY (buyer_id) REFERENCES characters (id),
    FOREIGN KEY (item_id) REFERENCES items (id)
  )`);

  // ==================== ADVANCED FEATURES TABLES ====================

  // Advanced Inventory Management
  db.run(`CREATE TABLE IF NOT EXISTS character_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    item_name TEXT,
    item_type TEXT,
    rarity TEXT,
    slot_position INTEGER,
    quantity INTEGER DEFAULT 1,
    stats TEXT, -- JSON string for item stats
    equipped BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // Tournaments System
  db.run(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'single_elimination',
    max_participants INTEGER DEFAULT 16,
    status TEXT DEFAULT 'scheduled',
    start_time DATETIME,
    end_time DATETIME,
    winner_id INTEGER,
    prize_pool INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (winner_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER,
    user_id INTEGER,
    character_id INTEGER,
    eliminated BOOLEAN DEFAULT FALSE,
    final_rank INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER,
    round INTEGER,
    match_order INTEGER,
    player1_id INTEGER,
    player2_id INTEGER,
    winner_id INTEGER,
    status TEXT DEFAULT 'pending',
    scheduled_time DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (tournament_id) REFERENCES tournaments (id),
    FOREIGN KEY (player1_id) REFERENCES characters (id),
    FOREIGN KEY (player2_id) REFERENCES characters (id),
    FOREIGN KEY (winner_id) REFERENCES characters (id)
  )`);

  // Guild Wars System
  db.run(`CREATE TABLE IF NOT EXISTS guild_wars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild1_id INTEGER,
    guild2_id INTEGER,
    declared_by INTEGER,
    status TEXT DEFAULT 'pending',
    start_time DATETIME,
    end_time DATETIME,
    guild1_score INTEGER DEFAULT 0,
    guild2_score INTEGER DEFAULT 0,
    winner_guild_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild1_id) REFERENCES guilds (id),
    FOREIGN KEY (guild2_id) REFERENCES guilds (id),
    FOREIGN KEY (declared_by) REFERENCES characters (id),
    FOREIGN KEY (winner_guild_id) REFERENCES guilds (id)
  )`);

  // PvP Rankings System
  db.run(`CREATE TABLE IF NOT EXISTS pvp_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER UNIQUE,
    rank_name TEXT DEFAULT 'Bronze',
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_streak INTEGER DEFAULT 0,
    season INTEGER DEFAULT 1,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pvp_battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER,
    player2_id INTEGER,
    winner_id INTEGER,
    player1_points_before INTEGER,
    player2_points_before INTEGER,
    player1_points_after INTEGER,
    player2_points_after INTEGER,
    battle_type TEXT DEFAULT 'ranked',
    duration INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES characters (id),
    FOREIGN KEY (player2_id) REFERENCES characters (id),
    FOREIGN KEY (winner_id) REFERENCES characters (id)
  )`);

  // Events System
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'scheduled',
    start_time DATETIME,
    end_time DATETIME,
    rewards TEXT, -- JSON string
    requirements TEXT, -- JSON string
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS character_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    event_id INTEGER,
    participation_status TEXT DEFAULT 'registered',
    progress INTEGER DEFAULT 0,
    rewards_claimed BOOLEAN DEFAULT FALSE,
    participated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id),
    FOREIGN KEY (event_id) REFERENCES events (id)
  )`);

  // Quests System
  db.run(`CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'daily',
    category TEXT DEFAULT 'general',
    objectives TEXT, -- JSON string
    rewards TEXT, -- JSON string
    required_level INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS character_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    quest_id INTEGER,
    status TEXT DEFAULT 'active',
    progress INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id),
    FOREIGN KEY (quest_id) REFERENCES quests (id)
  )`);

  // Social Features
  db.run(`CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    friend_id INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME,
    FOREIGN KEY (character_id) REFERENCES characters (id),
    FOREIGN KEY (friend_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    icon TEXT,
    requirements TEXT, -- JSON string
    rewards TEXT, -- JSON string
    points INTEGER DEFAULT 0,
    hidden BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS character_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    achievement_id INTEGER,
    progress INTEGER DEFAULT 0,
    unlocked_at DATETIME,
    FOREIGN KEY (character_id) REFERENCES characters (id),
    FOREIGN KEY (achievement_id) REFERENCES achievements (id)
  )`);

  // Crafting System
  db.run(`CREATE TABLE IF NOT EXISTS crafting_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    result_item TEXT,
    required_level INTEGER DEFAULT 1,
    success_rate REAL DEFAULT 1.0,
    experience_reward INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recipe_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER,
    material_name TEXT,
    quantity_required INTEGER,
    FOREIGN KEY (recipe_id) REFERENCES crafting_recipes (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS character_crafting (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER UNIQUE,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS crafting_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    recipe_id INTEGER,
    materials_used TEXT, -- JSON string
    result TEXT,
    experience_gained INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id),
    FOREIGN KEY (recipe_id) REFERENCES crafting_recipes (id)
  )`);

  // Analytics & Progression
  db.run(`CREATE TABLE IF NOT EXISTS character_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    skill_name TEXT,
    level INTEGER DEFAULT 1,
    experience INTEGER DEFAULT 0,
    max_level INTEGER DEFAULT 100,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS play_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_end DATETIME,
    duration INTEGER, -- in seconds
    activities TEXT, -- JSON string of activities during session
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS combat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    enemy_name TEXT,
    enemy_type TEXT,
    result TEXT, -- 'victory', 'defeat', 'draw'
    damage_dealt INTEGER DEFAULT 0,
    damage_received INTEGER DEFAULT 0,
    experience_gained INTEGER DEFAULT 0,
    loot_gained TEXT, -- JSON string
    location TEXT,
    duration INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // Chat Messages System
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER,
    character_name TEXT,
    channel TEXT DEFAULT 'general',
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters (id)
  )`);

  // Insert default data
  db.run(`INSERT OR IGNORE INTO events (name, description, type, status, start_time, end_time, rewards, priority) VALUES 
    ('Double EXP Weekend', 'Earn double experience from all activities', 'boost', 'active', datetime('now', '-1 day'), datetime('now', '+2 days'), '{"exp_multiplier": 2}', 5),
    ('Treasure Hunt', 'Find hidden treasures around the world', 'collection', 'active', datetime('now', '-6 hours'), datetime('now', '+18 hours'), '{"zen": 5000, "items": ["Magic Ring"]}', 3)`);

  db.run(`INSERT OR IGNORE INTO quests (name, description, type, category, objectives, rewards, priority) VALUES 
    ('Defeat 50 Goblins', 'Hunt down goblins in the forest area', 'daily', 'combat', '{"kill_goblins": 50}', '{"exp": 5000, "zen": 500}', 5),
    ('Collect 10 Magic Crystals', 'Gather rare crystals from dungeon monsters', 'weekly', 'collection', '{"collect_crystals": 10}', '{"item": "Magic Sword +5"}', 8)`);

  db.run(`INSERT OR IGNORE INTO achievements (name, description, category, icon, requirements, rewards, points) VALUES 
    ('First Blood', 'Win your first PvP battle', 'pvp', '⚔️', '{"pvp_wins": 1}', '{"zen": 1000}', 10),
    ('Level Up', 'Reach level 10', 'progression', '📈', '{"level": 10}', '{"exp": 500}', 5),
    ('Guild Master', 'Create your own guild', 'social', '👑', '{"create_guild": 1}', '{"zen": 5000}', 25),
    ('Rich Player', 'Accumulate 1 million Zen', 'wealth', '💰', '{"total_zen": 1000000}', '{"item": "Wealth Ring"}', 50)`);

// JWT Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.userId = user.userId;
    req.username = user.username;
    next();
  });
}

// MU Online Game Data
const MU_CLASSES = {
  'Dark Knight': {
    stats: { str: 28, agi: 20, vit: 25, ene: 10, cmd: 0 },
    description: 'A powerful warrior skilled in close combat and swordsmanship'
  },
  'Dark Wizard': {
    stats: { str: 18, agi: 18, vit: 15, ene: 30, cmd: 0 },
    description: 'Master of elemental magic and powerful spells'
  },
  'Fairy Elf': {
    stats: { str: 22, agi: 25, vit: 20, ene: 15, cmd: 0 },
    description: 'Agile archer with nature magic abilities'
  },
  'Magic Gladiator': {
    stats: { str: 26, agi: 26, vit: 26, ene: 16, cmd: 0 },
    description: 'Hybrid warrior-mage with balanced combat skills'
  },
  'Dark Lord': {
    stats: { str: 26, agi: 20, vit: 20, ene: 15, cmd: 25 },
    description: 'Commander with leadership abilities and pet summoning'
  },
  'Summoner': {
    stats: { str: 21, agi: 21, vit: 18, ene: 23, cmd: 0 },
    description: 'Mystical spellcaster with curse and support magic'
  }
};

const MU_MAPS = {
  'Lorencia': {
    level_range: [1, 50],
    monsters: ['Goblin', 'Orc', 'Skeleton', 'Spider', 'Elite Orc', 'Orc Archer'],
    safe_zone: true,
    description: 'Peaceful grasslands perfect for new warriors',
    type: 'Beginner Zone'
  },
  'Noria': {
    level_range: [20, 80],
    monsters: ['Budge Dragon', 'Mutant', 'Ghost', 'Death Knight', 'Larva', 'Hell Hound'],
    safe_zone: true,
    description: 'Desert town with mysterious creatures',
    type: 'Intermediate Zone'
  },
  'Devias': {
    level_range: [40, 120],
    monsters: ['Yeti', 'Elite Orc', 'Forest Orc', 'Red Skeleton', 'Satyr', 'Cyclops'],
    safe_zone: true,
    description: 'Forest highlands with dangerous beasts',
    type: 'Advanced Zone'
  },
  'Dungeon': {
    level_range: [50, 150],
    monsters: ['Cyclops', 'Hell Hound', 'Poison Bull', 'Thunder Lich', 'Dark Knight', 'Gorgon'],
    safe_zone: false,
    description: 'Dark underground labyrinth',
    type: 'Dungeon'
  },
  'Atlans': {
    level_range: [80, 200],
    monsters: ['Tantalos', 'Beam Knight', 'Mutant Captain', 'Death Beam Knight', 'Metal Balrog', 'Gorgon'],
    safe_zone: false,
    description: 'Underwater city of ancient technology',
    type: 'High Level Zone'
  },
  'Tarkan': {
    level_range: [100, 250],
    monsters: ['Lizard King', 'Fire Golem', 'Queen Bee', 'Poison Golem', 'Metal Balrog', 'Dragon'],
    safe_zone: false,
    description: 'Volcanic wasteland of fire and stone',
    type: 'Expert Zone'
  },
  'Ice Wind Valley': {
    level_range: [120, 280],
    monsters: ['Ice Giant', 'Coolutin', 'Iron Wheel', 'Gigantis', 'Yeti', 'Ice Queen'],
    safe_zone: false,
    description: 'Frozen valley with ancient ice magic',
    type: 'Master Zone'
  },
  'Vulcanus': {
    level_range: [150, 320],
    monsters: ['Death Centurion', 'Necron', 'Schriker', 'Illusion of Kundun', 'Death Angel', 'Balrog'],
    safe_zone: false,
    description: 'Hellish realm of fire and death',
    type: 'Hell Zone'
  },
  'Karutan': {
    level_range: [180, 350],
    monsters: ['Condra', 'Narcondra', 'Crypta', 'Crypos', 'Death Angel', 'Hydra'],
    safe_zone: false,
    description: 'Ancient temple ruins with powerful guardians',
    type: 'Ancient Zone'
  },
  'Aida': {
    level_range: [200, 380],
    monsters: ['Maya Left Hand', 'Maya Right Hand', 'Persona', 'Doppelganger', 'Aegis', 'Rohан'],
    safe_zone: false,
    description: 'Mystical dimension of magic and illusion',
    type: 'Dimensional Zone'
  },
  'Crywolf': {
    level_range: [250, 400],
    monsters: ['Balgass', 'Death Spirit', 'Soram', 'Dark Elf', 'Balram', 'Wolf Soul'],
    safe_zone: false,
    description: 'Fortress under siege by dark forces',
    type: 'Siege Zone'
  },
  'Kanturu': {
    level_range: [300, 450],
    monsters: ['Berserker', 'Splinter Wolf', 'Iron Rider', 'Satyros', 'Blade Hunter', 'Nightmare'],
    safe_zone: false,
    description: 'Nightmare realm of twisted creatures',
    type: 'Nightmare Zone'
  },
  'Raklion': {
    level_range: [350, 500],
    monsters: ['Selupan', 'Perseos', 'Drakan', 'Great Drakan', 'Gigantis', 'Ice Napin'],
    safe_zone: false,
    description: 'Dragon territory with ancient wyrms',
    type: 'Dragon Zone'
  },
  'Swamp of Peace': {
    level_range: [400, 550],
    monsters: ['Orc Fighter', 'Orc Lancer', 'Ghost Napin', 'Blaze Napin', 'Thunder Napin', 'Shadow Master'],
    safe_zone: false,
    description: 'Corrupted wetlands of dark magic',
    type: 'Corrupted Zone'
  },
  'Silent Map': {
    level_range: [450, 600],
    monsters: ['Silion', 'Weapon Silion', 'Armor Silion', 'Golem Silion', 'Berserker Silion', 'Shadow Phantom'],
    safe_zone: false,
    description: 'Void dimension where sound itself dies',
    type: 'Void Zone'
  }
};

const MU_MONSTERS = {
  // Lorencia Monsters
  'Goblin': { hp: 30, exp: 15, zen: 3, level: 5, drops: ['Short Sword', 'Leather Helm'] },
  'Orc': { hp: 80, exp: 35, zen: 8, level: 12, drops: ['Chain Lightning', 'Leather Armor'] },
  'Skeleton': { hp: 120, exp: 50, zen: 12, level: 18, drops: ['Kris', 'Bronze Armor'] },
  'Spider': { hp: 150, exp: 70, zen: 15, level: 25, drops: ['Rapier', 'Pad Armor'] },
  'Elite Orc': { hp: 200, exp: 95, zen: 20, level: 30, drops: ['Blade', 'Bone Armor'] },
  'Orc Archer': { hp: 180, exp: 85, zen: 18, level: 28, drops: ['Short Bow', 'Leather Gloves'] },
  
  // Noria Monsters
  'Budge Dragon': { hp: 300, exp: 150, zen: 35, level: 40, drops: ['Dragon Blade', 'Scale Armor'] },
  'Mutant': { hp: 450, exp: 220, zen: 50, level: 55, drops: ['Serpent Spear', 'Bronze Boots'] },
  'Ghost': { hp: 600, exp: 300, zen: 70, level: 70, drops: ['Legendary Staff', 'Pad Helm'] },
  'Death Knight': { hp: 800, exp: 400, zen: 95, level: 85, drops: ['Knight Blade', 'Knight Armor'] },
  'Larva': { hp: 350, exp: 175, zen: 40, level: 45, drops: ['Lightning Sword', 'Vine Armor'] },
  'Hell Hound': { hp: 750, exp: 375, zen: 85, level: 80, drops: ['Salamander Shield', 'Bone Helm'] },
  
  // Devias Monsters
  'Yeti': { hp: 1200, exp: 600, zen: 140, level: 100, drops: ['Ice Blade', 'Scale Mail'] },
  'Forest Orc': { hp: 1000, exp: 500, zen: 120, level: 90, drops: ['Elven Bow', 'Leather Boots'] },
  'Red Skeleton': { hp: 1100, exp: 550, zen: 130, level: 95, drops: ['Crystal Sword', 'Bone Armor'] },
  'Satyr': { hp: 1350, exp: 675, zen: 155, level: 105, drops: ['Horn of Fenrir', 'Vine Gloves'] },
  'Cyclops': { hp: 2500, exp: 1200, zen: 280, level: 140, drops: ['Giant Trident', 'Bronze Shield'] },
  
  // Dungeon Monsters
  'Poison Bull': { hp: 2000, exp: 1000, zen: 230, level: 120, drops: ['Poison Sword', 'Scale Gloves'] },
  'Thunder Lich': { hp: 2200, exp: 1100, zen: 250, level: 130, drops: ['Thunder Staff', 'Pad Shield'] },
  'Dark Knight': { hp: 2800, exp: 1400, zen: 320, level: 150, drops: ['Dark Breaker', 'Dark Armor'] },
  'Gorgon': { hp: 3200, exp: 1600, zen: 370, level: 160, drops: ['Medusa Shield', 'Stone Armor'] },
  
  // Atlans Monsters
  'Tantalos': { hp: 5000, exp: 2500, zen: 600, level: 200, drops: ['Atlantis Staff', 'Neptune Armor'] },
  'Beam Knight': { hp: 4500, exp: 2250, zen: 550, level: 190, drops: ['Beam Sword', 'Crystal Armor'] },
  'Mutant Captain': { hp: 5500, exp: 2750, zen: 650, level: 210, drops: ['Captain Blade', 'War Armor'] },
  'Death Beam Knight': { hp: 6000, exp: 3000, zen: 700, level: 220, drops: ['Death Beam', 'Phantom Armor'] },
  'Metal Balrog': { hp: 7000, exp: 3500, zen: 800, level: 240, drops: ['Balrog Mace', 'Metal Shield'] },
  
  // Tarkan Monsters
  'Lizard King': { hp: 8000, exp: 4000, zen: 950, level: 250, drops: ['Lizard Scale Shield', 'Dragon Armor'] },
  'Fire Golem': { hp: 9000, exp: 4500, zen: 1100, level: 270, drops: ['Fire Sword', 'Magma Armor'] },
  'Queen Bee': { hp: 7500, exp: 3750, zen: 900, level: 245, drops: ['Sting Sword', 'Honey Armor'] },
  'Poison Golem': { hp: 8500, exp: 4250, zen: 1000, level: 260, drops: ['Poison Mace', 'Toxic Shield'] },
  'Dragon': { hp: 12000, exp: 6000, zen: 1500, level: 300, drops: ['Dragon Slayer', 'Dragon Scale Mail'] },
  
  // Ice Wind Valley Monsters
  'Ice Giant': { hp: 15000, exp: 7500, zen: 1800, level: 320, drops: ['Frost Mourne', 'Ice Crystal Armor'] },
  'Coolutin': { hp: 13000, exp: 6500, zen: 1600, level: 310, drops: ['Ice Scepter', 'Frozen Shield'] },
  'Iron Wheel': { hp: 14000, exp: 7000, zen: 1700, level: 315, drops: ['Iron Wheel Shield', 'Mechanic Armor'] },
  'Gigantis': { hp: 18000, exp: 9000, zen: 2200, level: 350, drops: ['Giant Sword', 'Titan Armor'] },
  'Ice Queen': { hp: 25000, exp: 12500, zen: 3000, level: 400, drops: ['Ice Queen Staff', 'Crystal Crown'] },
  
  // Vulcanus Monsters
  'Death Centurion': { hp: 20000, exp: 10000, zen: 2500, level: 380, drops: ['Centurion Spear', 'Legion Armor'] },
  'Necron': { hp: 22000, exp: 11000, zen: 2700, level: 390, drops: ['Necron Mace', 'Death Armor'] },
  'Schriker': { hp: 24000, exp: 12000, zen: 2900, level: 395, drops: ['Schriker Axe', 'Berserker Mail'] },
  'Illusion of Kundun': { hp: 30000, exp: 15000, zen: 3600, level: 420, drops: ['Kundun Staff', 'Illusion Robe'] },
  'Death Angel': { hp: 28000, exp: 14000, zen: 3400, level: 410, drops: ['Angel Blade', 'Seraph Wings'] },
  'Balrog': { hp: 35000, exp: 17500, zen: 4200, level: 450, drops: ['Balrog Blade', 'Demon Armor'] },
  
  // Karutan Monsters
  'Condra': { hp: 32000, exp: 16000, zen: 3800, level: 430, drops: ['Condra Staff', 'Maya Helm'] },
  'Narcondra': { hp: 34000, exp: 17000, zen: 4000, level: 440, drops: ['Narcondra Bow', 'Maya Armor'] },
  'Crypta': { hp: 36000, exp: 18000, zen: 4300, level: 460, drops: ['Crypta Sword', 'Ancient Shield'] },
  'Crypos': { hp: 38000, exp: 19000, zen: 4500, level: 470, drops: ['Crypos Mace', 'Temple Armor'] },
  'Hydra': { hp: 45000, exp: 22500, zen: 5400, level: 500, drops: ['Hydra Bow', 'Multi-Head Helm'] },
  
  // Aida Monsters
  'Maya Left Hand': { hp: 40000, exp: 20000, zen: 4800, level: 480, drops: ['Maya Left Hand', 'Mystical Armor'] },
  'Maya Right Hand': { hp: 42000, exp: 21000, zen: 5000, level: 490, drops: ['Maya Right Hand', 'Divine Shield'] },
  'Persona': { hp: 44000, exp: 22000, zen: 5200, level: 495, drops: ['Persona Mask', 'Soul Armor'] },
  'Doppelganger': { hp: 46000, exp: 23000, zen: 5500, level: 505, drops: ['Mirror Blade', 'Reflection Mail'] },
  'Aegis': { hp: 48000, exp: 24000, zen: 5800, level: 510, drops: ['Aegis Shield', 'Guardian Armor'] },
  'Rohан': { hp: 50000, exp: 25000, zen: 6000, level: 520, drops: ['Rohan Spear', 'Royal Armor'] },
  
  // Crywolf Monsters
  'Balgass': { hp: 55000, exp: 27500, zen: 6600, level: 540, drops: ['Balgass Axe', 'Wolf Armor'] },
  'Death Spirit': { hp: 52000, exp: 26000, zen: 6200, level: 530, drops: ['Spirit Sword', 'Ghost Mail'] },
  'Soram': { hp: 58000, exp: 29000, zen: 7000, level: 550, drops: ['Soram Blade', 'War Chief Armor'] },
  'Dark Elf': { hp: 53000, exp: 26500, zen: 6400, level: 535, drops: ['Elf Bow', 'Shadow Cloak'] },
  'Balram': { hp: 60000, exp: 30000, zen: 7200, level: 560, drops: ['Balram Mace', 'Fortress Shield'] },
  'Wolf Soul': { hp: 65000, exp: 32500, zen: 7800, level: 580, drops: ['Soul Blade', 'Alpha Armor'] },
  
  // Kanturu Monsters
  'Berserker': { hp: 70000, exp: 35000, zen: 8400, level: 600, drops: ['Berserker Axe', 'Rage Armor'] },
  'Splinter Wolf': { hp: 68000, exp: 34000, zen: 8100, level: 590, drops: ['Wolf Claw', 'Pack Leader Mail'] },
  'Iron Rider': { hp: 72000, exp: 36000, zen: 8600, level: 610, drops: ['Iron Lance', 'Cavalry Armor'] },
  'Satyros': { hp: 75000, exp: 37500, zen: 9000, level: 620, drops: ['Horn Spear', 'Beast Armor'] },
  'Blade Hunter': { hp: 78000, exp: 39000, zen: 9400, level: 635, drops: ['Hunter Blade', 'Stalker Mail'] },
  'Nightmare': { hp: 85000, exp: 42500, zen: 10200, level: 650, drops: ['Nightmare Sword', 'Dream Armor'] },
  
  // Raklion Monsters
  'Selupan': { hp: 90000, exp: 45000, zen: 10800, level: 670, drops: ['Selupan Staff', 'Dragon Scale Shield'] },
  'Perseos': { hp: 88000, exp: 44000, zen: 10500, level: 660, drops: ['Perseos Blade', 'Wyvern Armor'] },
  'Drakan': { hp: 95000, exp: 47500, zen: 11400, level: 690, drops: ['Drakan Claw', 'Drake Mail'] },
  'Great Drakan': { hp: 120000, exp: 60000, zen: 14400, level: 750, drops: ['Great Dragon Sword', 'Ancient Dragon Armor'] },
  'Ice Napin': { hp: 85000, exp: 42500, zen: 10200, level: 650, drops: ['Ice Crystal Staff', 'Frozen Mail'] },
  
  // Swamp of Peace Monsters
  'Orc Fighter': { hp: 100000, exp: 50000, zen: 12000, level: 720, drops: ['War Hammer', 'Battle Armor'] },
  'Orc Lancer': { hp: 105000, exp: 52500, zen: 12600, level: 740, drops: ['Battle Lance', 'Spike Armor'] },
  'Ghost Napin': { hp: 98000, exp: 49000, zen: 11800, level: 710, drops: ['Ghost Staff', 'Spectral Robes'] },
  'Blaze Napin': { hp: 110000, exp: 55000, zen: 13200, level: 760, drops: ['Fire Staff', 'Flame Armor'] },
  'Thunder Napin': { hp: 108000, exp: 54000, zen: 12900, level: 750, drops: ['Lightning Staff', 'Storm Mail'] },
  'Shadow Master': { hp: 125000, exp: 62500, zen: 15000, level: 800, drops: ['Shadow Blade', 'Master Armor'] },
  
  // Silent Map Monsters
  'Silion': { hp: 130000, exp: 65000, zen: 15600, level: 820, drops: ['Silence Sword', 'Void Armor'] },
  'Weapon Silion': { hp: 135000, exp: 67500, zen: 16200, level: 840, drops: ['Weapon Silion', 'Arsenal Mail'] },
  'Armor Silion': { hp: 140000, exp: 70000, zen: 16800, level: 860, drops: ['Armor Silion', 'Fortress Shield'] },
  'Golem Silion': { hp: 150000, exp: 75000, zen: 18000, level: 900, drops: ['Golem Core', 'Stone Giant Armor'] },
  'Berserker Silion': { hp: 160000, exp: 80000, zen: 19200, level: 950, drops: ['Berserker Silion', 'Rage Incarnate Mail'] },
  'Shadow Phantom': { hp: 200000, exp: 100000, zen: 24000, level: 1000, drops: ['Phantom Blade', 'Ethereal Armor'] }
};

// MU Online Items Database
const MU_ITEMS = {
  // === WEAPONS ===
  // Swords
  'Short Sword': { type: 'Weapon', slot: 'weapon', damage: [1, 4], reqLevel: 1, reqStr: 18, reqAgi: 0 },
  'Rapier': { type: 'Weapon', slot: 'weapon', damage: [4, 9], reqLevel: 8, reqStr: 40, reqAgi: 25 },
  'Katana': { type: 'Weapon', slot: 'weapon', damage: [6, 13], reqLevel: 15, reqStr: 65, reqAgi: 35 },
  'Sword of Assassin': { type: 'Weapon', slot: 'weapon', damage: [9, 16], reqLevel: 25, reqStr: 90, reqAgi: 45 },
  'Blade': { type: 'Weapon', slot: 'weapon', damage: [12, 19], reqLevel: 35, reqStr: 120, reqAgi: 0 },
  'Gladius': { type: 'Weapon', slot: 'weapon', damage: [15, 22], reqLevel: 45, reqStr: 145, reqAgi: 0 },
  'Falchion': { type: 'Weapon', slot: 'weapon', damage: [18, 25], reqLevel: 55, reqStr: 170, reqAgi: 0 },
  'Serpent Spear': { type: 'Weapon', slot: 'weapon', damage: [21, 28], reqLevel: 65, reqStr: 195, reqAgi: 0 },
  'Legendary Sword': { type: 'Weapon', slot: 'weapon', damage: [25, 32], reqLevel: 75, reqStr: 220, reqAgi: 0 },
  'Heliacal Sword': { type: 'Weapon', slot: 'weapon', damage: [28, 35], reqLevel: 85, reqStr: 245, reqAgi: 0 },
  'Double Blade': { type: 'Weapon', slot: 'weapon', damage: [31, 38], reqLevel: 95, reqStr: 270, reqAgi: 0 },
  'Lightning Sword': { type: 'Weapon', slot: 'weapon', damage: [35, 42], reqLevel: 105, reqStr: 295, reqAgi: 0 },
  'Giant Sword': { type: 'Weapon', slot: 'weapon', damage: [40, 47], reqLevel: 115, reqStr: 320, reqAgi: 0 },
  'Sword Breaker': { type: 'Weapon', slot: 'weapon', damage: [45, 52], reqLevel: 125, reqStr: 345, reqAgi: 0 },
  'Flamberge': { type: 'Weapon', slot: 'weapon', damage: [50, 57], reqLevel: 135, reqStr: 370, reqAgi: 0 },
  'Sword Dancer': { type: 'Weapon', slot: 'weapon', damage: [55, 62], reqLevel: 145, reqStr: 395, reqAgi: 0 },
  'Bone Blade': { type: 'Weapon', slot: 'weapon', damage: [60, 67], reqLevel: 155, reqStr: 420, reqAgi: 0 },
  'Explosion Blade': { type: 'Weapon', slot: 'weapon', damage: [65, 72], reqLevel: 165, reqStr: 445, reqAgi: 0 },
  'Daybreak': { type: 'Weapon', slot: 'weapon', damage: [78, 85], reqLevel: 180, reqStr: 470, reqAgi: 0 },
  'Knight Blade': { type: 'Weapon', slot: 'weapon', damage: [85, 92], reqLevel: 195, reqStr: 500, reqAgi: 0 },
  'Dark Breaker': { type: 'Weapon', slot: 'weapon', damage: [95, 102], reqLevel: 210, reqStr: 530, reqAgi: 0 },
  'Thunder Blade': { type: 'Weapon', slot: 'weapon', damage: [110, 120], reqLevel: 230, reqStr: 570, reqAgi: 0 },

  'Knight Blade': { type: 'Weapon', slot: 'weapon', damage: [85, 92], reqLevel: 195, reqStr: 500, reqAgi: 0 },
  'Dark Breaker': { type: 'Weapon', slot: 'weapon', damage: [95, 102], reqLevel: 210, reqStr: 530, reqAgi: 0 },
  'Thunder Blade': { type: 'Weapon', slot: 'weapon', damage: [110, 120], reqLevel: 230, reqStr: 570, reqAgi: 0 },

  // Axes
  'Small Axe': { type: 'Weapon', slot: 'weapon', damage: [1, 6], reqLevel: 1, reqStr: 22, reqAgi: 0 },
  'Hand Axe': { type: 'Weapon', slot: 'weapon', damage: [4, 11], reqLevel: 8, reqStr: 45, reqAgi: 0 },
  'Double Axe': { type: 'Weapon', slot: 'weapon', damage: [7, 14], reqLevel: 18, reqStr: 75, reqAgi: 0 },
  'Tomahawk': { type: 'Weapon', slot: 'weapon', damage: [11, 18], reqLevel: 28, reqStr: 105, reqAgi: 0 },
  'Elven Axe': { type: 'Weapon', slot: 'weapon', damage: [15, 22], reqLevel: 38, reqStr: 135, reqAgi: 0 },
  'Battle Axe': { type: 'Weapon', slot: 'weapon', damage: [19, 26], reqLevel: 48, reqStr: 165, reqAgi: 0 },
  'Nikkea Axe': { type: 'Weapon', slot: 'weapon', damage: [23, 30], reqLevel: 58, reqStr: 195, reqAgi: 0 },
  'Larkan Axe': { type: 'Weapon', slot: 'weapon', damage: [27, 34], reqLevel: 68, reqStr: 225, reqAgi: 0 },
  'Crescent Axe': { type: 'Weapon', slot: 'weapon', damage: [31, 38], reqLevel: 78, reqStr: 255, reqAgi: 0 },
  'Chaos Dragon Axe': { type: 'Weapon', slot: 'weapon', damage: [45, 55], reqLevel: 100, reqStr: 300, reqAgi: 0 },
  'Grand Soul Axe': { type: 'Weapon', slot: 'weapon', damage: [60, 70], reqLevel: 130, reqStr: 380, reqAgi: 0 },

  // Maces/Clubs
  'Mace': { type: 'Weapon', slot: 'weapon', damage: [3, 8], reqLevel: 5, reqStr: 35, reqAgi: 0 },
  'Morning Star': { type: 'Weapon', slot: 'weapon', damage: [8, 15], reqLevel: 15, reqStr: 65, reqAgi: 0 },
  'Flail': { type: 'Weapon', slot: 'weapon', damage: [12, 19], reqLevel: 25, reqStr: 95, reqAgi: 0 },
  'Great Hammer': { type: 'Weapon', slot: 'weapon', damage: [18, 28], reqLevel: 40, reqStr: 140, reqAgi: 0 },
  'Crystal Morning Star': { type: 'Weapon', slot: 'weapon', damage: [25, 35], reqLevel: 60, reqStr: 190, reqAgi: 0 },
  'Elemental Mace': { type: 'Weapon', slot: 'weapon', damage: [35, 45], reqLevel: 80, reqStr: 240, reqAgi: 0 },

  // Spears
  'Spear': { type: 'Weapon', slot: 'weapon', damage: [2, 7], reqLevel: 3, reqStr: 25, reqAgi: 15 },
  'Dragon Lance': { type: 'Weapon', slot: 'weapon', damage: [8, 16], reqLevel: 15, reqStr: 60, reqAgi: 25 },
  'Giant Trident': { type: 'Weapon', slot: 'weapon', damage: [15, 25], reqLevel: 30, reqStr: 100, reqAgi: 40 },
  'Serpent Spear': { type: 'Weapon', slot: 'weapon', damage: [22, 32], reqLevel: 50, reqStr: 150, reqAgi: 60 },
  'Bill of Balrog': { type: 'Weapon', slot: 'weapon', damage: [35, 50], reqLevel: 80, reqStr: 220, reqAgi: 80 },

  // Bows
  'Short Bow': { type: 'Weapon', slot: 'weapon', damage: [1, 4], reqLevel: 1, reqStr: 0, reqAgi: 20 },
  'Bow': { type: 'Weapon', slot: 'weapon', damage: [3, 7], reqLevel: 10, reqStr: 0, reqAgi: 50 },
  'Elven Bow': { type: 'Weapon', slot: 'weapon', damage: [6, 11], reqLevel: 20, reqStr: 0, reqAgi: 80 },
  'Battle Bow': { type: 'Weapon', slot: 'weapon', damage: [9, 15], reqLevel: 30, reqStr: 0, reqAgi: 110 },
  'Tiger Bow': { type: 'Weapon', slot: 'weapon', damage: [12, 19], reqLevel: 40, reqStr: 0, reqAgi: 140 },
  'Silver Bow': { type: 'Weapon', slot: 'weapon', damage: [15, 23], reqLevel: 50, reqStr: 0, reqAgi: 170 },
  'Chaos Nature Bow': { type: 'Weapon', slot: 'weapon', damage: [18, 27], reqLevel: 60, reqStr: 0, reqAgi: 200 },
  'Bolters Bow': { type: 'Weapon', slot: 'weapon', damage: [21, 31], reqLevel: 70, reqStr: 0, reqAgi: 230 },
  'Aquagold Crossbow': { type: 'Weapon', slot: 'weapon', damage: [24, 35], reqLevel: 80, reqStr: 0, reqAgi: 260 },
  'Divine Crossbow of Archangel': { type: 'Weapon', slot: 'weapon', damage: [35, 50], reqLevel: 120, reqStr: 0, reqAgi: 350 },

  // Crossbows
  'Crossbow': { type: 'Weapon', slot: 'weapon', damage: [4, 8], reqLevel: 8, reqStr: 30, reqAgi: 40 },
  'Golden Crossbow': { type: 'Weapon', slot: 'weapon', damage: [8, 14], reqLevel: 20, reqStr: 50, reqAgi: 70 },
  'Arquebus': { type: 'Weapon', slot: 'weapon', damage: [14, 22], reqLevel: 35, reqStr: 80, reqAgi: 110 },
  'Light Crossbow': { type: 'Weapon', slot: 'weapon', damage: [20, 30], reqLevel: 50, reqStr: 110, reqAgi: 150 },
  'Serpent Crossbow': { type: 'Weapon', slot: 'weapon', damage: [28, 40], reqLevel: 70, reqStr: 150, reqAgi: 200 },

  // Staffs (Wizard)
  'Skull Staff': { type: 'Weapon', slot: 'weapon', damage: [1, 4], reqLevel: 1, reqStr: 0, reqEne: 20 },
  'Angelic Staff': { type: 'Weapon', slot: 'weapon', damage: [3, 7], reqLevel: 10, reqStr: 0, reqEne: 50 },
  'Serpent Staff': { type: 'Weapon', slot: 'weapon', damage: [6, 11], reqLevel: 20, reqStr: 0, reqEne: 80 },
  'Lightning Staff': { type: 'Weapon', slot: 'weapon', damage: [9, 15], reqLevel: 30, reqStr: 0, reqEne: 110 },
  'Gorgon Staff': { type: 'Weapon', slot: 'weapon', damage: [12, 19], reqLevel: 40, reqStr: 0, reqEne: 140 },
  'Legendary Staff': { type: 'Weapon', slot: 'weapon', damage: [15, 23], reqLevel: 50, reqStr: 0, reqEne: 170 },
  'Resurrection Staff': { type: 'Weapon', slot: 'weapon', damage: [18, 27], reqLevel: 60, reqStr: 0, reqEne: 200 },
  'Platina Staff': { type: 'Weapon', slot: 'weapon', damage: [21, 31], reqLevel: 70, reqStr: 0, reqEne: 230 },
  'Mistery Staff': { type: 'Weapon', slot: 'weapon', damage: [24, 35], reqLevel: 80, reqStr: 0, reqEne: 260 },
  'Violent Wind Staff': { type: 'Weapon', slot: 'weapon', damage: [30, 45], reqLevel: 100, reqStr: 0, reqEne: 320 },
  'Staff of Resurrection': { type: 'Weapon', slot: 'weapon', damage: [40, 60], reqLevel: 130, reqStr: 0, reqEne: 400 },
  'Chaos Lightning Staff': { type: 'Weapon', slot: 'weapon', damage: [50, 75], reqLevel: 160, reqStr: 0, reqEne: 480 },

  'Chaos Lightning Staff': { type: 'Weapon', slot: 'weapon', damage: [50, 75], reqLevel: 160, reqStr: 0, reqEne: 480 },

  // === ARMOR SETS ===
  // Leather Set
  'Leather Armor': { type: 'Armor', slot: 'armor', defense: 4, reqLevel: 1, reqStr: 18 },
  'Leather Helm': { type: 'Helm', slot: 'helm', defense: 2, reqLevel: 1, reqStr: 18 },
  'Leather Pants': { type: 'Pants', slot: 'pants', defense: 3, reqLevel: 1, reqStr: 18 },
  'Leather Gloves': { type: 'Gloves', slot: 'gloves', defense: 1, reqLevel: 1, reqStr: 18 },
  'Leather Boots': { type: 'Boots', slot: 'boots', defense: 1, reqLevel: 1, reqStr: 18 },

  // Bronze Set
  'Bronze Armor': { type: 'Armor', slot: 'armor', defense: 8, reqLevel: 15, reqStr: 60 },
  'Bronze Helm': { type: 'Helm', slot: 'helm', defense: 4, reqLevel: 15, reqStr: 60 },
  'Bronze Pants': { type: 'Pants', slot: 'pants', defense: 6, reqLevel: 15, reqStr: 60 },
  'Bronze Gloves': { type: 'Gloves', slot: 'gloves', defense: 3, reqLevel: 15, reqStr: 60 },
  'Bronze Boots': { type: 'Boots', slot: 'boots', defense: 3, reqLevel: 15, reqStr: 60 },

  // Scale Set
  'Scale Armor': { type: 'Armor', slot: 'armor', defense: 14, reqLevel: 30, reqStr: 110 },
  'Scale Helm': { type: 'Helm', slot: 'helm', defense: 7, reqLevel: 30, reqStr: 110 },
  'Scale Pants': { type: 'Pants', slot: 'pants', defense: 10, reqLevel: 30, reqStr: 110 },
  'Scale Gloves': { type: 'Gloves', slot: 'gloves', defense: 5, reqLevel: 30, reqStr: 110 },
  'Scale Boots': { type: 'Boots', slot: 'boots', defense: 5, reqLevel: 30, reqStr: 110 },

  // Plate Set
  'Plate Armor': { type: 'Armor', slot: 'armor', defense: 20, reqLevel: 45, reqStr: 160 },
  'Plate Helm': { type: 'Helm', slot: 'helm', defense: 10, reqLevel: 45, reqStr: 160 },
  'Plate Pants': { type: 'Pants', slot: 'pants', defense: 15, reqLevel: 45, reqStr: 160 },
  'Plate Gloves': { type: 'Gloves', slot: 'gloves', defense: 8, reqLevel: 45, reqStr: 160 },
  'Plate Boots': { type: 'Boots', slot: 'boots', defense: 8, reqLevel: 45, reqStr: 160 },

  // Dragon Set
  'Dragon Armor': { type: 'Armor', slot: 'armor', defense: 28, reqLevel: 60, reqStr: 210 },
  'Dragon Helm': { type: 'Helm', slot: 'helm', defense: 14, reqLevel: 60, reqStr: 210 },
  'Dragon Pants': { type: 'Pants', slot: 'pants', defense: 21, reqLevel: 60, reqStr: 210 },
  'Dragon Gloves': { type: 'Gloves', slot: 'gloves', defense: 11, reqLevel: 60, reqStr: 210 },
  'Dragon Boots': { type: 'Boots', slot: 'boots', defense: 11, reqLevel: 60, reqStr: 210 },

  // Pad Set
  'Pad Armor': { type: 'Armor', slot: 'armor', defense: 12, reqLevel: 25, reqStr: 80 },
  'Pad Helm': { type: 'Helm', slot: 'helm', defense: 6, reqLevel: 25, reqStr: 80 },
  'Pad Pants': { type: 'Pants', slot: 'pants', defense: 9, reqLevel: 25, reqStr: 80 },
  'Pad Gloves': { type: 'Gloves', slot: 'gloves', defense: 4, reqLevel: 25, reqStr: 80 },
  'Pad Boots': { type: 'Boots', slot: 'boots', defense: 4, reqLevel: 25, reqStr: 80 },

  // Bone Set
  'Bone Armor': { type: 'Armor', slot: 'armor', defense: 18, reqLevel: 40, reqStr: 140 },
  'Bone Helm': { type: 'Helm', slot: 'helm', defense: 9, reqLevel: 40, reqStr: 140 },
  'Bone Pants': { type: 'Pants', slot: 'pants', defense: 13, reqLevel: 40, reqStr: 140 },
  'Bone Gloves': { type: 'Gloves', slot: 'gloves', defense: 7, reqLevel: 40, reqStr: 140 },
  'Bone Boots': { type: 'Boots', slot: 'boots', defense: 7, reqLevel: 40, reqStr: 140 },

  // Sphinx Set
  'Sphinx Armor': { type: 'Armor', slot: 'armor', defense: 24, reqLevel: 55, reqStr: 185 },
  'Sphinx Helm': { type: 'Helm', slot: 'helm', defense: 12, reqLevel: 55, reqStr: 185 },
  'Sphinx Pants': { type: 'Pants', slot: 'pants', defense: 18, reqLevel: 55, reqStr: 185 },
  'Sphinx Gloves': { type: 'Gloves', slot: 'gloves', defense: 9, reqLevel: 55, reqStr: 185 },
  'Sphinx Boots': { type: 'Boots', slot: 'boots', defense: 9, reqLevel: 55, reqStr: 185 },

  // Legendary Set
  'Legendary Armor': { type: 'Armor', slot: 'armor', defense: 32, reqLevel: 75, reqStr: 235 },
  'Legendary Helm': { type: 'Helm', slot: 'helm', defense: 16, reqLevel: 75, reqStr: 235 },
  'Legendary Pants': { type: 'Pants', slot: 'pants', defense: 24, reqLevel: 75, reqStr: 235 },
  'Legendary Gloves': { type: 'Gloves', slot: 'gloves', defense: 12, reqLevel: 75, reqStr: 235 },
  'Legendary Boots': { type: 'Boots', slot: 'boots', defense: 12, reqLevel: 75, reqStr: 235 },

  // Grand Soul Set
  'Grand Soul Armor': { type: 'Armor', slot: 'armor', defense: 38, reqLevel: 90, reqStr: 280 },
  'Grand Soul Helm': { type: 'Helm', slot: 'helm', defense: 19, reqLevel: 90, reqStr: 280 },
  'Grand Soul Pants': { type: 'Pants', slot: 'pants', defense: 28, reqLevel: 90, reqStr: 280 },
  'Grand Soul Gloves': { type: 'Gloves', slot: 'gloves', defense: 14, reqLevel: 90, reqStr: 280 },
  'Grand Soul Boots': { type: 'Boots', slot: 'boots', defense: 14, reqLevel: 90, reqStr: 280 },

  // Thunder Hawk Set
  'Thunder Hawk Armor': { type: 'Armor', slot: 'armor', defense: 44, reqLevel: 105, reqStr: 325 },
  'Thunder Hawk Helm': { type: 'Helm', slot: 'helm', defense: 22, reqLevel: 105, reqStr: 325 },
  'Thunder Hawk Pants': { type: 'Pants', slot: 'pants', defense: 32, reqLevel: 105, reqStr: 325 },
  'Thunder Hawk Gloves': { type: 'Gloves', slot: 'gloves', defense: 16, reqLevel: 105, reqStr: 325 },
  'Thunder Hawk Boots': { type: 'Boots', slot: 'boots', defense: 16, reqLevel: 105, reqStr: 325 },

  // Great Dragon Set
  'Great Dragon Armor': { type: 'Armor', slot: 'armor', defense: 50, reqLevel: 120, reqStr: 370 },
  'Great Dragon Helm': { type: 'Helm', slot: 'helm', defense: 25, reqLevel: 120, reqStr: 370 },
  'Great Dragon Pants': { type: 'Pants', slot: 'pants', defense: 36, reqLevel: 120, reqStr: 370 },
  'Great Dragon Gloves': { type: 'Gloves', slot: 'gloves', defense: 18, reqLevel: 120, reqStr: 370 },
  'Great Dragon Boots': { type: 'Boots', slot: 'boots', defense: 18, reqLevel: 120, reqStr: 370 },

  // Dark Phoenix Set
  'Dark Phoenix Armor': { type: 'Armor', slot: 'armor', defense: 56, reqLevel: 135, reqStr: 415 },
  'Dark Phoenix Helm': { type: 'Helm', slot: 'helm', defense: 28, reqLevel: 135, reqStr: 415 },
  'Dark Phoenix Pants': { type: 'Pants', slot: 'pants', defense: 40, reqLevel: 135, reqStr: 415 },
  'Dark Phoenix Gloves': { type: 'Gloves', slot: 'gloves', defense: 20, reqLevel: 135, reqStr: 415 },
  'Dark Phoenix Boots': { type: 'Boots', slot: 'boots', defense: 20, reqLevel: 135, reqStr: 415 },

  // Great Lord Set
  'Great Lord Armor': { type: 'Armor', slot: 'armor', defense: 62, reqLevel: 150, reqStr: 460 },
  'Great Lord Helm': { type: 'Helm', slot: 'helm', defense: 31, reqLevel: 150, reqStr: 460 },
  'Great Lord Pants': { type: 'Pants', slot: 'pants', defense: 44, reqLevel: 150, reqStr: 460 },
  'Great Lord Gloves': { type: 'Gloves', slot: 'gloves', defense: 22, reqLevel: 150, reqStr: 460 },
  'Great Lord Boots': { type: 'Boots', slot: 'boots', defense: 22, reqLevel: 150, reqStr: 460 },

  'Great Lord Boots': { type: 'Boots', slot: 'boots', defense: 22, reqLevel: 150, reqStr: 460 },

  // === SHIELDS ===
  'Small Shield': { type: 'Shield', slot: 'shield', defense: 3, reqLevel: 1, reqStr: 20 },
  'Horn Shield': { type: 'Shield', slot: 'shield', defense: 6, reqLevel: 15, reqStr: 50 },
  'Kite Shield': { type: 'Shield', slot: 'shield', defense: 10, reqLevel: 30, reqStr: 80 },
  'Elven Shield': { type: 'Shield', slot: 'shield', defense: 14, reqLevel: 45, reqStr: 110 },
  'Buckler': { type: 'Shield', slot: 'shield', defense: 18, reqLevel: 60, reqStr: 140 },
  'Dragon Slayer Shield': { type: 'Shield', slot: 'shield', defense: 22, reqLevel: 75, reqStr: 170 },
  'Skull Shield': { type: 'Shield', slot: 'shield', defense: 26, reqLevel: 90, reqStr: 200 },
  'Spiked Shield': { type: 'Shield', slot: 'shield', defense: 30, reqLevel: 105, reqStr: 230 },
  'Tower Shield': { type: 'Shield', slot: 'shield', defense: 34, reqLevel: 120, reqStr: 260 },
  'Plate Shield': { type: 'Shield', slot: 'shield', defense: 38, reqLevel: 135, reqStr: 290 },
  'Large Round Shield': { type: 'Shield', slot: 'shield', defense: 42, reqLevel: 150, reqStr: 320 },
  'Serpent Shield': { type: 'Shield', slot: 'shield', defense: 46, reqLevel: 165, reqStr: 350 },
  'Bronze Shield': { type: 'Shield', slot: 'shield', defense: 50, reqLevel: 180, reqStr: 380 },
  'Dragon Shield': { type: 'Shield', slot: 'shield', defense: 54, reqLevel: 195, reqStr: 410 },
  'Legendary Shield': { type: 'Shield', slot: 'shield', defense: 58, reqLevel: 210, reqStr: 440 },

  // === WIZARD ARMOR SETS ===
  // Vine Set
  'Vine Armor': { type: 'Armor', slot: 'armor', defense: 6, reqLevel: 10, reqEne: 40 },
  'Vine Helm': { type: 'Helm', slot: 'helm', defense: 3, reqLevel: 10, reqEne: 40 },
  'Vine Pants': { type: 'Pants', slot: 'pants', defense: 4, reqLevel: 10, reqEne: 40 },
  'Vine Gloves': { type: 'Gloves', slot: 'gloves', defense: 2, reqLevel: 10, reqEne: 40 },
  'Vine Boots': { type: 'Boots', slot: 'boots', defense: 2, reqLevel: 10, reqEne: 40 },

  // Silk Set
  'Silk Armor': { type: 'Armor', slot: 'armor', defense: 10, reqLevel: 25, reqEne: 80 },
  'Silk Helm': { type: 'Helm', slot: 'helm', defense: 5, reqLevel: 25, reqEne: 80 },
  'Silk Pants': { type: 'Pants', slot: 'pants', defense: 7, reqLevel: 25, reqEne: 80 },
  'Silk Gloves': { type: 'Gloves', slot: 'gloves', defense: 3, reqLevel: 25, reqEne: 80 },
  'Silk Boots': { type: 'Boots', slot: 'boots', defense: 3, reqLevel: 25, reqEne: 80 },

  // Wind Set
  'Wind Armor': { type: 'Armor', slot: 'armor', defense: 14, reqLevel: 40, reqEne: 120 },
  'Wind Helm': { type: 'Helm', slot: 'helm', defense: 7, reqLevel: 40, reqEne: 120 },
  'Wind Pants': { type: 'Pants', slot: 'pants', defense: 10, reqLevel: 40, reqEne: 120 },
  'Wind Gloves': { type: 'Gloves', slot: 'gloves', defense: 5, reqLevel: 40, reqEne: 120 },
  'Wind Boots': { type: 'Boots', slot: 'boots', defense: 5, reqLevel: 40, reqEne: 120 },

  // Spirit Set
  'Spirit Armor': { type: 'Armor', slot: 'armor', defense: 18, reqLevel: 55, reqEne: 160 },
  'Spirit Helm': { type: 'Helm', slot: 'helm', defense: 9, reqLevel: 55, reqEne: 160 },
  'Spirit Pants': { type: 'Pants', slot: 'pants', defense: 13, reqLevel: 55, reqEne: 160 },
  'Spirit Gloves': { type: 'Gloves', slot: 'gloves', defense: 6, reqLevel: 55, reqEne: 160 },
  'Spirit Boots': { type: 'Boots', slot: 'boots', defense: 6, reqLevel: 55, reqEne: 160 },

  // Guardian Set
  'Guardian Armor': { type: 'Armor', slot: 'armor', defense: 22, reqLevel: 70, reqEne: 200 },
  'Guardian Helm': { type: 'Helm', slot: 'helm', defense: 11, reqLevel: 70, reqEne: 200 },
  'Guardian Pants': { type: 'Pants', slot: 'pants', defense: 16, reqLevel: 70, reqEne: 200 },
  'Guardian Gloves': { type: 'Gloves', slot: 'gloves', defense: 8, reqLevel: 70, reqEne: 200 },
  'Guardian Boots': { type: 'Boots', slot: 'boots', defense: 8, reqLevel: 70, reqEne: 200 },

  // Storm Crow Set
  'Storm Crow Armor': { type: 'Armor', slot: 'armor', defense: 26, reqLevel: 85, reqEne: 240 },
  'Storm Crow Helm': { type: 'Helm', slot: 'helm', defense: 13, reqLevel: 85, reqEne: 240 },
  'Storm Crow Pants': { type: 'Pants', slot: 'pants', defense: 19, reqLevel: 85, reqEne: 240 },
  'Storm Crow Gloves': { type: 'Gloves', slot: 'gloves', defense: 9, reqLevel: 85, reqEne: 240 },
  'Storm Crow Boots': { type: 'Boots', slot: 'boots', defense: 9, reqLevel: 85, reqEne: 240 },

  // === ELF ARMOR SETS ===
  // Hyon Set
  'Hyon Armor': { type: 'Armor', slot: 'armor', defense: 8, reqLevel: 15, reqAgi: 60 },
  'Hyon Helm': { type: 'Helm', slot: 'helm', defense: 4, reqLevel: 15, reqAgi: 60 },
  'Hyon Pants': { type: 'Pants', slot: 'pants', defense: 6, reqLevel: 15, reqAgi: 60 },
  'Hyon Gloves': { type: 'Gloves', slot: 'gloves', defense: 3, reqLevel: 15, reqAgi: 60 },
  'Hyon Boots': { type: 'Boots', slot: 'boots', defense: 3, reqLevel: 15, reqAgi: 60 },

  // Legendary Elf Set
  'Legendary Elf Armor': { type: 'Armor', slot: 'armor', defense: 12, reqLevel: 30, reqAgi: 100 },
  'Legendary Elf Helm': { type: 'Helm', slot: 'helm', defense: 6, reqLevel: 30, reqAgi: 100 },
  'Legendary Elf Pants': { type: 'Pants', slot: 'pants', defense: 9, reqLevel: 30, reqAgi: 100 },
  'Legendary Elf Gloves': { type: 'Gloves', slot: 'gloves', defense: 4, reqLevel: 30, reqAgi: 100 },
  'Legendary Elf Boots': { type: 'Boots', slot: 'boots', defense: 4, reqLevel: 30, reqAgi: 100 },

  // Scale Elf Set
  'Scale Elf Armor': { type: 'Armor', slot: 'armor', defense: 16, reqLevel: 45, reqAgi: 140 },
  'Scale Elf Helm': { type: 'Helm', slot: 'helm', defense: 8, reqLevel: 45, reqAgi: 140 },
  'Scale Elf Pants': { type: 'Pants', slot: 'pants', defense: 12, reqLevel: 45, reqAgi: 140 },
  'Scale Elf Gloves': { type: 'Gloves', slot: 'gloves', defense: 6, reqLevel: 45, reqAgi: 140 },
  'Scale Elf Boots': { type: 'Boots', slot: 'boots', defense: 6, reqLevel: 45, reqAgi: 140 },

  // === ACCESSORIES ===
  // Rings
  'Ring of Ice': { type: 'Ring', slot: 'ring1', defense: 2, reqLevel: 20, special: 'Cold resistance' },
  'Ring of Poison': { type: 'Ring', slot: 'ring1', defense: 2, reqLevel: 20, special: 'Poison resistance' },
  'Ring of Fire': { type: 'Ring', slot: 'ring1', defense: 2, reqLevel: 20, special: 'Fire resistance' },
  'Ring of Earth': { type: 'Ring', slot: 'ring1', defense: 2, reqLevel: 20, special: 'Earth resistance' },
  'Ring of Wind': { type: 'Ring', slot: 'ring1', defense: 2, reqLevel: 20, special: 'Wind resistance' },
  'Ring of Magic': { type: 'Ring', slot: 'ring1', defense: 4, reqLevel: 40, special: '+20 Mana' },
  'Transformation Ring': { type: 'Ring', slot: 'ring1', defense: 6, reqLevel: 60, special: 'Transform ability' },
  'Ring of Wizardry': { type: 'Ring', slot: 'ring1', defense: 8, reqLevel: 80, special: '+5% Mana increase' },

  // Pendants
  'Pendant of Lighting': { type: 'Pendant', slot: 'pendant', damage: [0, 5], reqLevel: 15, special: 'Lightning damage' },
  'Pendant of Ice': { type: 'Pendant', slot: 'pendant', damage: [0, 5], reqLevel: 15, special: 'Ice damage' },
  'Pendant of Fire': { type: 'Pendant', slot: 'pendant', damage: [0, 5], reqLevel: 15, special: 'Fire damage' },
  'Pendant of Wind': { type: 'Pendant', slot: 'pendant', damage: [0, 5], reqLevel: 15, special: 'Wind damage' },
  'Pendant of Water': { type: 'Pendant', slot: 'pendant', damage: [0, 5], reqLevel: 15, special: 'Water damage' },
  'Pendant of Ability': { type: 'Pendant', slot: 'pendant', damage: [0, 8], reqLevel: 40, special: '+10 All Stats' },

  // Wings and Special Items
  'Wings of Elf': { type: 'Wings', slot: 'wings', defense: 5, reqLevel: 200, special: '+50 Agility, Flight' },
  'Wings of Heaven': { type: 'Wings', slot: 'wings', defense: 8, reqLevel: 200, special: '+25 All Stats, Flight' },
  'Wings of Satan': { type: 'Wings', slot: 'wings', defense: 10, reqLevel: 400, special: '+50 All Stats, Flight' },
  'Wings of Mistery': { type: 'Wings', slot: 'wings', defense: 12, reqLevel: 400, special: '+50 All Stats, Auto-Heal' },
  'Wings of Despair': { type: 'Wings', slot: 'wings', defense: 15, reqLevel: 400, special: '+50 All Stats, Darkness' },

  // Chaos Items
  'Chaos Dragon Axe': { type: 'Axe', slot: 'weapon', damage: [55, 90], reqLevel: 300, special: 'Chaos Weapon, +Luck' },
  'Chaos Nature Bow': { type: 'Bow', slot: 'weapon', damage: [45, 75], reqLevel: 300, special: 'Chaos Weapon, +Luck' },
  'Chaos Lightning Staff': { type: 'Staff', slot: 'weapon', damage: [40, 80], reqLevel: 300, special: 'Chaos Weapon, +Energy' },
  'Chaos Dragon Helm': { type: 'Helm', slot: 'helm', defense: 25, reqLevel: 300, special: 'Chaos Armor, +Luck' },
  'Chaos Dragon Armor': { type: 'Armor', slot: 'armor', defense: 35, reqLevel: 300, special: 'Chaos Armor, +Luck' },
  'Chaos Dragon Pants': { type: 'Pants', slot: 'pants', defense: 20, reqLevel: 300, special: 'Chaos Armor, +Luck' },
  'Chaos Dragon Gloves': { type: 'Gloves', slot: 'gloves', defense: 12, reqLevel: 300, special: 'Chaos Armor, +Luck' },
  'Chaos Dragon Boots': { type: 'Boots', slot: 'boots', defense: 15, reqLevel: 300, special: 'Chaos Armor, +Luck' },

  // Ancient Items
  'Legendary Sword': { type: 'Sword', slot: 'weapon', damage: [70, 120], reqLevel: 380, special: 'Ancient Item, +20 All Stats' },
  'Ancient Blade': { type: 'Sword', slot: 'weapon', damage: [65, 115], reqLevel: 350, special: 'Ancient Item, +15 All Stats' },
  'Guardian Angel': { type: 'Armor', slot: 'armor', defense: 40, reqLevel: 380, special: 'Ancient Armor, +20 Defense' },
  'Sacred Gloves': { type: 'Gloves', slot: 'gloves', defense: 18, reqLevel: 350, special: 'Ancient Gloves, +15 Agility' },
  'Sacred Boots': { type: 'Boots', slot: 'boots', defense: 20, reqLevel: 350, special: 'Ancient Boots, +15 Agility' },

  // Jewels
  'Jewel of Bless': { type: 'Jewel', slot: 'jewel', special: 'Upgrade Success Rate +10%' },
  'Jewel of Soul': { type: 'Jewel', slot: 'jewel', special: 'Upgrade Success Rate +5%' },
  'Jewel of Chaos': { type: 'Jewel', slot: 'jewel', special: 'Add Lucky/Skill/Excellent Option' },
  'Jewel of Creation': { type: 'Jewel', slot: 'jewel', special: 'Combine Items' },
  'Jewel of Guardian': { type: 'Jewel', slot: 'jewel', special: 'Prevent Item Loss on Death' },
  'Jewel of Harmony': { type: 'Jewel', slot: 'jewel', special: 'Add Harmony Option' },
  'Jewel of Life': { type: 'Jewel', slot: 'jewel', special: 'Add Life Option' },

  // Orbs and Scrolls
  'Orb of Twisting Slash': { type: 'Orb', slot: 'orb', special: 'Learn Twisting Slash Skill' },
  'Orb of Healing': { type: 'Orb', slot: 'orb', special: 'Learn Healing Skill' },
  'Orb of Greater Defense': { type: 'Orb', slot: 'orb', special: 'Learn Greater Defense Skill' },
  'Orb of Greater Damage': { type: 'Orb', slot: 'orb', special: 'Learn Greater Damage Skill' },
  'Scroll of Archangel': { type: 'Scroll', slot: 'scroll', special: 'Upgrade Weapon to +13/+14/+15' },
  'Scroll of Blood': { type: 'Scroll', slot: 'scroll', special: 'Upgrade Weapon +10/+11/+12' },

  // Potions
  'Healing Potion': { type: 'Potion', slot: 'potion', special: 'Restore 100 HP' },
  'Large Healing Potion': { type: 'Potion', slot: 'potion', special: 'Restore 200 HP' },
  'Mana Potion': { type: 'Potion', slot: 'potion', special: 'Restore 100 MP' },
  'Large Mana Potion': { type: 'Potion', slot: 'potion', special: 'Restore 200 MP' },
  'Antidote': { type: 'Potion', slot: 'potion', special: 'Cure Poison' },
  'Ale': { type: 'Potion', slot: 'potion', special: 'Temporary +20 Attack Power' },
  'Town Portal Book': { type: 'Scroll', slot: 'scroll', special: 'Teleport to Town' },
  'Apple': { type: 'Food', slot: 'food', special: 'Restore 20 HP' },
  'Small Healing Potion': { type: 'Potion', slot: 'potion', special: 'Restore 50 HP' },
  'Small Mana Potion': { type: 'Potion', slot: 'potion', special: 'Restore 50 MP' },

  // Quest Items
  'Scroll of Emperor': { type: 'Quest', slot: 'quest', special: 'Quest Item - Devil Square' },
  'Blood Bone': { type: 'Quest', slot: 'quest', special: 'Quest Item - Blood Castle' },
  'Devil Eye': { type: 'Quest', slot: 'quest', special: 'Quest Item - Devil Square' },
  'Devil Key': { type: 'Quest', slot: 'quest', special: 'Quest Item - Devil Square' },
  'Invisibility Cloak': { type: 'Quest', slot: 'quest', special: 'Quest Item - Lost Tower' },
  'Siege Potion': { type: 'Quest', slot: 'quest', special: 'Quest Item - Castle Siege' },
  'Loch Feather': { type: 'Quest', slot: 'quest', special: 'Quest Item - Kalima Event' },
  'Crest of Monarch': { type: 'Quest', slot: 'quest', special: 'Quest Item - Crywolf Event' },
};

// Game mechanics
class GameMechanics {
  static calculateExpToNextLevel(level) {
    return Math.floor(level * 1000 + Math.pow(level - 1, 2) * 100);
  }

  static getRandomMonster(mapName, characterLevel) {
    const map = MU_MAPS[mapName];
    if (!map) return null;
    
    const availableMonsters = map.monsters.filter(monster => {
      const monsterData = MU_MONSTERS[monster];
      return monsterData && monsterData.level <= characterLevel + 20;
    });
    
    return availableMonsters[Math.floor(Math.random() * availableMonsters.length)];
  }

  static simulateHunt(character) {
    const map = MU_MAPS[character.current_map];
    if (!map) return null;
    
    const monsterName = this.getRandomMonster(character.current_map, character.level);
    if (!monsterName) return null;
    
    const monster = MU_MONSTERS[monsterName];
    if (!monster) return null;
    
    // Calculate success rate based on level difference
    const levelDiff = character.level - monster.level;
    let successRate = 0.7 + (levelDiff * 0.05);
    successRate = Math.max(0.1, Math.min(0.95, successRate));
    
    if (Math.random() > successRate) {
      return {
        success: false,
        monster: monsterName,
        message: `Failed to defeat ${monsterName}`
      };
    }
    
    // Success - calculate rewards
    const expGained = Math.floor(monster.exp * (0.8 + Math.random() * 0.4));
    const zenGained = Math.floor(monster.zen * (0.8 + Math.random() * 0.4));
    
    // Item drop chance (5% base chance)
    let itemFound = null;
    let itemRarity = 'common';
    
    if (Math.random() < 0.05 && monster.drops && monster.drops.length > 0) {
      itemFound = monster.drops[Math.floor(Math.random() * monster.drops.length)];
      
      // Determine item rarity based on item properties
      const itemData = MU_ITEMS[itemFound];
      if (itemData) {
        if (itemData.special && itemData.special.includes('Ancient')) {
          itemRarity = 'legendary';
        } else if (itemData.special && itemData.special.includes('Chaos')) {
          itemRarity = 'epic';
        } else if (itemData.reqLevel > 200) {
          itemRarity = 'rare';
        } else if (itemData.reqLevel > 100) {
          itemRarity = 'uncommon';
        } else {
          itemRarity = 'common';
        }
      }
    }
    
    return {
      success: true,
      monster: monsterName,
      expGained,
      zenGained,
      itemFound,
      itemRarity,
      message: `Defeated ${monsterName}! +${expGained} EXP, +${zenGained} Zen${itemFound ? `, Found: ${itemFound}` : ''}`
    };
  }

  // Equipment System Methods
  static canEquipItem(character, itemName) {
    const item = MU_ITEMS[itemName];
    if (!item) return { canEquip: false, reason: 'Item not found' };

    // Check level requirement
    if (character.level < item.reqLevel) {
      return { canEquip: false, reason: `Requires level ${item.reqLevel}` };
    }

    // Check stat requirements
    if (item.reqStr && character.strength < item.reqStr) {
      return { canEquip: false, reason: `Requires ${item.reqStr} Strength` };
    }
    if (item.reqAgi && character.agility < item.reqAgi) {
      return { canEquip: false, reason: `Requires ${item.reqAgi} Agility` };
    }
    if (item.reqEne && character.energy < item.reqEne) {
      return { canEquip: false, reason: `Requires ${item.reqEne} Energy` };
    }

    return { canEquip: true };
  }

  static equipItem(character, itemName, db) {
    const equipCheck = this.canEquipItem(character, itemName);
    if (!equipCheck.canEquip) {
      return { success: false, message: equipCheck.reason };
    }

    const item = MU_ITEMS[itemName];
    const slot = item.slot;

    return new Promise((resolve, reject) => {
      // Unequip current item in slot if exists
      const unequipQuery = `UPDATE items SET equipped = 0 WHERE character_id = ? AND slot = ?`;
      db.run(unequipQuery, [character.id, slot], function(err) {
        if (err) {
          reject(err);
          return;
        }

        // Equip new item
        const equipQuery = `UPDATE items SET equipped = 1 WHERE character_id = ? AND name = ? AND equipped = 0 LIMIT 1`;
        db.run(equipQuery, [character.id, itemName], function(err) {
          if (err) {
            reject(err);
            return;
          }

          if (this.changes === 0) {
            resolve({ success: false, message: 'Item not found in inventory' });
            return;
          }

          resolve({ success: true, message: `${itemName} equipped successfully` });
        });
      });
    });
  }

  static calculateCharacterStats(character, equippedItems) {
    let totalDamage = [character.damage_min || 5, character.damage_max || 10];
    let totalDefense = character.defense || 0;

    equippedItems.forEach(item => {
      const itemData = MU_ITEMS[item.name];
      if (!itemData) return;

      if (itemData.damage) {
        totalDamage[0] += itemData.damage[0];
        totalDamage[1] += itemData.damage[1];
      }

      if (itemData.defense) {
        totalDefense += itemData.defense;
      }
    });

    return {
      damage: totalDamage,
      defense: totalDefense,
      totalAttack: totalDamage[0] + Math.floor((totalDamage[1] - totalDamage[0]) / 2),
      totalDefense: totalDefense
    };
  }
}

// Active players for real-time updates
const activePlayers = new Map();

// Socket.io connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_game', (data) => {
    const { character_id, username } = data;
    activePlayers.set(socket.id, { character_id, username, socket });
    socket.emit('game_joined', { message: 'Connected to MU Online Idle MMO' });
  });
  
  socket.on('start_hunting', (data) => {
    const player = activePlayers.get(socket.id);
    if (!player) return;
    
    // Get character from database
    db.get('SELECT * FROM characters WHERE id = ?', [player.character_id], (err, character) => {
      if (err || !character) return;
      
      // Start hunting interval
      const huntingInterval = setInterval(() => {
        const result = GameMechanics.simulateHunt(character);
        if (!result) return;
        
        if (result.success) {
          // Update character stats
          character.experience += result.expGained;
          character.zen += result.zenGained;
          
          // Check for level up
          const expNeeded = GameMechanics.calculateExpToNextLevel(character.level);
          if (character.experience >= expNeeded) {
            character.level++;
            character.experience -= expNeeded;
            character.hp += 20;
            character.mp += 10;
            
            result.levelUp = true;
            result.newLevel = character.level;
          }
          
          // Save to database
          db.run(`UPDATE characters SET 
            level = ?, experience = ?, zen = ?, hp = ?, mp = ?, last_active = CURRENT_TIMESTAMP 
            WHERE id = ?`, 
            [character.level, character.experience, character.zen, character.hp, character.mp, character.id]
          );
          
          // Add item to inventory if found
          if (result.itemFound) {
            const itemData = MU_ITEMS[result.itemFound];
            if (itemData) {
              db.run(`INSERT INTO items (character_id, name, slot, damage_min, damage_max, defense, enhancement_level, required_str, required_agi, required_ene, equipped, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
                     [character.id, result.itemFound, itemData.slot, 
                      itemData.damage ? itemData.damage[0] : 0, 
                      itemData.damage ? itemData.damage[1] : 0,
                      itemData.defense || 0,
                      itemData.reqStr || 0, 
                      itemData.reqAgi || 0, 
                      itemData.reqEne || 0]);
            }
          }
          
          // Log hunt
          db.run(`INSERT INTO hunting_logs (character_id, monster_name, experience_gained, zen_gained) 
            VALUES (?, ?, ?, ?)`, 
            [character.id, result.monster, result.expGained, result.zenGained]
          );
        }
        
        socket.emit('hunt_result', {
          ...result,
          character: {
            level: character.level,
            experience: character.experience,
            zen: character.zen,
            hp: character.hp,
            mp: character.mp
          }
        });
      }, 3000); // Hunt every 3 seconds
      
      player.huntingInterval = huntingInterval;
    });
  });
  
  socket.on('stop_hunting', () => {
    const player = activePlayers.get(socket.id);
    if (player && player.huntingInterval) {
      clearInterval(player.huntingInterval);
      delete player.huntingInterval;
    }
  });
  
  socket.on('disconnect', () => {
    const player = activePlayers.get(socket.id);
    if (player && player.huntingInterval) {
      clearInterval(player.huntingInterval);
    }
    activePlayers.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

// API Routes
// User registration
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
      [username, email, hashedPassword], 
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }
        
        const token = jwt.sign({ userId: this.lastID }, 'your-secret-key');
        res.json({ 
          message: 'Registration successful', 
          token,
          userId: this.lastID 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id }, 'your-secret-key');
    res.json({ 
      message: 'Login successful', 
      token,
      userId: user.id,
      username: user.username
    });
  });
});

// Create character
app.post('/api/character/create', (req, res) => {
  const { userId, name, characterClass } = req.body;
  
  if (!MU_CLASSES[characterClass]) {
    return res.status(400).json({ error: 'Invalid character class' });
  }
  
  const stats = MU_CLASSES[characterClass].stats;
  
  db.run(`INSERT INTO characters 
    (user_id, name, class, strength, agility, vitality, energy, command) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [userId, name, characterClass, stats.str, stats.agi, stats.vit, stats.ene, stats.cmd],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Character creation failed' });
      }
      
      res.json({ 
        message: 'Character created successfully',
        characterId: this.lastID
      });
    }
  );
});

// Get character list
app.get('/api/characters/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all('SELECT * FROM characters WHERE user_id = ?', [userId], (err, characters) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch characters' });
    }
    
    res.json({ characters });
  });
});

// Get character details
app.get('/api/character/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('SELECT * FROM characters WHERE id = ?', [id], (err, character) => {
    if (err || !character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    res.json({ character });
  });
});

// Update character progress (auto-save)
app.put('/api/characters/update', authenticateToken, (req, res) => {
  const { character_id, level, experience, zen, kills } = req.body;
  const userId = req.user.id;
  
  // Verify character belongs to user
  db.get('SELECT id FROM characters WHERE id = ? AND user_id = ?', [character_id, userId], (err, character) => {
    if (err || !character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    // Update character data
    const updateQuery = `
      UPDATE characters 
      SET level = ?, experience = ?, zen = ?, kills = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(updateQuery, [level, experience, zen, kills || 0, character_id], function(err) {
      if (err) {
        console.error('Error updating character:', err);
        return res.status(500).json({ error: 'Failed to update character' });
      }
      
      res.json({ 
        success: true, 
        message: 'Character progress saved',
        updated: this.changes > 0 
      });
    });
  });
});

// Get character inventory
app.get('/api/inventory/:characterId', authenticateToken, (req, res) => {
  const characterId = req.params.characterId;
  
  const query = `
    SELECT * FROM items 
    WHERE character_id = ? 
    ORDER BY equipped DESC, created_at DESC
  `;
  
  db.all(query, [characterId], (err, items) => {
    if (err) {
      console.error('Error fetching inventory:', err);
      res.status(500).json({ error: 'Failed to fetch inventory' });
      return;
    }
    
    const inventory = items.map(item => ({
      ...item,
      itemData: MU_ITEMS[item.name] || null
    }));
    
    res.json(inventory);
  });
});

// Equip item
app.post('/api/equip', authenticateToken, (req, res) => {
  const { characterId, itemName } = req.body;
  
  // Get character data first
  const characterQuery = `SELECT * FROM characters WHERE id = ? AND user_id = ?`;
  db.get(characterQuery, [characterId, req.userId], async (err, character) => {
    if (err) {
      console.error('Error fetching character:', err);
      res.status(500).json({ error: 'Failed to fetch character' });
      return;
    }
    
    if (!character) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }
    
    try {
      const result = await GameMechanics.equipItem(character, itemName, db);
      res.json(result);
    } catch (error) {
      console.error('Error equipping item:', error);
      res.status(500).json({ error: 'Failed to equip item' });
    }
  });
});

// Get equipped items
app.get('/api/equipment/:characterId', authenticateToken, (req, res) => {
  const characterId = req.params.characterId;
  
  const query = `
    SELECT * FROM items 
    WHERE character_id = ? AND equipped = 1
  `;
  
  db.all(query, [characterId], (err, items) => {
    if (err) {
      console.error('Error fetching equipment:', err);
      res.status(500).json({ error: 'Failed to fetch equipment' });
      return;
    }
    
    const equipment = items.map(item => ({
      ...item,
      itemData: MU_ITEMS[item.name] || null
    }));
    
    res.json(equipment);
  });
});

// Character stats with equipment
app.get('/api/character-stats/:characterId', authenticateToken, (req, res) => {
  const characterId = req.params.characterId;
  
  // Get character data
  const characterQuery = `SELECT * FROM characters WHERE id = ? AND user_id = ?`;
  db.get(characterQuery, [characterId, req.userId], (err, character) => {
    if (err) {
      console.error('Error fetching character:', err);
      res.status(500).json({ error: 'Failed to fetch character' });
      return;
    }
    
    if (!character) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }
    
    // Get equipped items
    const equipmentQuery = `SELECT * FROM items WHERE character_id = ? AND equipped = 1`;
    db.all(equipmentQuery, [characterId], (err, equippedItems) => {
      if (err) {
        console.error('Error fetching equipment:', err);
        res.status(500).json({ error: 'Failed to fetch equipment' });
        return;
      }
      
      const stats = GameMechanics.calculateCharacterStats(character, equippedItems);
      
      res.json({
        character: character,
        equipment: equippedItems,
        calculatedStats: stats
      });
    });
  });
});

// Get game data
app.get('/api/game-data', (req, res) => {
  res.json({
    classes: MU_CLASSES,
    maps: MU_MAPS,
    monsters: MU_MONSTERS
  });
});

// ===== PVP ARENA SYSTEM =====

// Join arena queue
app.post('/api/arena/join', authenticateToken, (req, res) => {
  const { character_id } = req.body;
  const userId = req.user.id;
  
  // Verify character belongs to user
  db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', [character_id, userId], (err, character) => {
    if (err || !character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    const levelMin = Math.max(1, character.level - 10);
    const levelMax = character.level + 10;
    
    // Add to queue
    db.run('INSERT OR REPLACE INTO arena_queue (character_id, level_min, level_max) VALUES (?, ?, ?)',
      [character_id, levelMin, levelMax], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to join arena queue' });
        }
        
        // Try to find a match
        findArenaMatch(character_id, levelMin, levelMax, res);
      });
  });
});

// Leave arena queue
app.post('/api/arena/leave', authenticateToken, (req, res) => {
  const { character_id } = req.body;
  
  db.run('DELETE FROM arena_queue WHERE character_id = ?', [character_id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to leave queue' });
    }
    res.json({ success: true, message: 'Left arena queue' });
  });
});

// Arena match finder
function findArenaMatch(playerId, levelMin, levelMax, res) {
  db.get(`SELECT * FROM arena_queue 
          WHERE character_id != ? AND level_min <= ? AND level_max >= ? 
          ORDER BY queue_time ASC LIMIT 1`, 
         [playerId, levelMax, levelMin], (err, opponent) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to find match' });
    }
    
    if (opponent) {
      // Match found! Start battle
      startArenaBattle(playerId, opponent.character_id, res);
      
      // Remove both players from queue
      db.run('DELETE FROM arena_queue WHERE character_id IN (?, ?)', [playerId, opponent.character_id]);
    } else {
      res.json({ success: true, message: 'Joined arena queue, waiting for opponent...' });
    }
  });
}

// Start arena battle
function startArenaBattle(player1Id, player2Id, res) {
  // Get both characters
  db.all('SELECT * FROM characters WHERE id IN (?, ?)', [player1Id, player2Id], (err, characters) => {
    if (err || characters.length !== 2) {
      return res.status(500).json({ error: 'Failed to start battle' });
    }
    
    const player1 = characters.find(c => c.id === player1Id);
    const player2 = characters.find(c => c.id === player2Id);
    
    // Simple combat calculation
    const player1Power = player1.level * 10 + (player1.damage_max || 10);
    const player2Power = player2.level * 10 + (player2.damage_max || 10);
    
    const battleResult = simulateArenaBattle(player1, player2, player1Power, player2Power);
    
    // Save match result
    db.run(`INSERT INTO arena_matches (player1_id, player2_id, winner_id, player1_damage, player2_damage, zen_reward, exp_reward) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
           [player1Id, player2Id, battleResult.winnerId, battleResult.player1Damage, battleResult.player2Damage, 
            battleResult.zenReward, battleResult.expReward], function(err) {
      
      if (err) {
        return res.status(500).json({ error: 'Failed to save battle result' });
      }
      
      // Update character stats
      updatePvPStats(battleResult.winnerId, battleResult.loserId, battleResult.zenReward, battleResult.expReward);
      
      res.json({
        success: true,
        battle: battleResult,
        message: `Arena battle completed! ${battleResult.winnerName} wins!`
      });
    });
  });
}

function simulateArenaBattle(player1, player2, power1, power2) {
  const randomFactor1 = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
  const randomFactor2 = 0.8 + Math.random() * 0.4;
  
  const finalPower1 = power1 * randomFactor1;
  const finalPower2 = power2 * randomFactor2;
  
  const winner = finalPower1 > finalPower2 ? player1 : player2;
  const loser = finalPower1 > finalPower2 ? player2 : player1;
  
  const zenReward = Math.floor(loser.level * 100 + Math.random() * 500);
  const expReward = Math.floor(loser.level * 50 + Math.random() * 200);
  
  return {
    winnerId: winner.id,
    winnerName: winner.name,
    loserId: loser.id,
    loserName: loser.name,
    player1Damage: Math.floor(finalPower1),
    player2Damage: Math.floor(finalPower2),
    zenReward,
    expReward,
    battleLog: `${winner.name} defeated ${loser.name} in arena combat!`
  };
}

function updatePvPStats(winnerId, loserId, zenReward, expReward) {
  // Update winner
  db.run(`UPDATE characters SET kills = kills + 1, zen = zen + ?, experience = experience + ? WHERE id = ?`,
         [zenReward, expReward, winnerId]);
  
  // Update loser
  db.run(`UPDATE characters SET deaths = deaths + 1 WHERE id = ?`, [loserId]);
}

// Get arena leaderboard
app.get('/api/arena/leaderboard', (req, res) => {
  db.all(`SELECT name, level, kills, deaths, 
          CASE WHEN deaths > 0 THEN ROUND(CAST(kills AS FLOAT) / deaths, 2) ELSE kills END as kd_ratio
          FROM characters 
          WHERE kills > 0 
          ORDER BY kills DESC, kd_ratio DESC 
          LIMIT 10`, (err, leaderboard) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
    
    res.json({ leaderboard });
  });
});

// ===== GUILD SYSTEM =====

// Create guild
app.post('/api/guild/create', authenticateToken, (req, res) => {
  const { character_id, guild_name, description } = req.body;
  const userId = req.user.id;
  
  // Verify character belongs to user and has no guild
  db.get('SELECT * FROM characters WHERE id = ? AND user_id = ? AND guild_id IS NULL', 
         [character_id, userId], (err, character) => {
    
    if (err || !character) {
      return res.status(400).json({ error: 'Character not found or already in guild' });
    }
    
    // Create guild
    db.run('INSERT INTO guilds (name, description, master_id) VALUES (?, ?, ?)',
           [guild_name, description || '', character_id], function(err) {
      
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Guild name already exists' });
        }
        return res.status(500).json({ error: 'Failed to create guild' });
      }
      
      const guildId = this.lastID;
      
      // Add creator as guild master
      db.run('INSERT INTO guild_members (guild_id, character_id, rank) VALUES (?, ?, ?)',
             [guildId, character_id, 'Master'], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to add guild master' });
        }
        
        // Update character guild_id
        db.run('UPDATE characters SET guild_id = ? WHERE id = ?', [guildId, character_id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update character' });
          }
          
          res.json({ 
            success: true, 
            guild_id: guildId,
            message: `Guild "${guild_name}" created successfully!` 
          });
        });
      });
    });
  });
});

// Join guild
app.post('/api/guild/join', authenticateToken, (req, res) => {
  const { character_id, guild_id } = req.body;
  const userId = req.user.id;
  
  // Verify character belongs to user and has no guild
  db.get('SELECT * FROM characters WHERE id = ? AND user_id = ? AND guild_id IS NULL', 
         [character_id, userId], (err, character) => {
    
    if (err || !character) {
      return res.status(400).json({ error: 'Character not found or already in guild' });
    }
    
    // Check if guild exists and has space
    db.get('SELECT g.*, COUNT(gm.id) as member_count FROM guilds g LEFT JOIN guild_members gm ON g.id = gm.guild_id WHERE g.id = ?',
           [guild_id], (err, guild) => {
      
      if (err || !guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      
      if (guild.member_count >= guild.max_members) {
        return res.status(400).json({ error: 'Guild is full' });
      }
      
      // Add to guild
      db.run('INSERT INTO guild_members (guild_id, character_id, rank) VALUES (?, ?, ?)',
             [guild_id, character_id, 'Member'], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to join guild' });
        }
        
        // Update character guild_id
        db.run('UPDATE characters SET guild_id = ? WHERE id = ?', [guild_id, character_id], (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update character' });
          }
          
          res.json({ 
            success: true, 
            message: `Joined guild "${guild.name}" successfully!` 
          });
        });
      });
    });
  });
});

// Get guild list
app.get('/api/guilds', (req, res) => {
  db.all(`SELECT g.*, COUNT(gm.id) as member_count, c.name as master_name
          FROM guilds g 
          LEFT JOIN guild_members gm ON g.id = gm.guild_id 
          LEFT JOIN characters c ON g.master_id = c.id
          GROUP BY g.id 
          ORDER BY g.level DESC, member_count DESC 
          LIMIT 20`, (err, guilds) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch guilds' });
    }
    
    res.json({ guilds });
  });
});

// ===== CHAT SYSTEM =====

// Send chat message
app.post('/api/chat/send', authenticateToken, (req, res) => {
  const { character_id, message, channel } = req.body;
  const userId = req.user.id;
  
  // Verify character belongs to user
  db.get('SELECT name FROM characters WHERE id = ? AND user_id = ?', [character_id, userId], (err, character) => {
    if (err || !character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    
    // Save message
    db.run('INSERT INTO chat_messages (character_id, character_name, channel, message) VALUES (?, ?, ?, ?)',
           [character_id, character.name, channel || 'global', message], function(err) {
      
      if (err) {
        return res.status(500).json({ error: 'Failed to send message' });
      }
      
      // Broadcast to all connected players
      const chatData = {
        id: this.lastID,
        character_name: character.name,
        channel: channel || 'global',
        message: message,
        timestamp: new Date().toISOString()
      };
      
      io.emit('chat_message', chatData);
      
      res.json({ success: true, message: 'Message sent' });
    });
  });
});

// Get chat messages
app.get('/api/chat/:channel', (req, res) => {
  const channel = req.params.channel;
  
  db.all('SELECT * FROM chat_messages WHERE channel = ? ORDER BY timestamp DESC LIMIT 50',
         [channel], (err, messages) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
    
    res.json({ messages: messages.reverse() });
  });
});

// ==================== ADVANCED FEATURES API ENDPOINTS ====================

// Advanced Inventory Management
app.get('/api/characters/:characterId/inventory', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.all('SELECT * FROM character_inventory WHERE character_id = ?', [characterId], (err, items) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch inventory' });
    }
    
    res.json({ items });
  });
});

app.post('/api/characters/:characterId/inventory/move', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  const { itemId, fromSlot, toSlot } = req.body;
  
  db.run('UPDATE character_inventory SET slot_position = ? WHERE id = ? AND character_id = ?',
    [toSlot, itemId, characterId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to move item' });
      }
      res.json({ message: 'Item moved successfully' });
    });
});

app.post('/api/characters/:characterId/inventory/sort', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  // Sort inventory by type and rarity
  db.run(`UPDATE character_inventory SET slot_position = 
    (ROW_NUMBER() OVER (ORDER BY 
      CASE item_type 
        WHEN 'weapon' THEN 1 
        WHEN 'armor' THEN 2 
        WHEN 'accessory' THEN 3 
        WHEN 'consumable' THEN 4 
        ELSE 5 
      END, 
      CASE rarity 
        WHEN 'legendary' THEN 1 
        WHEN 'epic' THEN 2 
        WHEN 'rare' THEN 3 
        ELSE 4 
      END)) - 1 
    WHERE character_id = ?`, [characterId], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to sort inventory' });
      }
      res.json({ message: 'Inventory sorted successfully' });
    });
});

// Advanced PvP Systems
app.get('/api/tournaments/current', authenticateToken, (req, res) => {
  db.get(`SELECT * FROM tournaments WHERE 
    status = 'active' AND start_time <= datetime('now') AND end_time >= datetime('now')
    ORDER BY start_time DESC LIMIT 1`, (err, tournament) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch tournament' });
    }
    
    if (!tournament) {
      return res.json({ tournament: null });
    }
    
    // Get tournament brackets
    db.all('SELECT * FROM tournament_matches WHERE tournament_id = ? ORDER BY round, match_order',
      [tournament.id], (err, matches) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch tournament brackets' });
        }
        
        res.json({ tournament: { ...tournament, matches } });
      });
  });
});

app.post('/api/tournaments/:tournamentId/join', authenticateToken, (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user.userId;
  
  db.run('INSERT OR IGNORE INTO tournament_participants (tournament_id, user_id, joined_at) VALUES (?, ?, datetime("now"))',
    [tournamentId, userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to join tournament' });
      }
      res.json({ message: 'Successfully joined tournament' });
    });
});

app.get('/api/guild-wars/current', authenticateToken, (req, res) => {
  db.get(`SELECT gw.*, g1.name as guild1_name, g2.name as guild2_name 
    FROM guild_wars gw 
    JOIN guilds g1 ON gw.guild1_id = g1.id 
    JOIN guilds g2 ON gw.guild2_id = g2.id 
    WHERE gw.status = 'active' AND gw.end_time >= datetime('now')
    ORDER BY gw.start_time DESC LIMIT 1`, (err, war) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch guild war' });
    }
    
    res.json({ war });
  });
});

app.get('/api/characters/:characterId/ranked-stats', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.get('SELECT * FROM pvp_rankings WHERE character_id = ?', [characterId], (err, stats) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch ranked stats' });
    }
    
    res.json({ stats: stats || { rank: 'Unranked', points: 0, wins: 0, losses: 0 } });
  });
});

// Events System
app.get('/api/events/active', (req, res) => {
  db.all(`SELECT * FROM events WHERE 
    status = 'active' AND start_time <= datetime('now') AND end_time >= datetime('now')
    ORDER BY priority DESC, start_time ASC`, (err, events) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch active events' });
    }
    
    res.json({ events });
  });
});

app.get('/api/events/calendar/:year/:month', (req, res) => {
  const { year, month } = req.params;
  
  db.all(`SELECT DATE(start_time) as event_date, COUNT(*) as event_count 
    FROM events 
    WHERE strftime('%Y', start_time) = ? AND strftime('%m', start_time) = ?
    GROUP BY DATE(start_time)`, [year, month.padStart(2, '0')], (err, calendar) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch event calendar' });
    }
    
    res.json({ calendar });
  });
});

app.get('/api/characters/:characterId/quests', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.all(`SELECT q.*, cq.progress, cq.completed_at 
    FROM quests q 
    LEFT JOIN character_quests cq ON q.id = cq.quest_id AND cq.character_id = ?
    WHERE q.status = 'active' OR cq.character_id IS NOT NULL
    ORDER BY q.priority DESC`, [characterId], (err, quests) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch quests' });
    }
    
    res.json({ quests });
  });
});

app.post('/api/characters/:characterId/quests/:questId/progress', authenticateToken, (req, res) => {
  const { characterId, questId } = req.params;
  const { progress } = req.body;
  
  db.run(`INSERT OR REPLACE INTO character_quests 
    (character_id, quest_id, progress, updated_at) VALUES (?, ?, ?, datetime('now'))`,
    [characterId, questId, progress], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to update quest progress' });
      }
      res.json({ message: 'Quest progress updated' });
    });
});

// Social Features
app.get('/api/characters/:characterId/friends', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.all(`SELECT c.id, c.name, c.level, c.class, c.online_status, f.status as friendship_status
    FROM friends f
    JOIN characters c ON (f.friend_id = c.id)
    WHERE f.character_id = ? AND f.status = 'accepted'
    ORDER BY c.online_status DESC, c.name ASC`, [characterId], (err, friends) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch friends' });
    }
    
    res.json({ friends });
  });
});

app.post('/api/characters/:characterId/friends/add', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  const { friendName } = req.body;
  
  // First find the friend's character ID
  db.get('SELECT id FROM characters WHERE name = ?', [friendName], (err, friend) => {
    if (err || !friend) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    // Add friend request
    db.run('INSERT OR IGNORE INTO friends (character_id, friend_id, status, created_at) VALUES (?, ?, "pending", datetime("now"))',
      [characterId, friend.id], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to send friend request' });
        }
        res.json({ message: 'Friend request sent' });
      });
  });
});

app.get('/api/characters/:characterId/achievements', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.all(`SELECT a.*, ca.unlocked_at, ca.progress
    FROM achievements a
    LEFT JOIN character_achievements ca ON a.id = ca.achievement_id AND ca.character_id = ?
    ORDER BY a.category, a.id`, [characterId], (err, achievements) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch achievements' });
    }
    
    res.json({ achievements });
  });
});

app.get('/api/leaderboards/:type', (req, res) => {
  const { type } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  
  let query;
  switch (type) {
    case 'level':
      query = 'SELECT name, level, class FROM characters ORDER BY level DESC, experience DESC';
      break;
    case 'pvp':
      query = `SELECT c.name, c.class, pr.points, pr.wins, pr.losses 
        FROM pvp_rankings pr 
        JOIN characters c ON pr.character_id = c.id 
        ORDER BY pr.points DESC`;
      break;
    case 'guild':
      query = 'SELECT name, level, member_count FROM guilds ORDER BY level DESC, experience DESC';
      break;
    default:
      return res.status(400).json({ error: 'Invalid leaderboard type' });
  }
  
  db.all(query + ` LIMIT ${limit}`, (err, rankings) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
    
    res.json({ rankings });
  });
});

// Crafting System
app.get('/api/crafting/recipes', (req, res) => {
  const category = req.query.category || 'all';
  let query = 'SELECT * FROM crafting_recipes WHERE status = "active"';
  let params = [];
  
  if (category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY required_level ASC, name ASC';
  
  db.all(query, params, (err, recipes) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch recipes' });
    }
    
    res.json({ recipes });
  });
});

app.get('/api/crafting/recipes/:recipeId/materials', (req, res) => {
  const { recipeId } = req.params;
  
  db.all('SELECT * FROM recipe_materials WHERE recipe_id = ?', [recipeId], (err, materials) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch recipe materials' });
    }
    
    res.json({ materials });
  });
});

app.post('/api/characters/:characterId/craft', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  const { recipeId, materials } = req.body;
  
  // Validate materials and consume them
  // Create the crafted item
  // Update crafting experience
  
  db.run(`INSERT INTO crafting_history 
    (character_id, recipe_id, materials_used, result, created_at) 
    VALUES (?, ?, ?, ?, datetime('now'))`,
    [characterId, recipeId, JSON.stringify(materials), 'success'], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to craft item' });
      }
      
      res.json({ 
        message: 'Item crafted successfully',
        craftingId: this.lastID
      });
    });
});

app.get('/api/characters/:characterId/crafting-stats', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.get(`SELECT 
    level,
    experience,
    COUNT(ch.id) as items_crafted,
    COUNT(CASE WHEN ch.result = 'success' THEN 1 END) * 100.0 / COUNT(ch.id) as success_rate
    FROM character_crafting cc
    LEFT JOIN crafting_history ch ON cc.character_id = ch.character_id
    WHERE cc.character_id = ?
    GROUP BY cc.character_id`, [characterId], (err, stats) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch crafting stats' });
    }
    
    res.json({ stats: stats || { level: 1, experience: 0, items_crafted: 0, success_rate: 0 } });
  });
});

// Analytics & Progression
app.get('/api/characters/:characterId/analytics', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.all(`SELECT 
    (SELECT COUNT(*) FROM combat_logs WHERE character_id = ? AND result = 'victory') as monsters_defeated,
    (SELECT COUNT(*) FROM pvp_battles WHERE (player1_id = ? OR player2_id = ?) AND winner_id = ?) as pvp_wins,
    (SELECT COUNT(*) FROM pvp_battles WHERE player1_id = ? OR player2_id = ?) as total_pvp_battles,
    (SELECT SUM(duration) FROM play_sessions WHERE character_id = ?) as total_playtime,
    (SELECT COUNT(*) FROM character_achievements WHERE character_id = ?) as achievements_unlocked`,
    [characterId, characterId, characterId, characterId, characterId, characterId, characterId, characterId], 
    (err, analytics) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
    
    res.json({ analytics: analytics[0] || {} });
  });
});

app.get('/api/characters/:characterId/skill-progress', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.all('SELECT * FROM character_skills WHERE character_id = ?', [characterId], (err, skills) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch skill progress' });
    }
    
    res.json({ skills });
  });
});

app.get('/api/characters/:characterId/weekly-activity', authenticateToken, (req, res) => {
  const { characterId } = req.params;
  
  db.all(`SELECT 
    DATE(session_start) as activity_date,
    SUM(duration) as daily_playtime
    FROM play_sessions 
    WHERE character_id = ? 
    AND session_start >= date('now', '-7 days')
    GROUP BY DATE(session_start)
    ORDER BY activity_date`, [characterId], (err, activity) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch weekly activity' });
    }
    
    res.json({ activity });
  });
});

// Performance & System Stats
app.get('/api/server/stats', (req, res) => {
  const stats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    activeConnections: io.engine.clientsCount || 0
  };
  
  // Get database stats
  db.all(`SELECT 
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM characters) as total_characters,
    (SELECT COUNT(*) FROM characters WHERE online_status = 'online') as online_players,
    (SELECT COUNT(*) FROM guilds) as total_guilds`, (err, dbStats) => {
    
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch server stats' });
    }
    
    res.json({ 
      server: stats,
      database: dbStats[0] || {}
    });
  });
});

// Serve the game
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize database
    await initializeDatabase();
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`🎮 MU Online Idle MMO Server running on port ${PORT}`);
      console.log(`🌐 Access the game at: http://localhost:${PORT}`);
      console.log(`📊 Database: MySQL (${dbConfig.host}:${dbConfig.port})`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();

module.exports = app;
