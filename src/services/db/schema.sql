-- SQLite Schema for Discord Bot Database

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discordId TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  displayName TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Guilds table
CREATE TABLE IF NOT EXISTS guilds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discordGuildId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  iconUrl TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (polymorphic)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  targetType TEXT NOT NULL, -- 'user' or 'guild'
  userId INTEGER,
  guildId INTEGER,
  key TEXT NOT NULL,
  value TEXT NOT NULL, -- JSON string
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guildId) REFERENCES guilds(id) ON DELETE CASCADE,
  UNIQUE(userId, key),
  UNIQUE(guildId, key)
);

-- Memories table with vector embeddings and enhanced fields
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  guildId INTEGER,
  content TEXT NOT NULL,
  embedding TEXT NOT NULL, -- JSON array of numbers
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastAccessedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  accessCount INTEGER DEFAULT 0,
  importance REAL DEFAULT 5,
  tags TEXT DEFAULT '[]',
  metadata TEXT DEFAULT '{}',
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guildId) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Memory relationships table for enhanced memory features
CREATE TABLE IF NOT EXISTS memory_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceMemoryId TEXT NOT NULL,
  targetMemoryId TEXT NOT NULL,
  relationshipType TEXT NOT NULL,
  strength REAL DEFAULT 1.0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}',
  UNIQUE(sourceMemoryId, targetMemoryId, relationshipType)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discordId);
CREATE INDEX IF NOT EXISTS idx_guilds_discord_id ON guilds(discordGuildId);
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(userId);
CREATE INDEX IF NOT EXISTS idx_settings_guild_id ON settings(guildId);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(userId);
CREATE INDEX IF NOT EXISTS idx_memories_guild_id ON memories(guildId);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(createdAt);
CREATE INDEX IF NOT EXISTS idx_memories_last_accessed_at ON memories(lastAccessedAt);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
CREATE INDEX IF NOT EXISTS idx_memories_access_count ON memories(accessCount);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories(tags);
CREATE INDEX IF NOT EXISTS idx_memories_metadata ON memories(metadata);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON memory_relationships(sourceMemoryId);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON memory_relationships(targetMemoryId);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON memory_relationships(relationshipType);
-- Triggers to update updatedAt timestamps
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_guilds_updated_at
  AFTER UPDATE ON guilds
  BEGIN
    UPDATE guilds SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_settings_updated_at
  AFTER UPDATE ON settings
  BEGIN
    UPDATE settings SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_memories_updated_at
  AFTER UPDATE ON memories
  BEGIN
    UPDATE memories SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
