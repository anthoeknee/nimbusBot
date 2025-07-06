// Import unified memory types
import type {
  EntityId,
  MemoryRow,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryAnalytics,
  ConsolidationCandidate,
  MemoryRelationship,
  MemoryRecord,
  MemoryImportanceValue,
  MemoryCategoryType,
  DatabaseOperationResult,
  DatabaseOperationSuccess,
  DatabaseOperationError,
  SimilarityResult,
} from "../../types/memory";

// Re-export unified memory types for convenience
export type {
  EntityId,
  MemoryRow,
  CreateMemoryInput,
  UpdateMemoryInput,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryAnalytics,
  ConsolidationCandidate,
  MemoryRelationship,
  MemoryRecord,
  MemoryImportanceValue,
  MemoryCategoryType,
  DatabaseOperationResult,
  DatabaseOperationSuccess,
  DatabaseOperationError,
  SimilarityResult,
};

// Alias for backward compatibility
export type VectorSearchOptions = MemorySearchOptions;

export type DiscordId = string;

// Database row types
export interface UserRow {
  id: EntityId;
  discordId: DiscordId;
  username: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuildRow {
  id: EntityId;
  discordGuildId: DiscordId;
  name: string;
  iconUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingRow {
  id: EntityId;
  targetType: "user" | "guild";
  userId: EntityId | null;
  guildId: EntityId | null;
  key: string;
  value: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

// Verification config for guild verification feature
export interface VerificationConfig {
  enabled: boolean;
  channelId: string;
  messageId?: string;
  acceptEmoji: string;
  rejectEmoji: string;
  roleId: string;
  kickOnReject?: boolean;
  lastUpdated?: string;
}

// Input types for create operations
export interface CreateUserInput {
  discordId: DiscordId;
  username: string;
  displayName: string;
}

export interface CreateGuildInput {
  discordGuildId: DiscordId;
  name: string;
  iconUrl?: string;
}

export interface CreateSettingInput {
  targetType: "user" | "guild";
  userId?: EntityId;
  guildId?: EntityId;
  key: string;
  value: any;
}

// Input types for update operations
export interface UpdateUserInput {
  username?: string;
  displayName?: string;
}

export interface UpdateGuildInput {
  name?: string;
  iconUrl?: string;
}

export interface UpdateSettingInput {
  value?: any;
}

// Type guards for database operations
export function isUserRow(obj: unknown): obj is UserRow {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "discordId" in obj &&
    "username" in obj &&
    typeof (obj as any).id === "number" &&
    typeof (obj as any).discordId === "string" &&
    typeof (obj as any).username === "string"
  );
}

export function isGuildRow(obj: unknown): obj is GuildRow {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "discordGuildId" in obj &&
    "name" in obj &&
    typeof (obj as any).id === "number" &&
    typeof (obj as any).discordGuildId === "string" &&
    typeof (obj as any).name === "string"
  );
}

export function isSettingRow(obj: unknown): obj is SettingRow {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "targetType" in obj &&
    "key" in obj &&
    "value" in obj &&
    typeof (obj as any).id === "number" &&
    typeof (obj as any).targetType === "string" &&
    typeof (obj as any).key === "string" &&
    typeof (obj as any).value === "string"
  );
}

// Repository operation result types
export interface RepositoryOperationSuccess<T = any> {
  success: true;
  data: T;
  message?: string;
  count?: number;
}

export interface RepositoryOperationError {
  success: false;
  error: string;
  details?: any;
}

export type RepositoryOperationResult<T = any> =
  | RepositoryOperationSuccess<T>
  | RepositoryOperationError;

// Pagination types
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Query building types
export interface WhereCondition {
  field: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "LIKE" | "IN" | "NOT IN";
  value: any;
}

export interface QueryOptions {
  where?: WhereCondition[];
  orderBy?: Array<{ field: string; direction: "ASC" | "DESC" }>;
  limit?: number;
  offset?: number;
}

// Legacy Prisma-style generic types (kept for compatibility)
export type CreateInput<T> = T extends "user"
  ? CreateUserInput
  : T extends "guild"
    ? CreateGuildInput
    : T extends "setting"
      ? CreateSettingInput
      : T extends "memory"
        ? CreateMemoryInput
        : never;

export type UpdateInput<T> = T extends "user"
  ? UpdateUserInput
  : T extends "guild"
    ? UpdateGuildInput
    : T extends "setting"
      ? UpdateSettingInput
      : T extends "memory"
        ? UpdateMemoryInput
        : never;

export type DatabaseRow<T> = T extends "user"
  ? UserRow
  : T extends "guild"
    ? GuildRow
    : T extends "setting"
      ? SettingRow
      : T extends "memory"
        ? MemoryRow
        : never;

// Database table names as literal types
export type TableName =
  | "users"
  | "guilds"
  | "settings"
  | "memories"
  | "memory_relationships";

// Configuration for database operations
export interface DatabaseConfig {
  maxRetries: number;
  retryDelay: number;
  connectionTimeout: number;
  queryTimeout: number;
  enableWAL: boolean;
  cacheSize: number;
  mmapSize: number;
}

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  connectionTimeout: 5000,
  queryTimeout: 30000,
  enableWAL: true,
  cacheSize: 64000, // 64MB
  mmapSize: 268435456, // 256MB
} as const;

// Validation helpers
export function validateEntityId(id: unknown): id is EntityId {
  return typeof id === "number" && id > 0 && Number.isInteger(id);
}

export function validateDiscordId(id: unknown): id is DiscordId {
  return (
    typeof id === "string" &&
    /^\d+$/.test(id) &&
    id.length >= 17 &&
    id.length <= 19
  );
}

// Error types for database operations
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly table?: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(
    message: string,
    public readonly table: string,
    public readonly id: EntityId | DiscordId,
  ) {
    super(message);
    this.name = "NotFoundError";
  }
}
