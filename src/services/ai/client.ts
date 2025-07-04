import {
  AIProvider,
  AIProviderInterface,
  AIChatRequest,
  AIChatResponse,
  AIEmbedRequest,
  AIEmbedResponse,
  AISpeechToTextRequest,
  AISpeechToTextResponse,
  AITextToSpeechRequest,
  AITextToSpeechResponse,
  AIVisionRequest,
  AIVisionResponse,
  AIReasoningRequest,
  AIReasoningResponse,
  AIRerankRequest,
  AIRerankResponse,
  AIClassifyRequest,
  AIClassifyResponse,
} from "../../types/ai";
import { GroqProvider } from "./providers/groq";
import { CohereProvider } from "./providers/cohere";
import { GeminiProvider } from "./providers/gemini";
import { Message, Attachment } from "discord.js";

const providerMap: Record<AIProvider, AIProviderInterface> = {
  groq: new GroqProvider(),
  cohere: new CohereProvider(),
  gemini: new GeminiProvider(),
};

export class AIClient {
  private getProvider(provider: AIProvider): AIProviderInterface {
    const instance = providerMap[provider];
    if (!instance) throw new Error(`AI provider "${provider}" not supported`);
    return instance;
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    return this.getProvider(request.provider).chat(request);
  }

  async embeddings(request: AIEmbedRequest): Promise<AIEmbedResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.embeddings)
      throw new Error(
        `Embeddings not supported for provider "${request.provider}"`
      );
    return provider.embeddings(request);
  }

  async rerank(request: AIRerankRequest): Promise<AIRerankResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.rerank)
      throw new Error(
        `Rerank not supported for provider "${request.provider}"`
      );
    return provider.rerank(request);
  }

  async classify(request: AIClassifyRequest): Promise<AIClassifyResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.classify)
      throw new Error(
        `Classify not supported for provider "${request.provider}"`
      );
    return provider.classify(request);
  }

  async speechToText(
    request: AISpeechToTextRequest
  ): Promise<AISpeechToTextResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.speechToText)
      throw new Error(
        `Speech-to-text not supported for provider "${request.provider}"`
      );
    return provider.speechToText(request);
  }

  async textToSpeech(
    request: AITextToSpeechRequest
  ): Promise<AITextToSpeechResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.textToSpeech)
      throw new Error(
        `Text-to-speech not supported for provider "${request.provider}"`
      );
    return provider.textToSpeech(request);
  }

  async vision(request: AIVisionRequest): Promise<AIVisionResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.vision)
      throw new Error(
        `Vision not supported for provider "${request.provider}"`
      );
    return provider.vision(request);
  }

  async reasoning(request: AIReasoningRequest): Promise<AIReasoningResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.reasoning)
      throw new Error(
        `Reasoning not supported for provider "${request.provider}"`
      );
    return provider.reasoning(request);
  }

  // --- Voice Message Helpers ---
  /**
   * Extracts speech from a Discord message's audio attachment using the specified AI provider.
   */
  static async extractSpeechFromMessage(
    message: Message,
    options: { provider: AIProvider; model?: string; language?: string }
  ): Promise<AISpeechToTextResponse | null> {
    // Find the first audio attachment (Discord voice messages are .ogg, .mp3, .wav, etc)
    const audioAttachment = message.attachments.find(
      (att: Attachment) =>
        att.contentType?.startsWith("audio") ||
        att.name.endsWith(".ogg") ||
        att.name.endsWith(".mp3") ||
        att.name.endsWith(".wav") ||
        att.name.endsWith(".m4a")
    );
    if (!audioAttachment) return null;

    // Download the audio file
    const response = await fetch(audioAttachment.url);
    if (!response.ok) throw new Error("Failed to download audio attachment");
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Prepare the request for the AI provider
    const sttRequest: AISpeechToTextRequest = {
      provider: options.provider,
      audio: audioBuffer,
      model: options.model,
      language: options.language,
    };

    // Use AIClient to perform speech-to-text
    const aiClient = new AIClient();
    return aiClient.speechToText(sttRequest);
  }

  /**
   * High-level handler: extracts speech and runs a callback, with user feedback.
   */
  static async handleVoiceMessage(
    message: Message,
    options: { provider: AIProvider; model?: string; language?: string },
    onText: (text: string, response: AISpeechToTextResponse) => Promise<void>
  ): Promise<AISpeechToTextResponse | null> {
    try {
      const sttResponse = await AIClient.extractSpeechFromMessage(
        message,
        options
      );
      if (sttResponse && sttResponse.text) {
        await onText(sttResponse.text, sttResponse);
        return sttResponse;
      } else {
        await message.reply(
          "❌ Sorry, I couldn't recognize any speech in your audio."
        );
        return null;
      }
    } catch (error: any) {
      await message.reply(`❌ Error extracting speech: ${error.message}`);
      return null;
    }
  }

  // Add more endpoints as needed
}
