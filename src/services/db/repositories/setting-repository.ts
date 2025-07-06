import { BaseRepository } from "./base-repository";
import { SettingRow, CreateSettingInput, UpdateSettingInput, EntityId } from "../types";
import { safeJsonParse, safeJsonStringify } from "../client";

export class SettingRepository extends BaseRepository<
  SettingRow,
  CreateSettingInput,
  UpdateSettingInput
> {
  protected readonly tableName = "settings";

  async findByUser(userId: EntityId): Promise<SettingRow[]> {
    return await this.findMany({ userId });
  }

  async findByGuild(guildId: EntityId): Promise<SettingRow[]> {
    return await this.findMany({ guildId });
  }

  async findByKey(
    key: string,
    userId?: EntityId,
    guildId?: EntityId,
  ): Promise<SettingRow | null> {
    try {
      let query = "SELECT * FROM settings WHERE key = ?";
      const params: any[] = [key];

      if (userId) {
        query += " AND userId = ?";
        params.push(userId);
      } else if (guildId) {
        query += " AND guildId = ?";
        params.push(guildId);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as SettingRow | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find setting by key: ${error}`);
    }
  }

  async setSetting(
    key: string,
    value: any,
    userId?: EntityId,
    guildId?: EntityId,
  ): Promise<SettingRow> {
    const existingSetting = await this.findByKey(key, userId, guildId);

    if (existingSetting) {
      return await this.update(existingSetting.id, {
        value: safeJsonStringify(value),
      });
    } else {
      const createData: CreateSettingInput = {
        targetType: userId ? "user" : "guild",
        userId,
        guildId,
        key,
        value: safeJsonStringify(value),
      };
      return await this.create(createData);
    }
  }

  async deleteBySetting(
    key: string,
    userId?: EntityId,
    guildId?: EntityId,
  ): Promise<SettingRow | null> {
    const setting = await this.findByKey(key, userId, guildId);
    if (!setting) return null;
    return await this.delete(setting.id);
  }

  async create(data: CreateSettingInput): Promise<SettingRow> {
    const serializedData = {
      ...data,
      value: safeJsonStringify(data.value),
    };
    return await super.create(serializedData);
  }

  async createMany(data: CreateSettingInput[]): Promise<SettingRow[]> {
    const serializedData = data.map((item) => ({
      ...item,
      value: safeJsonStringify(item.value),
    }));
    return await super.createMany(serializedData);
  }

  async getSettingValue<T = any>(
    key: string,
    userId?: EntityId,
    guildId?: EntityId,
  ): Promise<T | null> {
    const setting = await this.findByKey(key, userId, guildId);
    if (!setting) return null;
    return safeJsonParse<T>(setting.value);
  }
}
