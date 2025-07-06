// AI Model and Provider Types
export type AIProvider = "groq" | "cohere" | "gemini";
export type GroqModel =
  | "meta-llama/llama-4-maverick-17b-128e-instruct"
  | "meta-llama/llama-4-scout-17b-16e-instruct"
  | "llama-3.3-70b-versatile";

// Common Message Format for Chat
export interface AIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
}

// Chat/Completion Request
export interface AIChatRequest {
  provider: AIProvider;
  model?: string;
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: AIToolDefinition[];
  tool_choice?: string | { type: "function"; function: { name: string } };
}

// Chat/Completion Response
export interface AIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AIChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Speech-to-Text
export interface AISpeechToTextRequest {
  provider: AIProvider;
  audio: Blob | Buffer | ArrayBuffer | Uint8Array; // Accepts various binary types
  model?: string;
  language?: string;
}
export interface AISpeechToTextResponse {
  text: string;
  language?: string;
  raw?: any;
}

// Text-to-Speech
export interface AITextToSpeechRequest {
  provider: AIProvider;
  text: string;
  model?: string;
  voice?: string;
  language?: string;
}
export interface AITextToSpeechResponse {
  audio: Uint8Array | Buffer | ArrayBuffer;
  raw?: any;
}

// Vision/Image
export interface AIVisionRequest {
  provider: AIProvider;
  image: Blob | Buffer | ArrayBuffer | Uint8Array | string; // string for base64 or URL
  prompt?: string;
  model?: string;
}
export interface AIVisionResponse {
  result: string;
  raw?: any;
}

// Reasoning (generic endpoint for advanced tasks)
export interface AIReasoningRequest {
  provider: AIProvider;
  input: any;
  model?: string;
  task?: string;
  params?: Record<string, any>;
}
export interface AIReasoningResponse {
  result: any;
  raw?: any;
}

// Rerank
export interface AIRerankRequest {
  provider: AIProvider;
  query: string;
  documents: string[];
  model?: string;
  topN?: number;
  maxTokensPerDoc?: number;
}

export interface AIRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
  id?: string;
  meta?: any;
  raw?: any;
}

// Classify
export interface AIClassifyExample {
  text: string;
  label: string;
}

export interface AIClassifyRequest {
  provider: AIProvider;
  inputs: string[];
  examples?: AIClassifyExample[];
  model?: string;
  truncate?: "NONE" | "START" | "END";
}

export interface AIClassifyResponse {
  id?: string;
  classifications: Array<{
    id?: string;
    input: string;
    predictions: string[];
    confidences: number[];
    labels: Record<string, { confidence: number }>;
    classification_type: string;
    prediction: string;
    confidence: number;
  }>;
  meta?: any;
  raw?: any;
}

// Universal Provider Interface
export interface AIProviderInterface {
  embeddings: any;
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  speechToText?(
    request: AISpeechToTextRequest,
  ): Promise<AISpeechToTextResponse>;
  textToSpeech?(
    request: AITextToSpeechRequest,
  ): Promise<AITextToSpeechResponse>;
  vision?(request: AIVisionRequest): Promise<AIVisionResponse>;
  reasoning?(request: AIReasoningRequest): Promise<AIReasoningResponse>;
  rerank?(request: AIRerankRequest): Promise<AIRerankResponse>;
  classify?(request: AIClassifyRequest): Promise<AIClassifyResponse>;
}

export interface AIEmbedRequest {
  provider: AIProvider;
  texts?: string[]; // For text-only embedding
  images?: string[]; // For image-only embedding (base64 or URL)
  inputs?: Array<{
    content: Array<{
      type: string; // 'text' | 'image_url'
      text?: string;
      image_url?: { url: string };
    }>;
  }>; // For multimodal/fused input
  model: string;
  inputType?: string; // e.g. 'search_query', 'search_document', 'classification', 'image'
  embeddingTypes?: string[]; // e.g. ['float'], ['int8'], ['binary'], etc.
  outputDimension?: number; // e.g. 256, 512, 1024, 1536
}

export interface AIEmbedResponse {
  // Support for multiple embedding types (float, int8, binary, etc.)
  embeddings: number[][] | Record<string, any>; // float/int8/binary arrays, or object keyed by type
  // Optionally include raw response for advanced use
  raw?: any;
}

// Tool/function definition (OpenAI-compatible)
export interface AIToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, any>; // JSON Schema
  };
}

// Tool call in a message
export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// --- Conversation Memory Types ---
export interface ConversationMessage {
  id: string;
  authorId: string;
  authorName?: string;
  channelId: string;
  content: string | Array<{ type: string; [key: string]: any }>;
  timestamp: number;
  type: "user" | "bot" | "system";
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  id: string; // userId for DMs, channelId for servers
  type: "user" | "channel";
  messages: ConversationMessage[];
  lastActive: number;
  sessionState?: Record<string, any>;
}

// --- Tool System Types ---
export interface ToolPermission {
  users?: string[];
  roles?: string[];
  channels?: string[];
}

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolContext {
  userId?: string;
  channelId?: string;
  roles?: string[];
  // ...add more as needed
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  permissions?: string[];
  handler: (args: any, context: ToolContext) => Promise<any>;
  // Optionally: category, examples, etc.
}

// --- Memory Tool Types ---
export interface SaveLongTermMemoryArgs {
  content: string;
  embedding: number[];
  userId?: number;
  guildId?: number;
}
export interface SaveLongTermMemoryResult {
  id: number;
  userId: number | null;
  guildId: number | null;
  content: string;
  embedding: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchLongTermMemoryArgs {
  embedding: number[];
  topK?: number;
  userId?: number;
  guildId?: number;
}
export interface SearchLongTermMemoryResult {
  data: SaveLongTermMemoryResult;
  similarity: number;
}
