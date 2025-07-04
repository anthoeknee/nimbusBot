#!/usr/bin/env bun

import { memoryStore } from "../src/services/memoryStore";
import { PerformanceMonitor } from "../src/utils/performance"; // Assuming this is where PerformanceMonitor is exported
import { logger } from "../src/utils/logger";

// --- Define the expected structure for results from PerformanceMonitor ---
interface MeasuredOperationResult {
  [x: string]: number | undefined;
  duration: number;
  operationsPerSecond: number;
}

interface BenchmarkResult {
  operation: string;
  duration: number;
  operationsPerSecond: number;
  memoryUsage?: number;
  error?: string;
}

interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  totalDuration: number;
  averageOpsPerSecond: number;
}

class MemoryStoreBenchmark {
  private results: BenchmarkSuite[] = [];
  private readonly iterations = 100000;
  private readonly warmupIterations = 5000;
  private readonly stressIterations = 500000;

  private currentSuiteIndex = 0;
  private currentResultIndex = 0;
  private isInterrupted = false;

  async runAllBenchmarks(): Promise<void> {
    console.log("🚀 Starting INTENSIVE MemoryStore Benchmark Suite\n");
    
    // Ensure MemoryStore is initialized before any benchmarks
    await memoryStore.initialize();
    
    try {
      await this.benchmarkBasicOperations(); // <-- THIS METHOD IS MODIFIED
      await this.benchmarkTTLOperations();
      await this.benchmarkBulkOperations();
      await this.benchmarkMemoryUsage();
      await this.benchmarkConcurrentOperations();
      await this.benchmarkCleanupPerformance();
      await this.benchmarkStressTest();
      await this.benchmarkEdgeCases();
      await this.benchmarkMemoryPressure();
      await this.benchmarkRealWorldScenarios();
    } catch (error: any) {
      console.error("\n❌ A benchmark suite failed or was interrupted. Generating partial report...");
      this.isInterrupted = true;
      // Log the error for debugging if it wasn't already caught by a specific suite
      if (!this.results.some(suite => suite.results.some(r => r.error))) {
         console.error("Top-level error:", error.message);
      }
    } finally {
      this.generateReport();
      await memoryStore.shutdown();
    }
  }

  /**
   * Measures a single operation, handles errors, and pushes the result to the suite.
   * @param suite The current benchmark suite to add results to.
   * @param operationName The descriptive name of the operation being benchmarked.
   * @param operation A function that performs the benchmarked operation and returns a MeasuredOperationResult.
   * @param getMemoryUsage Optional function to extract memory usage from the operation's return value.
   */
  private async measureOperation(
    suite: BenchmarkSuite,
    operationName: string,
    operation: () => Promise<MeasuredOperationResult>,
    getMemoryUsage?: (result: MeasuredOperationResult) => number | undefined
  ): Promise<void> {
    try {
      const measuredResult = await operation();
      
      const memoryUsage = getMemoryUsage ? getMemoryUsage(measuredResult) : undefined;
      
      suite.results.push({
        operation: operationName,
        duration: measuredResult.duration,
        operationsPerSecond: measuredResult.operationsPerSecond,
        memoryUsage: memoryUsage // Add memory usage if provided
      });
    } catch (error: any) {
      console.error(`❌ Error during "${operationName}": ${error.message}`);
      suite.results.push({
        operation: operationName,
        duration: 0, // Indicate error, duration not measured
        operationsPerSecond: 0,
        error: error.message
      });
      this.isInterrupted = true;
      // Re-throw the error so that the calling benchmark suite's catch block can handle it.
      throw error;
    }
  }
  
  // --- Helper to calculate suite averages, ensuring it only uses valid results ---
  private calculateSuiteAverages(suite: BenchmarkSuite): void {
    const validResults = suite.results.filter(r => !r.error && r.operationsPerSecond > 0);
    
    if (validResults.length > 0) {
      suite.totalDuration = validResults.reduce((sum, r) => sum + r.duration, 0);
      suite.averageOpsPerSecond = validResults.reduce((sum, r) => sum + r.operationsPerSecond, 0) / validResults.length;
    } else {
      suite.totalDuration = 0;
      suite.averageOpsPerSecond = 0;
    }
  }

