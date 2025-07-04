import { Prisma } from "@prisma/client";

export type EntityId = number;
export type DiscordId = string;

export interface VectorSearchOptions {
  userId?: EntityId;
  guildId?: EntityId;
  topK?: number;
}

export interface SimilarityResult<T> {
  data: T;
  similarity: number;
}

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
  targetType: string;
  userId: EntityId | null;
  guildId: EntityId | null;
  key: string;
  value: string; // JSON string
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRow {
  id: EntityId;
  userId: EntityId | null;
  guildId: EntityId | null;
  content: string;
  embedding: string; // JSON array string
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
  targetType: string;
  userId?: EntityId;
  guildId?: EntityId;
  key: string;
  value: any;
}

export interface CreateMemoryInput {
  userId?: EntityId;
  guildId?: EntityId;
  content: string;
  embedding: number[];
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

export interface UpdateMemoryInput {
  content?: string;
  embedding?: number[];
}

export type CreateInput<T> = T extends "user"
  ? Prisma.UserCreateInput
  : T extends "guild"
  ? Prisma.GuildCreateInput
  : T extends "setting"
  ? Prisma.SettingCreateInput
  : T extends "memory"
  ? Prisma.MemoryCreateInput
  : never;

export type UpdateInput<T> = T extends "user"
  ? Prisma.UserUpdateInput
  : T extends "guild"
  ? Prisma.GuildUpdateInput
  : T extends "setting"
  ? Prisma.SettingUpdateInput
  : T extends "memory"
  ? Prisma.MemoryUpdateInput
  : never;
