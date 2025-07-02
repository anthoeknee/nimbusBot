import { Prisma } from '@prisma/client';

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

export type CreateInput<T> = T extends 'user' ? Prisma.UserCreateInput
  : T extends 'guild' ? Prisma.GuildCreateInput
  : T extends 'setting' ? Prisma.SettingCreateInput
  : T extends 'memory' ? Prisma.MemoryCreateInput
  : never;

export type UpdateInput<T> = T extends 'user' ? Prisma.UserUpdateInput
  : T extends 'guild' ? Prisma.GuildUpdateInput
  : T extends 'setting' ? Prisma.SettingUpdateInput
  : T extends 'memory' ? Prisma.MemoryUpdateInput
  : never;