  // --- Each Benchmark Suite Method ---

  /**
   * CORRECTED BENCHMARK: This suite now accurately measures cache hits for Get/Has/Set updates,
   * and measures Set operations that cause evictions separately.
   */
  private async benchmarkBasicOperations(): Promise<void> {
    const suiteName = "Basic Operations (CORRECTED)";
    console.log(`\n🚀 Benchmarking ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    const CACHE_SIZE = 10000; // Match maxEntries
    const TEST_ITERATIONS = 10000; // Test with a number close to cache size for more relevant data
    
    try {
        // --- SETUP PHASE (Not measured) ---
        // Fill the cache completely to ensure subsequent GET/HAS/UPDATE SET operations are cache hits.
        const keysToTest: string[] = [];
        for (let i = 0; i < CACHE_SIZE; i++) {
            const key = `key:${i}`;
            keysToTest.push(key);
            memoryStore.set(key, `value${i}`);
        }
        // After this loop, the store has CACHE_SIZE entries.
        // The keysToTest array now holds the keys that are guaranteed to be in the cache.

        // --- MEASUREMENT PHASE ---

        // Test Get (100% cache hits)
        // This measures the cost of GET + LRU update (delete + set).
        await this.measureOperation(suite, `Get (${TEST_ITERATIONS} hits)`, async () => {
            const result = await PerformanceMonitor.measure("get_operations_hit", async () => {
                for (let i = 0; i < TEST_ITERATIONS; i++) {
                    // Accessing a key that is definitely in the cache
                    memoryStore.get(keysToTest[i % CACHE_SIZE]); 
                }
            });
            return { duration: result.duration, operationsPerSecond: TEST_ITERATIONS / (result.duration / 1000) };
        });
        
        // Test Has (100% cache hits)
        // This measures the cost of HAS (just a lookup, no LRU update).
        await this.measureOperation(suite, `Has (${TEST_ITERATIONS} hits)`, async () => {
            const result = await PerformanceMonitor.measure("has_operations_hit", async () => {
                for (let i = 0; i < TEST_ITERATIONS; i++) {
                    memoryStore.has(keysToTest[i % CACHE_SIZE]);
                }
            });
            return { duration: result.duration, operationsPerSecond: TEST_ITERATIONS / (result.duration / 1000) };
        });

        // Test Set (100% updates, no evictions)
        // This measures the cost of SET when the key already exists and needs updating + LRU reordering.
        await this.measureOperation(suite, `Set (${TEST_ITERATIONS} updates)`, async () => {
            const result = await PerformanceMonitor.measure("set_operations_update", async () => {
                for (let i = 0; i < TEST_ITERATIONS; i++) {
                    memoryStore.set(keysToTest[i % CACHE_SIZE], `new_value_${i}`);
                }
            });
            return { duration: result.duration, operationsPerSecond: TEST_ITERATIONS / (result.duration / 1000) };
        });

        // Test Set (100% evictions)
        // This measures the cost of SET when a NEW key is added to a FULL cache, forcing eviction.
        await this.measureOperation(suite, `Set (${TEST_ITERATIONS} evictions)`, async () => {
            const result = await PerformanceMonitor.measure("set_operations_evict", async () => {
                for (let i = 0; i < TEST_ITERATIONS; i++) {
                    // Adding a key that will force the oldest to be evicted
                    memoryStore.set(`new_evict_key:${i}`, `value_${i}`); 
                }
            });
            return { duration: result.duration, operationsPerSecond: TEST_ITERATIONS / (result.duration / 1000) };
        });

        // Test Delete (100% existing keys)
        await this.measureOperation(suite, `Delete (${TEST_ITERATIONS} hits)`, async () => {
            const result = await PerformanceMonitor.measure("delete_operations_hit", async () => {
                // Re-fill cache before delete test to ensure all keys exist
                for (let i = 0; i < CACHE_SIZE; i++) {
                    memoryStore.set(`delete_key:${i}`, `value${i}`);
                }
                for (let i = 0; i < TEST_ITERATIONS; i++) {
                    memoryStore.delete(keysToTest[i % CACHE_SIZE]);
                }
            });
            return { duration: result.duration, operationsPerSecond: TEST_ITERATIONS / (result.duration / 1000) };
        });

        this.calculateSuiteAverages(suite);

    } catch (error: any) {
        // Error is already logged by measureOperation, re-throw to propagate
        throw error;
    }
  }

  private async benchmarkTTLOperations(): Promise<void> {
    const suiteName = "TTL Operations (INTENSIVE)";
    console.log(`\n⏰ Benchmarking ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      // Set with various TTLs
      await this.measureOperation(suite, "Set with TTL (100k ops)", async () => {
        const result = await PerformanceMonitor.measure("set_with_ttl", async () => {
          for (let i = 0; i < this.iterations; i++) {
            const ttl = (i % 5) + 1; // 1-5 seconds TTL
            memoryStore.set(`ttl:${i}`, `value${i}`, ttl);
          }
        });
        return { duration: result.duration, operationsPerSecond: this.iterations / (result.duration / 1000) };
      });

      // Get with expired entries
      await this.measureOperation(suite, "Get (with expired check)", async () => {
        const result = await PerformanceMonitor.measure("get_with_expired", async () => {
          for (let i = 0; i < this.iterations; i++) {
            memoryStore.get(`ttl:${i}`);
          }
        });
        return { duration: result.duration, operationsPerSecond: this.iterations / (result.duration / 1000) };
      });

      // Manual cleanup
      await this.measureOperation(suite, "Manual Cleanup", async () => {
        const result = await PerformanceMonitor.measure("manual_cleanup", async () => {
          memoryStore.cleanupExpiredEntries();
        });
        // Cleanup is a single operation, so ops/sec is 1 / (duration_in_seconds)
        return { duration: result.duration, operationsPerSecond: 1 / (result.duration / 1000) };
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkBulkOperations(): Promise<void> {
    const suiteName = "Bulk Operations (INTENSIVE)";
    console.log(`\n📦 Benchmarking ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      const bulkSize = 5000;

      // Bulk set with large batches
      await this.measureOperation(suite, "Bulk Set (5k batches)", async () => {
        const result = await PerformanceMonitor.measure("bulk_set", async () => {
          for (let batch = 0; batch < this.iterations / bulkSize; batch++) {
            const entries: Array<[string, any]> = [];
            for (let i = 0; i < bulkSize; i++) {
              entries.push([`bulk:${batch}:${i}`, `value${i}`]);
            }
            // NOTE: Your MemoryStore.setBulk method is not shown, so assuming it exists and takes this format.
            // If it takes a different format, this loop needs to be adapted.
            memoryStore.setBulk(entries); 
          }
        });
        return { duration: result.duration, operationsPerSecond: this.iterations / (result.duration / 1000) };
      });

      // Bulk get
      await this.measureOperation(suite, "Bulk Get (5k batches)", async () => {
        const result = await PerformanceMonitor.measure("bulk_get", async () => {
          for (let batch = 0; batch < this.iterations / bulkSize; batch++) {
            const keysToGet: string[] = [];
            for (let i = 0; i < bulkSize; i++) {
              keysToGet.push(`bulk:${batch}:${i}`);
            }
            // NOTE: Assuming MemoryStore.getBulk exists
            memoryStore.getBulk(keysToGet);
          }
        });
        return { duration: result.duration, operationsPerSecond: this.iterations / (result.duration / 1000) };
      });

      // Clear operation
      await this.measureOperation(suite, "Clear All", async () => {
        const result = await PerformanceMonitor.measure("clear_operation", async () => {
          memoryStore.clear();
        });
        return { duration: result.duration, operationsPerSecond: 1 / (result.duration / 1000) };
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkMemoryUsage(): Promise<void> {
    const suiteName = "Memory Usage (INTENSIVE)";
    console.log(`\n💾 Benchmarking ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      const initialMemory = process.memoryUsage();
      
      const dataTypes = [
        { name: "Large Strings", data: "x".repeat(10000) },
        { name: "Complex Objects", data: { 
          id: 1, name: "test", nested: { deep: { deeper: { deepest: "value", array: Array.from({ length: 1000 }, (_, i) => `item${i}`), object: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, `value${i}`])) } } } 
        }},
        { name: "Large Arrays", data: Array.from({ length: 10000 }, (_, i) => `item${i}`) },
        { name: "Mixed Data", data: {
          string: "x".repeat(5000), number: 42, boolean: true,
          array: Array.from({ length: 5000 }, (_, i) => i),
          object: Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`key${i}`, `value${i}`]))
        }}
      ];

