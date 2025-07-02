import { Setting, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { EntityId } from '../types';

export class SettingRepository extends BaseRepository<Setting, Prisma.SettingCreateInput, Prisma.SettingUpdateInput> {
  protected readonly modelName = Prisma.ModelName.Setting;

  async findByUser(userId: EntityId): Promise<Setting[]> {
    return await this.findMany({ userId });
  }

  async findByGuild(guildId: EntityId): Promise<Setting[]> {
    return await this.findMany({ guildId });
  }

  async findByKey(key: string, userId?: EntityId, guildId?: EntityId): Promise<Setting | null> {
    const where: any = { key };
    if (userId) where.userId = userId;
    if (guildId) where.guildId = guildId;

    try {
      return await this.model.findFirst({ where });
    } catch (error) {
      throw new Error(`Failed to find setting by key: ${error}`);
    }
  }

  async setSetting(key: string, value: string, userId?: EntityId, guildId?: EntityId): Promise<Setting> {
    const where: any = { key };
    if (userId) where.userId = userId;
    if (guildId) where.guildId = guildId;

    return await this.upsert(
      where,
      {
        key,
        value,
        ...(userId && { user: { connect: { id: userId } } }),
        ...(guildId && { guild: { connect: { id: guildId } } }),
        targetType: ''
      },
      { value }
    );
  }

  async deleteBySetting(key: string, userId?: EntityId, guildId?: EntityId): Promise<Setting | null> {
    const setting = await this.findByKey(key, userId, guildId);
    if (!setting) return null;

    return await this.delete(setting.id);
  }
}