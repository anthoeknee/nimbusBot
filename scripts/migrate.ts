#!/usr/bin/env bun
// scripts/migrate.ts

import { join } from "path";
import { mkdir } from "fs/promises";
import { Database } from "bun:sqlite";
import { logger } from "../src/utils/logger";

async function migrate() {
  try {
    logger.info("🔄 Starting database migration...");
