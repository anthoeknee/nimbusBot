import { logger } from "../../utils/logger";

const executionLocks = new Map<string, Promise<any>>();

/**
 * Ensures only one execution per unique key at a time. Waits for existing execution if present.
 * Cleans up old locks periodically.
 * @param key Unique lock key (e.g., message or interaction id)
 * @param fn The async function to execute
 */
export async function withExecutionLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  if (executionLocks.has(key)) {
    logger.warn(
      `Duplicate execution detected for ${key}, waiting for existing execution`
    );
    await executionLocks.get(key);
    // After waiting, do not re-execute
    return undefined as any;
  }
  const executionPromise = (async () => {
    try {
      return await fn();
    } finally {
      executionLocks.delete(key);
      // Clean up old locks periodically
      if (executionLocks.size > 100) {
        logger.debug(
          `Cleaning up execution locks, current size: ${executionLocks.size}`
        );
        for (const [k, promise] of executionLocks.entries()) {
          promise.catch(() => {});
          executionLocks.delete(k);
        }
      }
    }
  })();
  executionLocks.set(key, executionPromise);
  return executionPromise;
}
