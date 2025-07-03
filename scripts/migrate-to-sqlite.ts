#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { safeJsonStringify } from '../src/services/db/client';

async function migrateToSqlite() {
  console.log('Starting migration from PostgreSQL to SQLite...');

  // Connect to PostgreSQL
  const prisma = new PrismaClient();
  
  // Create SQLite database
  const dataDir = join(process.cwd(), 'data');
  await Bun.write(dataDir, ''); // Ensure directory exists
  const sqliteDb = new Database(join(dataDir, 'bot.db'));

  try {
    // Initialize SQLite schema
    const schema = Bun.file(join(process.cwd(), 'src', 'services', 'db', 'schema.sql'));
    const schemaText = await schema.text();
    sqliteDb.exec(schemaText);

    // Migrate Users
    console.log('Migrating users...');
    const users = await prisma.user.findMany();
    for (const user of users) {
      sqliteDb.prepare(`
        INSERT INTO users (id, discordId, username, displayName, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.discordId,
        user.username,
        user.displayName,
        user.createdAt.toISOString(),
        user.updatedAt.toISOString()
      );
    }

    // Migrate Guilds
    console.log('Migrating guilds...');
    const guilds = await prisma.guild.findMany();
    for (const guild of guilds) {
      sqliteDb.prepare(`
        INSERT INTO guilds (id, discordGuildId, name, iconUrl, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        guild.id,
        guild.discordGuildId,
        guild.name,
        guild.iconUrl,
        guild.createdAt.toISOString(),
        guild.updatedAt.toISOString()
      );
    }

    // Migrate Settings
    console.log('Migrating settings...');
    const settings = await prisma.setting.findMany();
    for (const setting of settings) {
      sqliteDb.prepare(`
        INSERT INTO settings (id, targetType, userId, guildId, key, value, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        setting.id,
        setting.targetType,
        setting.userId,
        setting.guildId,
        setting.key,
        safeJsonStringify(setting.value),
        setting.createdAt.toISOString(),
        setting.updatedAt.toISOString()
      );
    }

    // Migrate Memories
    console.log('Migrating memories...');
    const memories = await prisma.memory.findMany();
    for (const memory of memories) {
      sqliteDb.prepare(`
        INSERT INTO memories (id, userId, guildId, content, embedding, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        memory.id,
        memory.userId,
        memory.guildId,
        memory.content,
        safeJsonStringify(memory.embedding),
        memory.createdAt.toISOString(),
        memory.updatedAt.toISOString()
      );
    }

    console.log('Migration completed successfully!');
    console.log(`Migrated ${users.length} users, ${guilds.length} guilds, ${settings.length} settings, ${memories.length} memories`);

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    sqliteDb.close();
  }
}

// Run migration if this script is executed directly
if (import.meta.main) {
  migrateToSqlite().catch(console.error);
}

export { migrateToSqlite }; 