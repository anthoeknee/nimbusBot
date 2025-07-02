import { Guild, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { DiscordId } from '../types';

export class GuildRepository extends BaseRepository<Guild, Prisma.GuildCreateInput, Prisma.GuildUpdateInput> {
  protected readonly modelName = Prisma.ModelName.Guild;

  async findByDiscordId(discordGuildId: DiscordId): Promise<Guild | null> {
    try {
      return await this.model.findUnique({ where: { discordGuildId } });
    } catch (error) {
      throw new Error(`Failed to find guild by Discord ID: ${error}`);
    }
  }

  async findOrCreateByDiscordId(discordGuildId: DiscordId, guildData?: Partial<Prisma.GuildCreateInput>): Promise<Guild> {
    const existingGuild = await this.findByDiscordId(discordGuildId);
    if (existingGuild) return existingGuild;

    // Ensure required fields are present and types are correct
    const createData: Prisma.GuildCreateInput = {
      discordGuildId,
      name: guildData?.name ?? '', // Provide a default or handle as needed
      iconUrl: guildData?.iconUrl ?? null,
    };

    return await this.create(createData);
  }

  async updateByDiscordId(discordGuildId: DiscordId, data: Prisma.GuildUpdateInput): Promise<Guild> {
    try {
      return await this.model.update({ where: { discordGuildId }, data });
    } catch (error) {
      throw new Error(`Failed to update guild by Discord ID: ${error}`);
    }
  }
}