import {
  AIProviderInterface,
  AIChatRequest,
  AIChatResponse,
  AISpeechToTextRequest,
  AISpeechToTextResponse,
  AITextToSpeechRequest,
  AITextToSpeechResponse,
  AIVisionRequest,
  AIVisionResponse,
  AIReasoningRequest,
  AIReasoningResponse,
  AIEmbedRequest,
  AIEmbedResponse,
} from "../../../types/ai";
import { BaseAIProvider } from "../BaseAIProvider";

export class GroqProvider
  extends BaseAIProvider
  implements AIProviderInterface
{
  constructor() {
    super("GROQ_API_KEY");
  }

  private getHeaders(isJson = true) {
    if (isJson) {
      return {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      };
    }
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const body: any = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: request.stream,
    };
    if (request.tools) body.tools = request.tools;
    if (request.tool_choice) body.tool_choice = request.tool_choice;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Groq chat error: ${res.statusText}`);
    return res.json();
  }

  async speechToText(
    request: AISpeechToTextRequest
  ): Promise<AISpeechToTextResponse> {
    const form = new FormData();
    let audioData: BlobPart;
    if (request.audio instanceof Blob) {
      audioData = request.audio;
    } else if (
      typeof Buffer !== "undefined" &&
      request.audio instanceof Buffer
    ) {
      // Convert Buffer to new Uint8Array with ArrayBuffer backing
      audioData = new Uint8Array(request.audio);
    } else if (request.audio instanceof Uint8Array) {
      // Create new Uint8Array to ensure ArrayBuffer backing
      audioData = new Uint8Array(request.audio);
    } else if (request.audio instanceof ArrayBuffer) {
      audioData = new Uint8Array(request.audio);
    } else {
      throw new Error("Unsupported audio type");
    }
    form.append("file", new Blob([audioData]), "audio.wav");
    if (request.model) form.append("model", request.model);
    if (request.language) form.append("language", request.language);

    const res = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: this.getHeaders(false),
        body: form,
      }
    );
    if (!res.ok)
      throw new Error(`Groq speech-to-text error: ${res.statusText}`);
    const data = await res.json();
    return { text: data.text, language: data.language, raw: data };
  }

  async textToSpeech(
    request: AITextToSpeechRequest
  ): Promise<AITextToSpeechResponse> {
    BaseAIProvider.notImplemented("text-to-speech", "Groq");
  }

  async vision(request: AIVisionRequest): Promise<AIVisionResponse> {
    BaseAIProvider.notImplemented("vision", "Groq");
  }

  async reasoning(request: AIReasoningRequest): Promise<AIReasoningResponse> {
    BaseAIProvider.notImplemented("reasoning", "Groq");
  }

  embeddings(request: AIEmbedRequest): Promise<AIEmbedResponse> {
    BaseAIProvider.notImplemented("embeddings", "Groq");
  }
}
