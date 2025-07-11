function getEnvVar(name: string, fallback?: string): string {
  const value = Bun.env[name] || process.env[name] || fallback;
  if (!value) {
    throw new Error(`${name} is not set in the environment variables.`);
  }
  return value;
}

export const config = {
  discordToken: getEnvVar("DISCORD_TOKEN"),
  geminiAPIKey: getEnvVar("GEMINI_API_KEY"),
  groqAPIKey: getEnvVar("GROQ_API_KEY"),
  cohereAPIKey: getEnvVar("COHERE_API_KEY"),
  database: {
    url: getEnvVar("DATABASE_URL"),
  },
  bun: {
    jit: getEnvVar("BUN_JIT", "true") === "true",
    useOptimizedJson: true,
    useFastPath: true,
  },
  ownerId: getEnvVar("BOT_OWNER_ID", ""),
  defaultProvider: getEnvVar("AI_PROVIDER"),
  defaultModel: getEnvVar("AI_MODEL"),
  defaultEmbedModel: getEnvVar("EMBED_MODEL"),
};
