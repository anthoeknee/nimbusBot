// src/services/cache/userCache.ts
import { memoryStore } from '../memoryStore';
import { users as userRepo } from '../db';

export const userCache = {
  async getOrFetch(discordId: string) {
    let user = memoryStore.get(`user:${discordId}`);
    if (!user) {
      user = await userRepo.findByDiscordId(discordId);
      if (user) memoryStore.set(`user:${discordId}`, user, 3600);
    }
    return user;
  },
  async setAndPersist(discordId: string, userData: any) {
    memoryStore.set(`user:${discordId}`, userData, 3600);
    return userRepo.updateByDiscordId(discordId, userData);
  },
  async deleteEverywhere(discordId: string) {
    memoryStore.delete(`user:${discordId}`);
    // Optionally delete from DB as well
    // await userRepo.deleteByDiscordId(discordId);
  }
  // ... more methods as needed
};