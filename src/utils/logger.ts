/**
 * Enhanced logger utility with timestamps and structured logging.
 */
export const logger = {
  info: (...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO]`, ...args);
  },
  warn: (...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN]`, ...args);
  },
  error: (...args: any[]) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR]`, ...args);
  },
  debug: (...args: any[]) => {
    if (process.env.DEBUG) {
      const timestamp = new Date().toISOString();
      console.debug(`[${timestamp}] [DEBUG]`, ...args);
    }
  },
  // Add command-specific logging
  command: (
    commandName: string,
    userId: string,
    action: string,
    ...args: any[]
  ) => {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [COMMAND:${commandName}] [USER:${userId}] ${action}`,
      ...args,
    );
  },
};
