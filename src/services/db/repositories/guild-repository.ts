import {
  GuildRow,
  CreateGuildInput,
  UpdateGuildInput,
  EntityId,
} from "../types";
import { db } from "../client";

export class GuildRepository {
  private readonly table = "guilds";

  async findByDiscordId(discordGuildId: string): Promise<GuildRow | null> {
    const stmt = db.prepare("SELECT * FROM guilds WHERE discordGuildId = ?");
    const result = stmt.get(discordGuildId) as GuildRow | undefined;
    return result || null;
  }

  async findOrCreateByDiscordId(
    discordGuildId: string,
    guildData?: Partial<CreateGuildInput>
  ): Promise<GuildRow> {
    const existingGuild = await this.findByDiscordId(discordGuildId);
    if (existingGuild) return existingGuild;
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO guilds (discordGuildId, name, iconUrl, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?) RETURNING *`
    );
    return stmt.get(
      discordGuildId,
      guildData?.name ?? "",
      guildData?.iconUrl ?? null,
      now,
      now
    ) as GuildRow;
  }

  async updateByDiscordId(
    discordGuildId: string,
    data: UpdateGuildInput
  ): Promise<GuildRow> {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(new Date().toISOString());
    values.push(discordGuildId);
    const stmt = db.prepare(
      `UPDATE guilds SET ${fields.join(", ")}, updatedAt = ? WHERE discordGuildId = ? RETURNING *`
    );
    return stmt.get(...values) as GuildRow;
  }
}
