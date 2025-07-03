import { BaseRepository } from './base.repository';
import { 
  UserRow, 
  CreateUserInput, 
  UpdateUserInput, 
  DiscordId, 
  EntityId 
} from '../types';

export class UserRepository extends BaseRepository<UserRow, CreateUserInput, UpdateUserInput> {
  protected readonly tableName = 'users';

  async findByDiscordId(discordId: DiscordId): Promise<UserRow | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE discordId = ?');
      const result = stmt.get(discordId) as UserRow | undefined;
      return result || null;
    } catch (error) {
      throw new Error(`Failed to find user by Discord ID: ${error}`);
    }
  }

  async findOrCreateByDiscordId(
    discordId: DiscordId, 
    userData?: Partial<CreateUserInput>
  ): Promise<UserRow> {
    const existingUser = await this.findByDiscordId(discordId);
    if (existingUser) return existingUser;

    const createData: CreateUserInput = {
      discordId,
      username: userData?.username ?? '',
      displayName: userData?.displayName ?? '',
    };

    return await this.create(createData);
  }

  async updateByDiscordId(discordId: DiscordId, data: UpdateUserInput): Promise<UserRow> {
    try {
      const keys = Object.keys(data as object);
      const values = Object.values(data as object);
      const setClause = keys.map(key => `${key} = ?`).join(', ');
      
      const query = `UPDATE users SET ${setClause} WHERE discordId = ? RETURNING *`;
      const stmt = this.db.prepare(query);
      const result = stmt.get(...values, discordId) as UserRow;
      
      return result;
    } catch (error) {
      throw new Error(`Failed to update user by Discord ID: ${error}`);
    }
  }
}