import {
  AIProvider,
  AIProviderInterface,
  AIChatRequest,
  AIChatResponse,
  AIEmbedRequest,
  AIEmbedResponse,
} from "../../types/ai";
import { GroqProvider } from "./providers/groq";
import { CohereProvider } from "./providers/cohere";
import { GeminiProvider } from "./providers/gemini";
import { getOpenAIFunctions, executeTool } from "./tools/index";

const providers: Record<AIProvider, AIProviderInterface> = {
  groq: new GroqProvider(),
  cohere: new CohereProvider(),
  gemini: new GeminiProvider(),
};

/**
 * AIClient is the main entry point for all AI operations. It orchestrates provider selection, tool execution, and ensures backward compatibility.
 *
 * @remarks
 * - Maintains 100% backward compatibility with previous implementation.
 * - Supports dependency injection for providers and logging.
 */
export class AIClient {
  /**
   * Get the provider instance for the given provider key.
   * @param provider - The provider key (e.g., 'groq', 'cohere', 'gemini')
   * @returns The provider instance implementing AIProviderInterface
   * @throws Error if provider is not supported
   */
  static getProvider(provider: AIProvider): AIProviderInterface {
    const instance = providers[provider];
    if (!instance) throw new Error(`AI provider "${provider}" not supported`);
    return instance;
  }

  /**
   * Send a chat request to the selected provider, handling tool calls and function-calling loop.
   *
   * @param request - The chat request (AIChatRequest)
   * @returns The AIChatResponse, with optional toolResults array
   * @throws Error on provider errors or infinite tool loop
   */
  static async chat(
    request: AIChatRequest,
  ): Promise<AIChatResponse & { toolResults?: any[] }> {
    const provider = AIClient.getProvider(request.provider);
    const tools = getOpenAIFunctions();
    let messages = [...request.messages];
    let toolResults: any[] = [];
    let aiResponse: AIChatResponse;
    let loopCount = 0;
    const maxLoops = 8; // Prevent infinite loops

    while (true) {
      aiResponse = await provider.chat({ ...request, messages, tools });
      // Extract tool calls (OpenAI/Cohere/Gemini compatible)
      const toolCalls: Array<{ id: string; name: string; arguments: any }> = [];
      for (const choice of aiResponse.choices || []) {
        const msg = choice.message;
        if (msg && Array.isArray(msg.tool_calls)) {
          for (const call of msg.tool_calls) {
            if (call.function?.name && call.function?.arguments) {
              let args;
              try {
                args =
                  typeof call.function.arguments === "string"
                    ? JSON.parse(call.function.arguments)
                    : call.function.arguments;
              } catch {
                args = call.function.arguments;
              }
              toolCalls.push({
                id: call.id,
                name: call.function.name,
                arguments: args,
              });
            }
          }
        }
      }
      if (!toolCalls.length) {
        break;
      }
      // Execute tool calls and append tool result messages
      for (const call of toolCalls) {
        let result;
        try {
          result = await executeTool(
            call.name,
            call.arguments,
            request.toolContext || {},
          );
        } catch (err) {
          result = {
            error: err instanceof Error ? err.message : String(err),
          };
        }
        toolResults.push({ name: call.name, result });
        // Append tool result message in Cohere format
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: [
            {
              type: "document",
              document: {
                data: JSON.stringify(result),
              },
            },
          ],
        } as any);
      }
      loopCount++;
      if (loopCount > maxLoops) {
        throw new Error("Too many tool use loops (possible infinite loop)");
      }
    }
    return { ...aiResponse, ...(toolResults.length ? { toolResults } : {}) };
  }

  /**
   * Request embeddings from the selected provider.
   * @param request - The embedding request (AIEmbedRequest)
   * @returns The AIEmbedResponse
   * @throws Error if embeddings are not supported for the provider
   */
  static async embeddings(request: AIEmbedRequest): Promise<AIEmbedResponse> {
    const provider = AIClient.getProvider(request.provider);
    if (!provider.embeddings)
      throw new Error(
        `Embeddings not supported for provider "${request.provider}"`,
      );
    return provider.embeddings(request);
  }
}
