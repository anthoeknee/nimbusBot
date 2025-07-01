function getEnvVar(name: string): string {
  const value = Bun.env[name] || process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in the environment variables.`);
  }
  return value;
}

export const config = {
  discordToken: getEnvVar("DISCORD_TOKEN"),
  geminiAPIKey: getEnvVar("GEMINI_API_KEY"),
};