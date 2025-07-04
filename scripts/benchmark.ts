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
  private testData!: TestData;

  async initialize(): Promise<void> {
    const dataDir = join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true }).catch(() => {});

    const testDbPath = join(dataDir, 'benchmark.db');
    await unlink(testDbPath).catch(() => {}); // Clean previous benchmark db

    this.db = new Database(testDbPath);
    
    const schema = Bun.file(join(import.meta.dir, '..', 'src', 'services', 'db', 'schema.sql'));
    const schemaText = await schema.text();
    this.db.exec(schemaText);

    // Aggressive PRAGMAs for maximum benchmark performance.
    // These settings are NOT safe for production but are ideal for measuring raw speed.
    this.db.exec('PRAGMA journal_mode = MEMORY;'); // Use memory for the journal, fastest but no durability
    this.db.exec('PRAGMA synchronous = OFF;'); // Disable waiting for disk writes
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec('PRAGMA temp_store = MEMORY;');
    this.db.exec('PRAGMA mmap_size = 30000000000;'); // Enable memory-mapping
    this.db.exec('PRAGMA cache_size = -200000;'); // 200MB cache
    
    console.log('✅ Database initialized for benchmarking with high-performance PRAGMAs');
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
    const now = Date.now(); // Generate timestamp once for consistency
    const users = Array.from({ length: 1000 }, (_, i) => ({
      discordId: `user_${i}_${now}`,
      username: `user${i}`,
      displayName: `User ${i}`
    }));

    const guilds = Array.from({ length: 100 }, (_, i) => ({
      discordGuildId: `guild_${i}_${now}`,
      name: `Guild ${i}`,
      iconUrl: `https://example.com/icon${i}.png`
    }));

    const settings = Array.from({ length: 500 }, (_, i) => ({
      targetType: i % 2 === 0 ? 'user' : 'guild',
      key: `setting_${i}`,
      value: { config: `value_${i}`, timestamp: now }
    }));

    const memories = Array.from({ length: 200 }, (_, i) => ({
      content: `This is memory content ${i} with some meaningful text for testing purposes.`,
      embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
    }));

    return { users, guilds, settings, memories };
  }

  async runAllBenchmarks(): Promise<void> {
    this.testData = this.generateTestData();

    await this.runUserBenchmarks();
    await this.runGuildBenchmarks();
    await this.runSettingsBenchmarks();
    await this.runMemoryBenchmarks();
    await this.runComplexQueries();
    await this.runConcurrencyTest();
  }

  async runUserBenchmarks(): Promise<void> {
    console.log('\n--- Running User Benchmarks ---');
    await this.benchmarkOperation('User Insert (1000 records, bulk)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO users (discordId, username, displayName) VALUES (?, ?, ?)');
      const insertMany = this.db.transaction(users => {
        for (const user of users) stmt.run(user.discordId, user.username, user.displayName);
      });
      insertMany(this.testData.users);
    });

    const findByDiscordIdStmt = this.db.prepare('SELECT * FROM users WHERE discordId = ?');
    await this.benchmarkOperation('User Find by Discord ID', 1000, () => {
      const randomUser = this.testData.users[Math.floor(Math.random() * this.testData.users.length)];
      findByDiscordIdStmt.get(randomUser.discordId);
    });

    const findByIdStmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    await this.benchmarkOperation('User Find by ID', 1000, () => {
      const randomId = Math.floor(Math.random() * 1000) + 1;
      findByIdStmt.get(randomId);
    });

    const updateUserStmt = this.db.prepare('UPDATE users SET username = ?, displayName = ? WHERE id = ?');
    await this.benchmarkOperation('User Update', 100, () => {
      const randomId = Math.floor(Math.random() * 1000) + 1;
      updateUserStmt.run(`updated_user_${randomId}`, `Updated User ${randomId}`, randomId);
    });
  }

  async runGuildBenchmarks(): Promise<void> {
    console.log('\n--- Running Guild Benchmarks ---');
    await this.benchmarkOperation('Guild Insert (100 records, bulk)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO guilds (discordGuildId, name, iconUrl) VALUES (?, ?, ?)');
      const insertMany = this.db.transaction(guilds => {
        for (const guild of guilds) stmt.run(guild.discordGuildId, guild.name, guild.iconUrl || null);
      });
      insertMany(this.testData.guilds);
    });

    const findByDiscordGuildIdStmt = this.db.prepare('SELECT * FROM guilds WHERE discordGuildId = ?');
    await this.benchmarkOperation('Guild Find by Discord ID', 1000, () => {
      const randomGuild = this.testData.guilds[Math.floor(Math.random() * this.testData.guilds.length)];
      findByDiscordGuildIdStmt.get(randomGuild.discordGuildId);
    });
  }

  async runSettingsBenchmarks(): Promise<void> {
    console.log('\n--- Running Settings Benchmarks ---');
    await this.benchmarkOperation('Settings Insert (500 records, bulk)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO settings (targetType, userId, guildId, key, value) VALUES (?, ?, ?, ?, ?)');
      const insertMany = this.db.transaction(settings => {
        for (let i = 0; i < settings.length; i++) {
          const setting = settings[i];
          const userId = setting.targetType === 'user' ? (i % 1000) + 1 : null;
          const guildId = setting.targetType === 'guild' ? (i % 100) + 1 : null;
          stmt.run(setting.targetType, userId, guildId, setting.key, JSON.stringify(setting.value));
        }
      });
      insertMany(this.testData.settings);
    });

    const findByUserStmt = this.db.prepare('SELECT * FROM settings WHERE userId = ?');
    await this.benchmarkOperation('Settings Find by User', 100, () => {
      const randomUserId = Math.floor(Math.random() * 1000) + 1;
      findByUserStmt.all(randomUserId);
    });

    const findByGuildStmt = this.db.prepare('SELECT * FROM settings WHERE guildId = ?');
    await this.benchmarkOperation('Settings Find by Guild', 100, () => {
      const randomGuildId = Math.floor(Math.random() * 100) + 1;
      findByGuildStmt.all(randomGuildId);
    });

    const findByKeyStmt = this.db.prepare('SELECT * FROM settings WHERE key = ?');
    await this.benchmarkOperation('Settings Find by Key', 1000, () => {
      const randomSetting = this.testData.settings[Math.floor(Math.random() * this.testData.settings.length)];
      findByKeyStmt.get(randomSetting.key);
    });
  }

  async runMemoryBenchmarks(): Promise<void> {
    console.log('\n--- Running Memory Benchmarks ---');
    await this.benchmarkOperation('Memory Insert (200 records, bulk)', 1, () => {
      const stmt = this.db.prepare('INSERT INTO memories (userId, guildId, content, embedding) VALUES (?, ?, ?, ?)');
      const insertMany = this.db.transaction(memories => {
        for (let i = 0; i < memories.length; i++) {
          const memory = memories[i];
          const userId = (i % 1000) + 1;
          const guildId = (i % 100) + 1;
          stmt.run(userId, guildId, memory.content, JSON.stringify(memory.embedding));
        }
      });
      insertMany(this.testData.memories);
    });

    const findMemByUserStmt = this.db.prepare('SELECT * FROM memories WHERE userId = ?');
    await this.benchmarkOperation('Memory Find by User', 100, () => {
      const randomUserId = Math.floor(Math.random() * 1000) + 1;
      findMemByUserStmt.all(randomUserId);
    });

    const findMemByGuildStmt = this.db.prepare('SELECT * FROM memories WHERE guildId = ?');
    await this.benchmarkOperation('Memory Find by Guild', 100, () => {
      const randomGuildId = Math.floor(Math.random() * 100) + 1;
      findMemByGuildStmt.all(randomGuildId);
    });

    const vectorSearchStmt = this.db.prepare('SELECT embedding FROM memories LIMIT 100');
    await this.benchmarkOperation('Memory Vector Search (In-Memory)', 50, () => {
      const memories = vectorSearchStmt.all() as any[];
      const queryEmbedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
      const normA = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));

      memories.forEach(memory => {
        const embedding = JSON.parse(memory.embedding);
        const dot = queryEmbedding.reduce((sum, val, i) => sum + val * embedding[i], 0);
        const normB = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return dot / (normA * normB); // Cosine similarity
      });
    });
  }

  async runComplexQueries(): Promise<void> {
    console.log('\n--- Running Complex Query Benchmarks ---');
    const joinStmt = this.db.prepare(`
      SELECT u.username, g.name, s.key, s.value, m.content
      FROM users u
      LEFT JOIN guilds g ON u.id = g.id -- Example join, might not be realistic
      LEFT JOIN settings s ON s.userId = u.id
      LEFT JOIN memories m ON m.userId = u.id
      WHERE u.id = ?
      LIMIT 10
    `);
    await this.benchmarkOperation('Complex Join Query', 100, () => {
      const randomUserId = Math.floor(Math.random() * 1000) + 1;
      joinStmt.all(randomUserId);
    });

    const aggStmt = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM guilds) as total_guilds,
        (SELECT COUNT(*) FROM settings) as total_settings,
        (SELECT COUNT(*) FROM memories) as total_memories
    `);
    await this.benchmarkOperation('Aggregation Query', 100, () => {
      aggStmt.get();
    });
  }

  async runConcurrencyTest(): Promise<void> {
    console.log('\n--- Running Concurrency Test ---');
    const concurrentOperations = 10;
    const operationsPerThread = 100;
    const stmt = this.db.prepare('SELECT COUNT(*) FROM users');

    await this.benchmarkOperation(`Concurrent Reads (${concurrentOperations} threads)`, 1, async () => {
      const promises = Array.from({ length: concurrentOperations }, async () => {
        for (let i = 0; i < operationsPerThread; i++) {
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
      const opsPerSec = result.operationsPerSecond * (result.operation.includes('records') ? parseInt(result.operation.match(/(\d+)\s*records/)?.[1] || '1') : 1);
      
      console.log(`\n ${result.operation}`);
      console.log(`   Iterations: ${result.iterations.toLocaleString()}`);
      console.log(`   Total Time: ${result.totalTime.toFixed(2)}ms`);
      console.log(`   Average Time: ${result.averageTime.toFixed(4)}ms/iteration`);
      console.log(`   Operations/sec: ${opsPerSec.toFixed(2)}`);
      if (result.memoryUsage && result.memoryUsage > 0) {
        console.log(`   Memory Usage: ${(result.memoryUsage / 1024 / 1024).toFixed(4)}MB`);
      }
    });

    const totalTime = this.results.reduce((sum, r) => sum + r.totalTime, 0);
    const totalOperations = this.results.reduce((sum, r) => sum + r.iterations, 0);

    console.log('\n📈 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Benchmark Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Total Operations Executed: ${totalOperations.toLocaleString()}`);
    
    const dbSize = Bun.file(join(process.cwd(), 'data', 'benchmark.db')).size;
    console.log(`Final Database Size: ${(dbSize / 1024 / 1024).toFixed(2)}MB`);
  }

  async cleanup(): Promise<void> {
    this.db.close();
    const testDbPath = join(process.cwd(), 'data', 'benchmark.db');
    await unlink(testDbPath).catch(() => {});
    console.log('\n🧹 Cleanup completed');
  }

  async run(): Promise<void> {
    try {
      await this.initialize();
      console.log('🚀 Starting database benchmarks...\n');
      await this.runAllBenchmarks();
      this.printResults();
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

if (import.meta.main) {
  const benchmark = new DatabaseBenchmark();
  await benchmark.run();
}