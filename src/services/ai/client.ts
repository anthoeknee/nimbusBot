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
    if (!provider.embeddings) throw new Error(`Embeddings not supported for provider "${request.provider}"`);
    return provider.embeddings(request);
  }

  async rerank(request: AIRerankRequest): Promise<AIRerankResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.rerank) throw new Error(`Rerank not supported for provider "${request.provider}"`);
    return provider.rerank(request);
  }

  async classify(request: AIClassifyRequest): Promise<AIClassifyResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.classify) throw new Error(`Classify not supported for provider "${request.provider}"`);
    return provider.classify(request);
  }

  async speechToText(request: AISpeechToTextRequest): Promise<AISpeechToTextResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.speechToText) throw new Error(`Speech-to-text not supported for provider "${request.provider}"`);
    return provider.speechToText(request);
  }

  async textToSpeech(request: AITextToSpeechRequest): Promise<AITextToSpeechResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.textToSpeech) throw new Error(`Text-to-speech not supported for provider "${request.provider}"`);
    return provider.textToSpeech(request);
  }

  async vision(request: AIVisionRequest): Promise<AIVisionResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.vision) throw new Error(`Vision not supported for provider "${request.provider}"`);
    return provider.vision(request);
  }

  async reasoning(request: AIReasoningRequest): Promise<AIReasoningResponse> {
    const provider = this.getProvider(request.provider);
    if (!provider.reasoning) throw new Error(`Reasoning not supported for provider "${request.provider}"`);
    return provider.reasoning(request);
  }

  // Add more endpoints as needed
}
