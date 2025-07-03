#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdir, unlink } from 'fs/promises';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  operationsPerSecond: number;
  memoryUsage?: number;
}

interface TestData {
  users: Array<{ discordId: string; username: string; displayName: string }>;
  guilds: Array<{ discordGuildId: string; name: string; iconUrl?: string }>;
  settings: Array<{ targetType: string; key: string; value: any }>;
  memories: Array<{ content: string; embedding: number[] }>;
}

class DatabaseBenchmark {
  private db!: Database;
  private results: BenchmarkResult[] = [];

  async initialize(): Promise<void> {
    const dataDir = join(process.cwd(), 'data');
    try {
      await mkdir(dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Create a test database
    const testDbPath = join(dataDir, 'benchmark.db');
    this.db = new Database(testDbPath);
    
    // Load schema
    const schema = Bun.file(join(import.meta.dir, '..', 'src', 'services', 'db', 'schema.sql'));
    const schemaText = await schema.text();
    this.db.exec(schemaText);
    
    console.log('✅ Database initialized for benchmarking');
  }

  private measureTime<T>(fn: () => T): { result: T; time: number } {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return { result, time: end - start };
  }

  private async benchmarkOperation(
    name: string,
    iterations: number,
    operation: () => void | Promise<void>
  ): Promise<BenchmarkResult> {
    console.log(`🔄 Running ${name} benchmark (${iterations} iterations)...`);
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < iterations; i++) {
      await operation();
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;
    const operationsPerSecond = (iterations / totalTime) * 1000;
    const memoryUsage = endMemory - startMemory;
    
    const result: BenchmarkResult = {
      operation: name,
      iterations,
      totalTime,
      averageTime,
      operationsPerSecond,
      memoryUsage
    };
    
    this.results.push(result);
    return result;
  }

  private generateTestData(): TestData {
    const users = Array.from({ length: 1000 }, (_, i) => ({
      discordId: `user_${i}_${Date.now()}`,
      username: `user${i}`,
      displayName: `User ${i}`
    }));

    const guilds = Array.from({ length: 100 }, (_, i) => ({
      discordGuildId: `guild_${i}_${Date.now()}`,
      name: `Guild ${i}`,
      iconUrl: `https://example.com/icon${i}.png`
    }));

    const settings = Array.from({ length: 500 }, (_, i) => ({
      targetType: i % 2 === 0 ? 'user' : 'guild',
      key: `setting_${i}`,
      value: { config: `value_${i}`, timestamp: Date.now() }
    }));

    const memories = Array.from({ length: 200 }, (_, i) => ({
      content: `This is memory content ${i} with some meaningful text for testing purposes.`,
      embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1) // 1536-dimensional embedding
    }));

    return { users, guilds, settings, memories };
  }

  async runUserBenchmarks(): Promise<void> {
    const testData = this.generateTestData();
    
    // Insert users
    await this.benchmarkOperation('User Insert (1000 records)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO users (discordId, username, displayName) VALUES (?, ?, ?)');
      for (const user of testData.users) {
        stmt.run(user.discordId, user.username, user.displayName);
      }
    });

    // Find by Discord ID
    await this.benchmarkOperation('User Find by Discord ID', 1000, () => {
      const stmt = this.db.prepare('SELECT * FROM users WHERE discordId = ?');
      const randomUser = testData.users[Math.floor(Math.random() * testData.users.length)];
      stmt.get(randomUser.discordId);
    });

    // Find by ID
    await this.benchmarkOperation('User Find by ID', 1000, () => {
      const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
      const randomId = Math.floor(Math.random() * 1000) + 1;
      stmt.get(randomId);
    });

