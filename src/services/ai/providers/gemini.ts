import {
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
} from "../../../types/ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": GEMINI_API_KEY,
  };
}

// Gemini API endpoints
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Helper: Fetch media from URL and convert to base64
async function fetchMediaAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch media from URL: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    // Try to get MIME type from response headers, fallback to common types
    const contentType = response.headers.get("content-type");
    let mimeType = contentType || "application/octet-stream";

    // Infer MIME type from URL extension if not provided
    if (!contentType) {
      const urlLower = url.toLowerCase();
      if (urlLower.includes(".jpg") || urlLower.includes(".jpeg")) {
        mimeType = "image/jpeg";
      } else if (urlLower.includes(".png")) {
        mimeType = "image/png";
      } else if (urlLower.includes(".gif")) {
        mimeType = "image/gif";
      } else if (urlLower.includes(".webp")) {
        mimeType = "image/webp";
      } else if (urlLower.includes(".mp3")) {
        mimeType = "audio/mpeg";
      } else if (urlLower.includes(".wav")) {
        mimeType = "audio/wav";
      } else if (urlLower.includes(".mp4")) {
        mimeType = "video/mp4";
      } else if (urlLower.includes(".webm")) {
        mimeType = "video/webm";
      }
    }

    return { data: base64Data, mimeType };
  } catch (error) {
    throw new Error(`Error fetching media from URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper: Convert universal chat messages to Gemini format with multimodal support
async function toGeminiContents(messages: AIChatRequest["messages"]) {
  const contents = [];

  for (const msg of messages) {
    const parts = [];

    // Handle the new content array structure
    if (Array.isArray(msg.content)) {
      for (const contentItem of msg.content) {
        if (contentItem.type === "text") {
          parts.push({ text: contentItem.text });
        } else if (["image", "audio", "video"].includes(contentItem.type)) {
          if (contentItem.source.type === "url") {
            try {
              const { data, mimeType } = await fetchMediaAsBase64(contentItem.source.url);
              parts.push({
                inline_data: {
                  mime_type: contentItem.source.mime_type || mimeType,
                  data: data,
                },
              });
            } catch (error) {
              console.error(`Failed to process media from URL: ${contentItem.source.url}`, error);
              // Continue with other parts instead of failing completely
              parts.push({ text: `[Media processing failed: ${error instanceof Error ? error.message : String(error)}]` });
            }
          } else {
            throw new Error(`Unsupported source type: ${contentItem.source.type}`);
          }
        } else {
          throw new Error(`Unsupported content type: ${(contentItem as any).type}`);
        }
      }
    } else {
      // Fallback for legacy string content format
      parts.push({ text: msg.content as string });
    }

    contents.push({
      role: msg.role === "assistant" ? "model" : msg.role, // Gemini uses "user" and "model"
      parts: parts,
    });
  }

  return contents;
}

// Helper: Convert Gemini response to universal format
function fromGeminiChatResponse(data: any, model: string): AIChatResponse {
  // Gemini's response is a bit different; we adapt it to your AIChatResponse
  return {
    id: data.candidate_id || data.id || "",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || data.text || "",
        },
        finish_reason: data.candidates?.[0]?.finishReason || "stop",
      },
    ],
    usage: data.usage ? {
      prompt_tokens: data.usage.promptTokens,
      completion_tokens: data.usage.completionTokens,
      total_tokens: data.usage.totalTokens,
    } : undefined,
  };
}

export class GeminiProvider implements AIProviderInterface {
  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    // Use a powerful multimodal model by default
    const model = request.model || "gemini-1.5-pro-latest";
    const url = `${BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    try {
      // Convert messages to Gemini format with multimodal support
      const contents = await toGeminiContents(request.messages);

      const body = {
        contents: contents,
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini chat error: ${res.statusText} - ${errorText}`);
      }

      const data = await res.json();
      return fromGeminiChatResponse(data, model);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini chat request failed: ${error.message}`);
      }
      throw new Error(`Gemini chat request failed: ${String(error)}`);
    }
  }

  // Gemini does not support embeddings via public API as of June 2024
  async embeddings(request: AIEmbedRequest): Promise<AIEmbedResponse> {
    throw new Error("Gemini embeddings not implemented");
  }

  // Gemini does not support speech-to-text via public API as of June 2024
  async speechToText(request: AISpeechToTextRequest): Promise<AISpeechToTextResponse> {
    throw new Error("Gemini speech-to-text not implemented");
  }

  async textToSpeech(request: AITextToSpeechRequest): Promise<AITextToSpeechResponse> {
    // Default to Gemini 2.5 Flash Preview TTS model
    const model = request.model || "gemini-2.5-flash-preview-tts";
    const url = `${BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // Discord-style: support both single and multi-speaker
    // If the text contains lines like "Speaker: text", treat as multi-speaker
    const multiSpeakerMatch = request.text.match(/^([A-Za-z0-9 _-]+):/m);
    let config: any = {
      responseModalities: ["AUDIO"],
    };

    if (multiSpeakerMatch) {
      // Parse speakers and lines
      const speakerLines = request.text.split("\n").filter(Boolean);
      const speakers: Record<string, string[]> = {};
      for (const line of speakerLines) {
        const match = line.match(/^([A-Za-z0-9 _-]+):\s*(.*)$/);
        if (match) {
          const [, speaker, text] = match;
          if (!speakers[speaker]) speakers[speaker] = [];
          speakers[speaker].push(text);
        }
      }
      // Assign default voices if not provided
      const defaultVoices = [
        "Kore", "Puck", "Zephyr", "Charon", "Fenrir", "Leda", "Orus", "Aoede", "Callirrhoe", "Autonoe"
      ];
      let i = 0;
      config.speechConfig = {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: Object.keys(speakers).map((speaker) => ({
            speaker,
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: request.voice || defaultVoices[i++ % defaultVoices.length],
              },
            },
          })),
        },
      };
    } else {
      // Single speaker
      config.speechConfig = {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: request.voice || "Kore",
          },
        },
      };
    }

    // Compose contents
    const contents = [
      { parts: [{ text: request.text }] }
    ];

    const body = {
      contents,
      config,
    };

    // Use Bun's fetch and Buffer
    const res = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Gemini TTS error: ${res.statusText}`);
    const data = await res.json();

    // The audio is base64-encoded PCM in: data.candidates[0].content.parts[0].inlineData.data
    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned from Gemini TTS");

    // Convert to Uint8Array for Discord
    const audioBuffer = Buffer.from(base64Audio, "base64");

    return {
      audio: audioBuffer,
      raw: data,
    };
  }

  // Vision method is deprecated - use the unified chat method instead
  async vision(request: AIVisionRequest): Promise<AIVisionResponse> {
    throw new Error(
      "The vision method is deprecated. Please use the unified chat method instead, " +
      "which supports multimodal input including images, audio, and video. " +
      "Example: Use chat() with messages containing content arrays that include image/audio/video parts."
    );
  }

  // Reasoning: generic endpoint, route to chat for now
  async reasoning(request: AIReasoningRequest): Promise<AIReasoningResponse> {
    // Route to chat with input as a single message
    const chatReq: AIChatRequest = {
      provider: "gemini",
      model: request.model || "gemini-1.5-pro-latest",
      messages: [
        { role: "user", content: typeof request.input === "string" ? request.input : JSON.stringify(request.input) },
      ],
    };
    const chatRes = await this.chat(chatReq);
    return {
      result: chatRes.choices[0].message.content,
      raw: chatRes,
    };
  }
}
