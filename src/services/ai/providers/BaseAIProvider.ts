/**
 * Abstract base class for all AI providers.
 * Handles API key management, header helpers, and error helpers.
 */
export abstract class BaseAIProvider {
  protected apiKey: string;

  /**
   * @param envKey - The environment variable key for the API key
   * @throws Error if the API key is missing
   */
  constructor(envKey: string) {
    this.apiKey = process.env[envKey] || "";
    if (!this.apiKey) {
      throw new Error(`Missing API key for ${envKey}`);
    }
  }

  /**
   * Get JSON headers for API requests.
   * @param authHeader - The header key for the API key (optional)
   * @param extra - Any extra headers to include
   */
  getJsonHeaders(authHeader?: string, extra?: Record<string, string>) {
    return {
      "Content-Type": "application/json",
      ...extra,
      ...(authHeader ? { [authHeader]: this.apiKey } : {}),
    };
  }

  /**
   * Get form headers for multipart/form-data requests.
   * @param authHeader - The header key for the API key (optional)
   * @param extra - Any extra headers to include
   */
  getFormHeaders(authHeader?: string, extra?: Record<string, string>) {
    return {
      ...extra,
      ...(authHeader ? { [authHeader]: this.apiKey } : {}),
    };
  }

  /**
   * Helper for not implemented features.
   * @param feature - The feature name
   * @param provider - The provider name
   * @throws Error always
   */
  static notImplemented(feature: string, provider: string): never {
    throw new Error(`${provider} ${feature} not implemented`);
  }
}
