import * as memories from "./repositories/memories";
import * as users from "./repositories/users";
import * as guilds from "./repositories/guilds";
import * as settingsRepo from "./repositories/settings";

export const db = {
  users,
  guilds,
  memories,
  settings: {
    forGuild: settingsRepo.forGuild,
    forUser: settingsRepo.forUser,
  },
};
