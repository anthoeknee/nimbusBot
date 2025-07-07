import { db } from "../client";
import { UserRow, CreateUserInput, UpdateUserInput } from "../types";
import { logger } from "../../../utils/logger";

export class UserRepository {
  private readonly table = "users";

  async findByDiscordId(discordId: string): Promise<UserRow | null> {
    const stmt = db.prepare(`SELECT * FROM users WHERE discordId = ?`);
    return stmt.get(discordId) as UserRow | null;
  }

  async findOrCreateByDiscordId(
    discordId: string,
    userData?: Partial<CreateUserInput>
  ): Promise<UserRow> {
    let user = await this.findByDiscordId(discordId);
    if (user) return user;
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO users (discordId, username, displayName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?) RETURNING *`
    );
    return stmt.get(
      discordId,
      userData?.username ?? "",
      userData?.displayName ?? "",
      now,
      now
    ) as UserRow;
  }

  async updateByDiscordId(
    discordId: string,
    data: UpdateUserInput
  ): Promise<UserRow> {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(discordId);
    const stmt = db.prepare(
      `UPDATE users SET ${fields.join(", ")} WHERE discordId = ? RETURNING *`
    );
    return stmt.get(...values) as UserRow;
  }
}
