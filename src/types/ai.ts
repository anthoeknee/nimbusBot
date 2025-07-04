// AI Model and Provider Types
export type AIProvider = "groq" | "cohere" | "gemini";
export type GroqModel =
  | "meta-llama/llama-4-maverick-17b-128e-instruct"
  | "meta-llama/llama-4-scout-17b-16e-instruct"
  | "llama-3.3-70b-versatile"

// Common Message Format for Chat
export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Chat/Completion Request
export interface AIChatRequest {
  provider: AIProvider;
  model?: string;
  messages: AIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
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
  speechToText?(request: AISpeechToTextRequest): Promise<AISpeechToTextResponse>;
  textToSpeech?(request: AITextToSpeechRequest): Promise<AITextToSpeechResponse>;
  vision?(request: AIVisionRequest): Promise<AIVisionResponse>;
  reasoning?(request: AIReasoningRequest): Promise<AIReasoningResponse>;
  rerank?(request: AIRerankRequest): Promise<AIRerankResponse>;
  classify?(request: AIClassifyRequest): Promise<AIClassifyResponse>;
}

export interface AIEmbedRequest {
  provider: AIProvider;
  texts: string[];
  model: string;
  inputType?: string;
  embeddingTypes?: string[];
}

export interface AIEmbedResponse {
  embeddings: number[][];
  // ...other fields returned by Cohere if needed
}
