import {
  AIProviderInterface,
  AIChatRequest,
  AIChatResponse,
  // Add these types to src/types/ai.ts if not present:
  AIEmbedRequest,
  AIEmbedResponse,
  // ...other types if needed
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
} from "../../../types/ai";

const COHERE_API_KEY = process.env.COHERE_API_KEY || "";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${COHERE_API_KEY}`,
  };
}

export class CohereProvider implements AIProviderInterface {
  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const res = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        stream: request.stream,
        // Add other fields as needed (tools, documents, etc.)
      }),
    });
    if (!res.ok) throw new Error(`Cohere chat error: ${res.statusText}`);
    return res.json();
  }

  async embed(request: AIEmbedRequest): Promise<AIEmbedResponse> {
    const res = await fetch("https://api.cohere.com/v2/embed", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        texts: request.texts,
        model: request.model,
        input_type: request.inputType || "classification",
        embedding_types: request.embeddingTypes || ["float"],
      }),
    });
    if (!res.ok) throw new Error(`Cohere embed error: ${res.statusText}`);
    return res.json();
  }

  async rerank(request: AIRerankRequest): Promise<AIRerankResponse> {
    const res = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        model: request.model || "rerank-v3.5",
        query: request.query,
        documents: request.documents,
        top_n: request.topN,
        max_tokens_per_doc: request.maxTokensPerDoc,
      }),
    });
    if (!res.ok) throw new Error(`Cohere rerank error: ${res.statusText}`);
    const data = await res.json();
    return {
      results: data.results,
      id: data.id,
      meta: data.meta,
      raw: data,
    };
  }

  async classify(request: AIClassifyRequest): Promise<AIClassifyResponse> {
    const body: any = {
      inputs: request.inputs,
      model: request.model,
    };

    if (request.examples) {
      body.examples = request.examples;
    }

    if (request.truncate) {
      body.truncate = request.truncate;
    }

    const res = await fetch("https://api.cohere.com/v1/classify", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Cohere classify error: ${res.statusText}`);
    const data = await res.json();
    return {
      id: data.id,
      classifications: data.classifications,
      meta: data.meta,
      raw: data,
    };
  }

  async speechToText(request: AISpeechToTextRequest): Promise<AISpeechToTextResponse> {
    throw new Error("Cohere speech-to-text not implemented");
  }

  async textToSpeech(request: AITextToSpeechRequest): Promise<AITextToSpeechResponse> {
    throw new Error("Cohere text-to-speech not implemented");
  }

  async vision(request: AIVisionRequest): Promise<AIVisionResponse> {
    throw new Error("Cohere vision not implemented");
  }

  async reasoning(request: AIReasoningRequest): Promise<AIReasoningResponse> {
    throw new Error("Cohere reasoning not implemented");
  }

  embeddings(request: AIEmbedRequest): Promise<AIEmbedResponse> {
    return this.embed(request);
  }
}