    // Update users
    await this.benchmarkOperation('User Update', 100, () => {
      const stmt = this.db.prepare('UPDATE users SET username = ?, displayName = ? WHERE id = ?');
      const randomId = Math.floor(Math.random() * 1000) + 1;
      stmt.run(`updated_user_${randomId}`, `Updated User ${randomId}`, randomId);
    });
  }

  async runGuildBenchmarks(): Promise<void> {
    const testData = this.generateTestData();
    
    // Insert guilds
    await this.benchmarkOperation('Guild Insert (100 records)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO guilds (discordGuildId, name, iconUrl) VALUES (?, ?, ?)');
      for (const guild of testData.guilds) {
        stmt.run(guild.discordGuildId, guild.name, guild.iconUrl || null);
      }
    });

    // Find by Discord Guild ID
    await this.benchmarkOperation('Guild Find by Discord ID', 1000, () => {
      const stmt = this.db.prepare('SELECT * FROM guilds WHERE discordGuildId = ?');
      const randomGuild = testData.guilds[Math.floor(Math.random() * testData.guilds.length)];
      stmt.get(randomGuild.discordGuildId);
    });
  }

  async runSettingsBenchmarks(): Promise<void> {
    const testData = this.generateTestData();
    
    // Insert settings
    await this.benchmarkOperation('Settings Insert (500 records)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO settings (targetType, userId, guildId, key, value) VALUES (?, ?, ?, ?, ?)');
      for (let i = 0; i < testData.settings.length; i++) {
        const setting = testData.settings[i];
        const userId = setting.targetType === 'user' ? (i % 1000) + 1 : null;
        const guildId = setting.targetType === 'guild' ? (i % 100) + 1 : null;
        stmt.run(setting.targetType, userId, guildId, setting.key, JSON.stringify(setting.value));
      }
    });

    // Find settings by user
    await this.benchmarkOperation('Settings Find by User', 100, () => {
      const stmt = this.db.prepare('SELECT * FROM settings WHERE userId = ?');
      const randomUserId = Math.floor(Math.random() * 1000) + 1;
      stmt.all(randomUserId);
    });

    // Find settings by guild
    await this.benchmarkOperation('Settings Find by Guild', 100, () => {
      const stmt = this.db.prepare('SELECT * FROM settings WHERE guildId = ?');
      const randomGuildId = Math.floor(Math.random() * 100) + 1;
      stmt.all(randomGuildId);
    });

    // Find setting by key
    await this.benchmarkOperation('Settings Find by Key', 1000, () => {
      const stmt = this.db.prepare('SELECT * FROM settings WHERE key = ?');
      const randomSetting = testData.settings[Math.floor(Math.random() * testData.settings.length)];
      stmt.get(randomSetting.key);
    });
  }

  async runMemoryBenchmarks(): Promise<void> {
    const testData = this.generateTestData();
    
    // Insert memories
    await this.benchmarkOperation('Memory Insert (200 records)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO memories (userId, guildId, content, embedding) VALUES (?, ?, ?, ?)');
      for (let i = 0; i < testData.memories.length; i++) {
        const memory = testData.memories[i];
        const userId = (i % 1000) + 1;
        const guildId = (i % 100) + 1;
        stmt.run(userId, guildId, memory.content, JSON.stringify(memory.embedding));
      }
    });

    // Find memories by user
    await this.benchmarkOperation('Memory Find by User', 100, () => {
      const stmt = this.db.prepare('SELECT * FROM memories WHERE userId = ?');
      const randomUserId = Math.floor(Math.random() * 1000) + 1;
      stmt.all(randomUserId);
    });

    // Find memories by guild
    await this.benchmarkOperation('Memory Find by Guild', 100, () => {
      const stmt = this.db.prepare('SELECT * FROM memories WHERE guildId = ?');
      const randomGuildId = Math.floor(Math.random() * 100) + 1;
      stmt.all(randomGuildId);
    });

    // Vector similarity search (simplified)
    await this.benchmarkOperation('Memory Vector Search', 50, () => {
      const stmt = this.db.prepare('SELECT * FROM memories LIMIT 100');
      const memories = stmt.all() as any[];
      
      // Simulate vector similarity calculation
      const queryEmbedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
      memories.forEach(memory => {
        const embedding = JSON.parse(memory.embedding);
        // Calculate cosine similarity (simplified)
        const dot = queryEmbedding.reduce((sum, val, i) => sum + val * embedding[i], 0);
        const normA = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
        const normB = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return dot / (normA * normB);
      });
    });
  }

  async runComplexQueries(): Promise<void> {
    // Join queries
    await this.benchmarkOperation('Complex Join Query', 100, () => {
      const stmt = this.db.prepare(`
        SELECT u.username, g.name, s.key, s.value, m.content
        FROM users u
        LEFT JOIN guilds g ON u.id = g.id
        LEFT JOIN settings s ON (s.userId = u.id OR s.guildId = g.id)
        LEFT JOIN memories m ON (m.userId = u.id OR m.guildId = g.id)
        WHERE u.id = ?
        LIMIT 10
      `);
      const randomUserId = Math.floor(Math.random() * 1000) + 1;
      stmt.all(randomUserId);
    });

    // Aggregation queries
    await this.benchmarkOperation('Aggregation Query', 100, () => {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(DISTINCT g.id) as total_guilds,
          COUNT(s.id) as total_settings,
          COUNT(m.id) as total_memories
        FROM users u
        LEFT JOIN guilds g ON 1=1
        LEFT JOIN settings s ON s.userId = u.id
        LEFT JOIN memories m ON m.userId = u.id
        WHERE u.id <= 100
      `);
      stmt.get();
    });
  }

  async runConcurrencyTest(): Promise<void> {
    const concurrentOperations = 10;
    const operationsPerThread = 100;
    
    await this.benchmarkOperation(`Concurrent Operations (${concurrentOperations} threads)`, 1, async () => {
      const promises = Array.from({ length: concurrentOperations }, async () => {
        for (let i = 0; i < operationsPerThread; i++) {
          const stmt = this.db.prepare('SELECT COUNT(*) FROM users');
          stmt.get();
        }
      });
      
      await Promise.all(promises);
    });
  }

  printResults(): void {
    console.log('\n📊 BENCHMARK RESULTS');
    console.log('='.repeat(80));
    
    this.results.forEach(result => {
      console.log(`\n ${result.operation}`);
      console.log(`   Iterations: ${result.iterations.toLocaleString()}`);
      console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`);
      console.log(`   Average Time: ${result.averageTime.toFixed(4)}ms`);
      console.log(`   Operations/sec: ${result.operationsPerSecond.toFixed(2)}`);
      if (result.memoryUsage) {
        console.log(`   Memory Usage: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      }
    });

    // Summary statistics
    const totalTime = this.results.reduce((sum, r) => sum + r.totalTime, 0);
    const totalOperations = this.results.reduce((sum, r) => sum + r.iterations, 0);
    const avgOpsPerSec = this.results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / this.results.length;

    console.log('\n📈 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Benchmark Time: ${totalTime.toFixed(2)}ms`);
    console.log(`Total Operations: ${totalOperations.toLocaleString()}`);
    console.log(`Average Operations/sec: ${avgOpsPerSec.toFixed(2)}`);
    
    // Database size
    const dbSize = Bun.file(join(process.cwd(), 'data', 'benchmark.db')).size;
    console.log(`Database Size: ${(dbSize / 1024 / 1024).toFixed(2)}MB`);
  }

  async cleanup(): Promise<void> {
    this.db.close();
    const testDbPath = join(process.cwd(), 'data', 'benchmark.db');
    try {
      await unlink(testDbPath);
      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.log('⚠️  Could not remove test database file');
    }
  }

  async run(): Promise<void> {
    try {
      await this.initialize();
      
      console.log('🚀 Starting database benchmarks...\n');
      
      await this.runUserBenchmarks();
      await this.runGuildBenchmarks();
      await this.runSettingsBenchmarks();
      await this.runMemoryBenchmarks();
      await this.runComplexQueries();
      await this.runConcurrencyTest();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the benchmark
if (import.meta.main) {
  const benchmark = new DatabaseBenchmark();
  await benchmark.run();
}