export type AIProvider = "groq" | "cohere" | "gemini";
export type GroqModel =
  | "meta-llama/llama-4-maverick-17b-128e-instruct"
  | "meta-llama/llama-4-scout-17b-16e-instruct"
  | "llama-3.3-70b-versatile";

export interface AIChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: AIToolCall[];
  tool_call_id?: string;
}

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

export interface AISpeechToTextRequest {
  provider: AIProvider;
  audio: Blob | Buffer | ArrayBuffer | Uint8Array;
  model?: string;
  language?: string;
}
export interface AISpeechToTextResponse {
  text: string;
  language?: string;
  raw?: any;
}

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

export interface AIVisionRequest {
  provider: AIProvider;
  image: Blob | Buffer | ArrayBuffer | Uint8Array | string;
  prompt?: string;
  model?: string;
}
export interface AIVisionResponse {
  result: string;
  raw?: any;
}

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

export interface AIProviderInterface {
  embeddings: any;
  chat(request: AIChatRequest): Promise<AIChatResponse>;
  speechToText?(
    request: AISpeechToTextRequest
  ): Promise<AISpeechToTextResponse>;
  textToSpeech?(
    request: AITextToSpeechRequest
  ): Promise<AITextToSpeechResponse>;
  vision?(request: AIVisionRequest): Promise<AIVisionResponse>;
  reasoning?(request: AIReasoningRequest): Promise<AIReasoningResponse>;
  rerank?(request: AIRerankRequest): Promise<AIRerankResponse>;
  classify?(request: AIClassifyRequest): Promise<AIClassifyResponse>;
}

export interface AIEmbedRequest {
  provider: AIProvider;
  texts?: string[];
  images?: string[];
  inputs?: Array<{
    content: Array<{
      type: string;
      text?: string;
      image_url?: { url: string };
    }>;
  }>;
  model: string;
  inputType?: string;
  embeddingTypes?: string[];
  outputDimension?: number;
}
export interface AIEmbedResponse {
  embeddings: number[][] | Record<string, any>;
  raw?: any;
}

export interface AIToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, any>;
  };
}
export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

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
  id: string;
  type: "user" | "channel";
  messages: ConversationMessage[];
  lastActive: number;
  sessionState?: Record<string, any>;
}

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
}
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  permissions?: string[];
  handler: (args: any, context: ToolContext) => Promise<any>;
}
