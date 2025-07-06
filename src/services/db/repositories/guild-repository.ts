import { BaseRepository } from "./base-repository";
import { GuildRow, CreateGuildInput, UpdateGuildInput, EntityId } from "../types";

export class GuildRepository extends BaseRepository<
  GuildRow,
  CreateGuildInput,
  UpdateGuildInput
> {
  protected readonly tableName = "guilds";

  async findByDiscordId(discordGuildId: string): Promise<GuildRow | null> {
    try {
      const stmt = this.db.prepare(
        "SELECT * FROM guilds WHERE discordGuildId = ?",
      );
      const result = stmt.get(discordGuildId) as GuildRow | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find guild by Discord ID: ${error}`);
    }
  }

  async findOrCreateByDiscordId(
    discordGuildId: string,
    guildData?: Partial<CreateGuildInput>,
  ): Promise<GuildRow> {
    const existingGuild = await this.findByDiscordId(discordGuildId);
    if (existingGuild) return existingGuild;

    const createData: CreateGuildInput = {
      discordGuildId,
      name: guildData?.name ?? "",
      iconUrl: guildData?.iconUrl,
    };
    return await this.create(createData);
  }

  async updateByDiscordId(
    discordGuildId: string,
    data: UpdateGuildInput,
  ): Promise<GuildRow> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const setClause = keys.map((key) => `${key} = ?`).join(", ");
      const query = `UPDATE guilds SET ${setClause} WHERE discordGuildId = ? RETURNING *`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(...values, discordGuildId) as GuildRow;
      return result;
    } catch (error) {
      throw new Error(`Failed to update guild by Discord ID: ${error}`);
    }
  }
}
