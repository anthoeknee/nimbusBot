import { User, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { DiscordId } from '../types';

export class UserRepository extends BaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  protected readonly modelName = Prisma.ModelName.User;

  async findByDiscordId(discordId: DiscordId): Promise<User | null> {
    try {
      return await this.model.findUnique({ where: { discordId } });
    } catch (error) {
      throw new Error(`Failed to find user by Discord ID: ${error}`);
    }
  }

  async findOrCreateByDiscordId(discordId: DiscordId, userData?: Partial<Prisma.UserCreateInput>): Promise<User> {
    const existingUser = await this.findByDiscordId(discordId);
    if (existingUser) return existingUser;

    return await this.create({
      discordId,
      ...Object.fromEntries(
        Object.entries(userData ?? {}).filter(([_, v]) => v !== undefined)
      ),
      username: '',
      displayName: ''
    });
  }

  async updateByDiscordId(discordId: DiscordId, data: Prisma.UserUpdateInput): Promise<User> {
    try {
      return await this.model.update({ where: { discordId }, data });
    } catch (error) {
      throw new Error(`Failed to update user by Discord ID: ${error}`);
    }
  }
}