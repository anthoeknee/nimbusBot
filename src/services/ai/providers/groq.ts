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
import { BaseAIProvider } from "./BaseAIProvider";
import { config } from "../../../config";

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
    // Patch: Convert any array content to string for Groq compatibility
    const patchedMessages = request.messages.map((msg) => {
      let content = msg.content;
      if (Array.isArray(content)) {
        // Concatenate all text fields, ignore non-text
        content = content
          .filter(
            (part) => part.type === "text" && typeof part.text === "string",
          )
          .map((part) => part.text)
          .join("\n");
      }
      return { ...msg, content };
    });
    const body: any = {
      model: request.model,
      messages: patchedMessages,
      temperature: request.temperature,
    };
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.stream !== undefined) body.stream = request.stream;
    // if (request.tools) body.tools = request.tools; // Groq API does not support tools/plugins
    // if (request.tool_choice) body.tool_choice = request.tool_choice; // Groq API does not support tool_choice

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Groq chat error: ${res.statusText}`);
    return res.json();
  }

  async speechToText(
    request: AISpeechToTextRequest,
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
      },
    );
    if (!res.ok)
      throw new Error(`Groq speech-to-text error: ${res.statusText}`);
    const data = await res.json();
    return { text: data.text, language: data.language, raw: data };
  }

  async textToSpeech(
    request: AITextToSpeechRequest,
  ): Promise<AITextToSpeechResponse> {
    // Groq TTS endpoint: https://api.groq.com/openai/v1/audio/speech
    const url = "https://api.groq.com/openai/v1/audio/speech";
    const model = request.model || "playai-tts";
    const voice = request.voice || "Fritz-PlayAI";
    const response_format = "wav";
    const body = {
      model,
      input: request.text,
      voice,
      response_format,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok)
      throw new Error(`Groq text-to-speech error: ${res.statusText}`);
    // Response is audio/wav
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    return {
      audio: audioBuffer,
      raw: null,
    };
  }

  async vision(request: AIVisionRequest): Promise<AIVisionResponse> {
    // Groq vision via chat completions with image input
    // Model: llama-3.2-11b-vision-preview or llava-v1.5-7b-4096-preview
    const model = request.model || "llama-3.2-11b-vision-preview";
    let imageUrl: string;
    if (typeof request.image === "string") {
      if (request.image.startsWith("data:")) {
        imageUrl = request.image;
      } else if (/^https?:\/\//.test(request.image)) {
        imageUrl = request.image;
      } else {
        // Assume base64 string (no data: prefix)
        imageUrl = `data:image/jpeg;base64,${request.image}`;
      }
    } else {
      // Buffer, ArrayBuffer, Uint8Array, Blob
      let buffer: Buffer;
      if (request.image instanceof Buffer) {
        buffer = request.image;
      } else if (request.image instanceof Uint8Array) {
        buffer = Buffer.from(request.image);
      } else if (request.image instanceof ArrayBuffer) {
        buffer = Buffer.from(request.image);
      } else if (typeof Blob !== "undefined" && request.image instanceof Blob) {
        buffer = Buffer.from(await request.image.arrayBuffer());
      } else {
        throw new Error("Unsupported image type for vision");
      }
      imageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: request.prompt || "Describe this image." },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ];
    const body: any = {
      model,
      messages,
      max_tokens: 1024,
    };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Groq vision error: ${res.statusText}`);
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || "";
    return { result, raw: data };
  }

  async reasoning(request: AIReasoningRequest): Promise<AIReasoningResponse> {
    // Use reasoning_format param and a reasoning-capable model
    const model = request.model || "qwen/qwen3-32b";
    const reasoning_format = request.params?.reasoning_format || "parsed";
    const messages = [
      {
        role: "user",
        content:
          typeof request.input === "string"
            ? request.input
            : JSON.stringify(request.input),
      },
    ];
    const body: any = {
      model,
      messages,
      reasoning_format,
      max_tokens: 1024,
    };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Groq reasoning error: ${res.statusText}`);
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || "";
    return { result, raw: data };
  }

  embeddings(request: AIEmbedRequest): Promise<AIEmbedResponse> {
    BaseAIProvider.notImplemented("embeddings", "Groq");
  }
}
