import {
  SettingRow,
  CreateSettingInput,
  UpdateSettingInput,
  EntityId,
} from "../types";
import { safeJsonParse, safeJsonStringify } from "../client";
import { db } from "../client";

export class SettingRepository {
  private readonly table = "settings";

  async findByUser(userId: EntityId): Promise<SettingRow[]> {
    const stmt = db.prepare(`SELECT * FROM settings WHERE userId = ?`);
    return stmt.all(userId) as SettingRow[];
  }

  async findByGuild(guildId: EntityId): Promise<SettingRow[]> {
    const stmt = db.prepare(`SELECT * FROM settings WHERE guildId = ?`);
    return stmt.all(guildId) as SettingRow[];
  }

  async findByKey(
    key: string,
    userId?: EntityId,
    guildId?: EntityId
  ): Promise<SettingRow | null> {
    let query = "SELECT * FROM settings WHERE key = ?";
    const params: any[] = [key];
    if (userId) {
      query += " AND userId = ?";
      params.push(userId);
    } else if (guildId) {
      query += " AND guildId = ?";
      params.push(guildId);
    }
    const stmt = db.prepare(query);
    const result = stmt.get(...params) as SettingRow | undefined;
    return result || null;
  }

  async setSetting(
    key: string,
    value: any,
    userId?: EntityId,
    guildId?: EntityId
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
    guildId?: EntityId
  ): Promise<SettingRow | null> {
    const setting = await this.findByKey(key, userId, guildId);
    if (!setting) return null;
    return await this.delete(setting.id);
  }

  async create(data: CreateSettingInput): Promise<SettingRow> {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO settings (targetType, userId, guildId, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    );
    return stmt.get(
      data.targetType,
      data.userId ?? null,
      data.guildId ?? null,
      data.key,
      safeJsonStringify(data.value),
      now,
      now
    ) as SettingRow;
  }

  async createMany(data: CreateSettingInput[]): Promise<SettingRow[]> {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO settings (targetType, userId, guildId, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`
    );
    const results: SettingRow[] = [];
    for (const item of data) {
      results.push(
        stmt.get(
          item.targetType,
          item.userId ?? null,
          item.guildId ?? null,
          item.key,
          safeJsonStringify(item.value),
          now,
          now
        ) as SettingRow
      );
    }
    return results;
  }

  async update(id: EntityId, data: UpdateSettingInput): Promise<SettingRow> {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(key === "value" ? safeJsonStringify(value) : value);
    }
    values.push(id);
    const stmt = db.prepare(
      `UPDATE settings SET ${fields.join(", ")}, updatedAt = ? WHERE id = ? RETURNING *`
    );
    values.splice(values.length - 1, 0, new Date().toISOString());
    return stmt.get(...values) as SettingRow;
  }

  async delete(id: EntityId): Promise<SettingRow> {
    const stmt = db.prepare(`DELETE FROM settings WHERE id = ? RETURNING *`);
    return stmt.get(id) as SettingRow;
  }

  async getSettingValue<T = any>(
    key: string,
    userId?: EntityId,
    guildId?: EntityId
  ): Promise<T | null> {
    const setting = await this.findByKey(key, userId, guildId);
    if (!setting) return null;
    return safeJsonParse<T>(setting.value);
  }
}
