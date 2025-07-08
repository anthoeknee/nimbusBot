import * as users from "./users";
import * as guilds from "./guilds";
import * as settingsRepo from "./settings";
import * as memories from "./memories";

export const database = {
  users,
  guilds,
  settings: settingsRepo,
  memories,
};
