// Create a performance utility that leverages Bun's capabilities
export class PerformanceMonitor {
  private static startTimes = new Map<string, number>();

  static start(label: string): void {
    this.startTimes.set(label, Bun.nanoseconds());
  }

  static end(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) throw new Error(`No start time found for label: ${label}`);
    
    const duration = (Bun.nanoseconds() - startTime) / 1e6; // Convert to milliseconds
    this.startTimes.delete(label);
    return duration;
  }

  static measure<T>(label: string, fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
    return new Promise(async (resolve) => {
      this.start(label);
      const result = await fn();
      const duration = this.end(label);
      resolve({ result, duration });
    });
  }
} 