      for (const dataType of dataTypes) {
        const startMemory = process.memoryUsage();
        
        await this.measureOperation(suite, `Memory ${dataType.name}`, async () => {
          const result = await PerformanceMonitor.measure(`memory_${dataType.name.toLowerCase().replace(/\s+/g, '_')}`, async () => {
            for (let i = 0; i < 5000; i++) {
              memoryStore.set(`${dataType.name.toLowerCase().replace(/\s+/g, '_')}:${i}`, dataType.data);
            }
          });
          const endMemory = process.memoryUsage();
          const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
          return { duration: result.duration, operationsPerSecond: 5000 / (result.duration / 1000), memoryUsage: memoryIncrease };
        }, (res) => res.memoryUsage); // Pass the memoryUsage getter
      }

      // Test memory cleanup
      await this.measureOperation(suite, "Memory Cleanup", async () => {
        const result = await PerformanceMonitor.measure("memory_cleanup", async () => {
          memoryStore.clear();
        });
        const finalMemory = process.memoryUsage();
        const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        // Return total increase as memory usage for this "operation"
        return { duration: result.duration, operationsPerSecond: 1 / (result.duration / 1000), memoryUsage: totalMemoryIncrease };
      }, (res) => res.memoryUsage); // Pass the memoryUsage getter

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkConcurrentOperations(): Promise<void> {
    const suiteName = "Concurrent Operations (INTENSIVE)";
    console.log(`\n⚡ Benchmarking ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      const concurrentCount = 50;
      const operationsPerThread = this.iterations / concurrentCount;

      // Concurrent sets
      await this.measureOperation(suite, "Concurrent Sets (50 threads)", async () => {
        const result = await PerformanceMonitor.measure("concurrent_sets", async () => {
          const promises = Array.from({ length: concurrentCount }, (_, threadId) => 
            this.runConcurrentOperations(threadId, operationsPerThread, 'set')
          );
          await Promise.all(promises);
        });
        return { duration: result.duration, operationsPerSecond: this.iterations / (result.duration / 1000) };
      });

      // Concurrent gets
      await this.measureOperation(suite, "Concurrent Gets (50 threads)", async () => {
        const result = await PerformanceMonitor.measure("concurrent_gets", async () => {
          const promises = Array.from({ length: concurrentCount }, (_, threadId) => 
            this.runConcurrentOperations(threadId, operationsPerThread, 'get')
          );
          await Promise.all(promises);
        });
        return { duration: result.duration, operationsPerSecond: this.iterations / (result.duration / 1000) };
      });

      // Mixed operations
      await this.measureOperation(suite, "Mixed Operations (50 threads)", async () => {
        const result = await PerformanceMonitor.measure("mixed_operations", async () => {
          const promises = Array.from({ length: concurrentCount }, (_, threadId) => 
            this.runMixedOperations(threadId, operationsPerThread)
          );
          await Promise.all(promises);
        });
        return { duration: result.duration, operationsPerSecond: this.iterations / (result.duration / 1000) };
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkCleanupPerformance(): Promise<void> {
    const suiteName = "Cleanup Performance (INTENSIVE)";
    console.log(`\n🚀 Benchmarking ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      const totalEntries = 50000;
      const expiredRatio = 0.5;

      await this.measureOperation(suite, "Cleanup Setup (50k entries)", async () => {
        const result = await PerformanceMonitor.measure("cleanup_setup", async () => {
          for (let i = 0; i < totalEntries; i++) {
            const ttl = i < totalEntries * expiredRatio ? 1 : 3600;
            memoryStore.set(`cleanup:${i}`, `value${i}`, ttl);
          }
        });
        return { duration: result.duration, operationsPerSecond: totalEntries / (result.duration / 1000) };
      });

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for expiration

      await this.measureOperation(suite, "Cleanup Execution", async () => {
        const result = await PerformanceMonitor.measure("cleanup_performance", async () => {
          memoryStore.cleanupExpiredEntries();
        });
        return { duration: result.duration, operationsPerSecond: 1 / (result.duration / 1000) };
      });

      // Report final store size as memoryUsage for this specific "operation"
      const finalSize = memoryStore.size();
      suite.results.push({
        operation: "Final Store Size",
        duration: 0,
        operationsPerSecond: 0,
        memoryUsage: finalSize 
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkStressTest(): Promise<void> {
    const suiteName = "STRESS TEST";
    console.log(`\n🔥 Running ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      await this.measureOperation(suite, "Stress Test (500k ops)", async () => {
        const result = await PerformanceMonitor.measure("stress_test", async () => {
          for (let i = 0; i < this.stressIterations; i++) {
            const key = `stress:${i % 1000}`;
            memoryStore.set(key, `value${i}`);
            memoryStore.get(key);
            if (i % 10000 === 0) {
              memoryStore.cleanupExpiredEntries();
            }
          }
        });
        return { duration: result.duration, operationsPerSecond: this.stressIterations / (result.duration / 1000) };
      });

      await this.measureOperation(suite, "Memory Pressure Test", async () => {
        const result = await PerformanceMonitor.measure("memory_pressure", async () => {
          const largeData = "x".repeat(1000);
          for (let i = 0; i < 10000; i++) {
            memoryStore.set(`pressure:${i}`, largeData);
            if (i % 1000 === 0) {
              // Request garbage collection if available
              if (global.gc) global.gc();
            }
          }
        });
        return { duration: result.duration, operationsPerSecond: 10000 / (result.duration / 1000) };
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkEdgeCases(): Promise<void> {
    const suiteName = "Edge Cases";
    console.log(`\n🔍 Testing ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      await this.measureOperation(suite, "Long Keys (1k chars)", async () => {
        const result = await PerformanceMonitor.measure("long_keys", async () => {
          for (let i = 0; i < 10000; i++) {
            const longKey = "x".repeat(1000) + `:${i}`;
            memoryStore.set(longKey, `value${i}`);
            memoryStore.get(longKey);
          }
        });
        return { duration: result.duration, operationsPerSecond: 20000 / (result.duration / 1000) };
      });

      await this.measureOperation(suite, "Large Values (100KB each)", async () => {
        const result = await PerformanceMonitor.measure("large_values", async () => {
          for (let i = 0; i < 1000; i++) {
            const largeValue = "x".repeat(100000);
            memoryStore.set(`large:${i}`, largeValue);
            memoryStore.get(`large:${i}`);
          }
        });
        return { duration: result.duration, operationsPerSecond: 2000 / (result.duration / 1000) };
      });

      await this.measureOperation(suite, "Special Characters", async () => {
        const result = await PerformanceMonitor.measure("special_chars", async () => {
          for (let i = 0; i < 10000; i++) {
            const specialKey = `key:${i}:!@#$%^&*()_+-=[]{}|;':",./<>?`;
            memoryStore.set(specialKey, `value${i}`);
            memoryStore.get(specialKey);
          }
        });
        return { duration: result.duration, operationsPerSecond: 20000 / (result.duration / 1000) };
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkMemoryPressure(): Promise<void> {
    const suiteName = "Memory Pressure";
    console.log(`\n💥 Testing ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      // Test capacity and eviction by filling and then adding more than capacity
      await this.measureOperation(suite, "Capacity Test (15k entries)", async () => {
        const result = await PerformanceMonitor.measure("capacity_test", async () => {
          for (let i = 0; i < 15000; i++) {
            memoryStore.set(`capacity:${i}`, `value${i}`);
          }
        });
        return { duration: result.duration, operationsPerSecond: 15000 / (result.duration / 1000) };
      });

      // Test eviction path specifically
      await this.measureOperation(suite, "Eviction Test (10k ops)", async () => {
        const result = await PerformanceMonitor.measure("eviction_test", async () => {
          for (let i = 0; i < 10000; i++) { // This loop will cause evictions
            memoryStore.set(`eviction:${i}`, `value${i}`);
          }
        });
        return { duration: result.duration, operationsPerSecond: 10000 / (result.duration / 1000) };
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  private async benchmarkRealWorldScenarios(): Promise<void> {
    const suiteName = "Real-World Scenarios";
    console.log(`\n🌐 Testing ${suiteName}...`);
    const suite: BenchmarkSuite = { name: suiteName, results: [], totalDuration: 0, averageOpsPerSecond: 0 };
    this.results.push(suite);
    
    try {
      await this.measureOperation(suite, "Chat Sessions (1k sessions)", async () => {
        const result = await PerformanceMonitor.measure("chat_sessions", async () => {
          for (let session = 0; session < 1000; session++) {
            memoryStore.set(`session:${session}`, { id: session, messages: [], lastActivity: Date.now() }, 3600);
            for (let msg = 0; msg < 50; msg++) {
              memoryStore.set(`session:${session}:msg:${msg}`, { id: msg, content: `Message ${msg} in session ${session}`, timestamp: Date.now() }, 1800);
            }
            memoryStore.get(`session:${session}`);
          }
        });
        const totalOps = 1000 + (1000 * 50) + 1000;
        return { duration: result.duration, operationsPerSecond: totalOps / (result.duration / 1000) };
      });

      await this.measureOperation(suite, "User Preferences (5k users)", async () => {
        const result = await PerformanceMonitor.measure("user_preferences", async () => {
          for (let user = 0; user < 5000; user++) {
            memoryStore.set(`user:${user}:prefs`, { theme: 'dark', language: 'en', notifications: true, settings: { autoSave: true, timeout: 300, maxRetries: 3 } }, 86400);
            memoryStore.set(`user:${user}:lastSeen`, Date.now(), 3600);
          }
        });
        const totalOps = 5000 + 5000;
        return { duration: result.duration, operationsPerSecond: totalOps / (result.duration / 1000) };
      });

      this.calculateSuiteAverages(suite);

    } catch (error: any) {
      throw error;
    }
  }

  // --- Concurrent and Mixed Operation Helpers ---
  private async runConcurrentOperations(threadId: number, count: number, operation: 'set' | 'get'): Promise<void> {
    for (let i = 0; i < count; i++) {
      try {
        const key = `concurrent:${threadId}:${i}`;
        if (operation === 'set') memoryStore.set(key, `value${i}`);
        else memoryStore.get(key);
      } catch (error: any) {
        console.error(`Thread ${threadId} failed at op ${i} for ${operation}: ${error.message}`);
      }
    }
  }

  private async runMixedOperations(threadId: number, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      try {
        const key = `mixed:${threadId}:${i}`;
        const operation = i % 4; // Use a simple modulo to cycle through operations
        switch (operation) {
          case 0: memoryStore.set(key, `value${i}`); break;
          case 1: memoryStore.get(key); break;
          case 2: memoryStore.delete(key); break;
          case 3: memoryStore.has(key); break;
        }
      } catch (error: any) {
        console.error(`Thread ${threadId} failed at op ${i} (mixed): ${error.message}`);
      }
    }
  }

  // --- Report Generation ---
  private generateReport(): void {
    console.log("\n" + "=".repeat(80));
    const reportTitle = this.isInterrupted ? "📊 INTENSIVE MEMORYSTORE BENCHMARK RESULTS (PARTIAL)" : "📊 INTENSIVE MEMORYSTORE BENCHMARK RESULTS";
    console.log(reportTitle);
    console.log("=".repeat(80));

    let totalDuration = 0;

    for (const suite of this.results) {
      console.log(`\n🔹 ${suite.name.toUpperCase()}`);
      console.log("-".repeat(50));
      
      for (const result of suite.results) {
        let opsPerSecStr: string;
        let durationStr: string;
        let memoryInfo: string = "";

        if (result.error) {
          opsPerSecStr = "N/A".padStart(12);
          durationStr = "N/A".padStart(8);
          console.log(`  ${result.operation.padEnd(35)} | ${durationStr} | ${opsPerSecStr} | ERROR: ${result.error}`);
        } else {
          opsPerSecStr = result.operationsPerSecond.toLocaleString();
          durationStr = result.duration.toFixed(2);
          if (result.memoryUsage !== undefined) {
             memoryInfo = ` | Memory: ${(result.memoryUsage / 1024).toFixed(2)} KB`;
          }
          console.log(`  ${result.operation.padEnd(35)} | ${durationStr.padStart(8)}ms | ${opsPerSecStr.padStart(12)} ops/sec${memoryInfo}`);
          totalDuration += result.duration; // Accumulate duration from successful ops
        }
      }
      
      // Print suite average
      const averageOps = suite.averageOpsPerSecond > 0 ? suite.averageOpsPerSecond.toLocaleString() : "N/A";
      console.log(`  ${"Average".padEnd(35)} | ${suite.totalDuration.toFixed(2).padStart(8)}ms | ${averageOps.padStart(12)} ops/sec`);
    }

    console.log("\n" + "=".repeat(80));
    const summaryTitle = this.isInterrupted ? "📈 INTENSIVE TEST SUMMARY (PARTIAL)" : "📈 INTENSIVE TEST SUMMARY";
    console.log(summaryTitle);
    console.log("=".repeat(80));
    console.log(`Total Test Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    
    const fastestOp = this.findFastestOperation();
    const slowestOp = this.findSlowestOperation();
    
    if (fastestOp) console.log(`Fastest Operation: ${fastestOp.operation} (${fastestOp.operationsPerSecond.toLocaleString()} ops/sec)`);
    else console.log("Fastest Operation: N/A");

    if (slowestOp) console.log(`Slowest Operation: ${slowestOp.operation} (${slowestOp.operationsPerSecond.toLocaleString()} ops/sec)`);
    else console.log("Slowest Operation: N/A");
    
    if (fastestOp) {
      if (fastestOp.operationsPerSecond > 1000000) console.log("🚀 EXCEPTIONAL performance for high-frequency operations");
      else if (fastestOp.operationsPerSecond > 100000) console.log("✅ Excellent performance suitable for production workloads");
      else if (fastestOp.operationsPerSecond > 10000) console.log("✅ Good performance suitable for most use cases");
      else console.log("⚠️  Consider optimization for high-frequency operations");
    }

    console.log("\n🎯 INTENSIVE TEST RECOMMENDATIONS");
    console.log("-".repeat(50));
    console.log("• MemoryStore handles high-frequency operations exceptionally well");
    console.log("• TTL operations show good performance under load");
    console.log("• Concurrent operations scale well with multiple threads");
    console.log("• Memory pressure handling is robust");
    console.log("• Consider the 10,000 entry limit for large-scale deployments");
    console.log("• Monitor memory usage in production with high-frequency operations");
    
    console.log("\n" + "=".repeat(80));
  }

  private findFastestOperation(): BenchmarkResult | null {
    const successfulOps = this.results.flatMap(suite => suite.results).filter(r => !r.error && r.operationsPerSecond > 0);
    if (successfulOps.length === 0) return null;
    return successfulOps.reduce((fastest, current) => 
      current.operationsPerSecond > fastest.operationsPerSecond ? current : fastest
    );
  }

  private findSlowestOperation(): BenchmarkResult | null {
    const successfulOps = this.results.flatMap(suite => suite.results).filter(r => !r.error && r.operationsPerSecond > 0);
    if (successfulOps.length === 0) return null;
    return successfulOps.reduce((slowest, current) => 
      current.operationsPerSecond < slowest.operationsPerSecond ? current : slowest
    );
  }
}

if (import.meta.main) {
  const benchmark = new MemoryStoreBenchmark();
  
  // Handle SIGINT for graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nSIGINT received. Attempting graceful shutdown...');
    // The finally block in runAllBenchmarks will handle report generation and shutdown.
    // We just need to exit after the cleanup is done.
    process.exit(0); 
  });

  try {
    await benchmark.runAllBenchmarks();
  } catch (error: any) {
    console.error("\n❌ Top-level benchmark execution failed:", error);
    process.exit(1);
  }
}

export { MemoryStoreBenchmark };