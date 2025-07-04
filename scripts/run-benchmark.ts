#!/usr/bin/env bun

import { MemoryStoreBenchmark } from "./benchmark_kv"

async function main() {
  console.log("🚀 MemoryStore Benchmark Runner");
  console.log("=".repeat(50));
  
  const benchmark = new MemoryStoreBenchmark();
  
  try {
    await benchmark.runAllBenchmarks();
    console.log("\n✅ Benchmark completed successfully!");
  } catch (error) {
    console.error("\n❌ Benchmark failed:", error);
    process.exit(1);
  }
}

main(); 