export abstract class BaseAIProvider {
  protected apiKey: string;

  constructor(envKey: string) {
    this.apiKey = process.env[envKey] || "";
    if (!this.apiKey) {
      throw new Error(`Missing API key for ${envKey}`);
    }
  }

  /**
   * Returns headers for JSON requests.
   * Override for provider-specific needs.
   */
  getJsonHeaders(authHeader: string, extra?: Record<string, string>) {
    return {
      "Content-Type": "application/json",
      ...extra,
      ...(authHeader ? { [authHeader]: this.apiKey } : {}),
    };
  }

  /**
   * Returns headers for FormData requests (no content-type).
   * Override for provider-specific needs.
   */
  getFormHeaders(authHeader: string, extra?: Record<string, string>) {
    return {
      ...extra,
      ...(authHeader ? { [authHeader]: this.apiKey } : {}),
    };
  }

  /**
   * Standardized "not implemented" error.
   */
  static notImplemented(feature: string, provider: string): never {
    throw new Error(`${provider} ${feature} not implemented`);
  }
}
