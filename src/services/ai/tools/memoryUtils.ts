import { getConversationManager } from "../conversation";
import { logger } from "../../../utils/logger";
import type { MemoryDecisionContext, ToolMemoryContext } from "../memory/types";

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const conversationManager = getConversationManager();
    // Use the memory manager's embedding generation
    return await (
      conversationManager.instance as any
    ).memoryManager.generateEmbedding(text);
  } catch (error) {
    logger.error("Error generating embedding for memory curation", error);
    // Return a fallback embedding
    return new Array(1024).fill(0);
  }
}

export async function analyzeConversationContext(
  messages: any[]
): Promise<MemoryDecisionContext> {
  const participants = new Set(messages.map((m) => m.userId).filter(Boolean));
  const timeSpan =
    messages.length > 0
      ? new Date(messages[messages.length - 1].timestamp).getTime() -
        new Date(messages[0].timestamp).getTime()
      : 0;

  const content = messages
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .join(" ");
  const topics = extractTopics(content);
  const sentiment = analyzeSentiment(content);

  return {
    messages,
    participants: Array.from(participants),
    conversationLength: messages.length,
    timeSpan,
    topics,
    sentiment,
    userInteraction: messages.some((m) => m.type === "user"),
    decisionMade: /(?:decide|choose|will|going to|plan to)/i.test(content),
    factualContent: /(?:fact|information|data|research|study)/i.test(content),
    preferenceExpressed: /(?:prefer|like|dislike|favorite|hate|love)/i.test(
      content
    ),
  };
}

function extractTopics(content: string): string[] {
  const topicPatterns = [
    /(?:about|discuss|talk about|regarding)\s+(\w+(?:\s+\w+)*)/gi,
    /(?:topic|subject|theme):\s*(\w+(?:\s+\w+)*)/gi,
    /(?:learning|studying|working on)\s+(\w+(?:\s+\w+)*)/gi,
  ];

  const topics = new Set<string>();

  for (const pattern of topicPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        topics.add(match[1].toLowerCase().trim());
      }
    }
  }

  return Array.from(topics).slice(0, 5);
}

function analyzeSentiment(content: string): string {
  const positiveWords = [
    "good",
    "great",
    "excellent",
    "amazing",
    "wonderful",
    "fantastic",
    "love",
    "like",
    "enjoy",
  ];
  const negativeWords = [
    "bad",
    "terrible",
    "awful",
    "hate",
    "dislike",
    "frustrated",
    "annoyed",
    "disappointed",
  ];

  const words = content.toLowerCase().split(/\s+/);
  const positiveCount = words.filter((word) =>
    positiveWords.includes(word)
  ).length;
  const negativeCount = words.filter((word) =>
    negativeWords.includes(word)
  ).length;

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

export function calculateImportanceScore(
  content: string,
  context: any
): number {
  let score = 0;

  // Base score from content length and complexity
  score += Math.min(content.length / 100, 2);

  // Boost for decision-making content
  if (/(?:decide|choose|will|going to|plan to)/i.test(content)) score += 3;

  // Boost for preferences
  if (/(?:prefer|like|dislike|favorite)/i.test(content)) score += 2;

  // Boost for factual information
  if (/(?:fact|information|data|research)/i.test(content)) score += 2;

  // Boost for questions and answers
  if (/\?/.test(content)) score += 1;

  // Boost for emotional content
  if (/(?:excited|frustrated|happy|sad|angry)/i.test(content)) score += 1;

  // Context-based boosts
  if (context.userInteraction) score += 1;
  if (context.conversationLength > 5) score += 1;

  return Math.min(score, 10);
}

export function determineMemoryCategory(content: string): string {
  const patterns = {
    user_preference: /(?:prefer|like|dislike|favorite|hate|love)/i,
    important_fact: /(?:fact|information|data|research|study)/i,
    decision: /(?:decide|choose|will|going to|plan to)/i,
    relationship: /(?:friend|family|colleague|team|partner)/i,
    event: /(?:meeting|appointment|deadline|event|conference)/i,
    knowledge: /(?:learn|study|understand|know|remember)/i,
    reminder: /(?:remind|remember|don't forget|make sure)/i,
    feedback: /(?:feedback|suggestion|improvement|better)/i,
  };

  for (const [category, pattern] of Object.entries(patterns)) {
    if (pattern.test(content)) return category;
  }

  return "context";
}

export function determineMemoryType(
  content: string
): "episodic" | "semantic" | "procedural" | "contextual" {
  if (/(?:how to|step|process|procedure)/i.test(content)) return "procedural";
  if (/(?:fact|definition|concept|theory)/i.test(content)) return "semantic";
  if (/(?:when|where|what happened|experience)/i.test(content))
    return "episodic";
  return "contextual";
}

export function determineRetentionPriority(
  importance: number,
  category: string
): "low" | "medium" | "high" | "critical" {
  if (importance >= 8) return "critical";
  if (importance >= 6) return "high";
  if (importance >= 4) return "medium";
  return "low";
}

export async function checkForDuplication(
  content: string,
  existingMemories: any[]
): Promise<boolean> {
  const embedding = await generateEmbedding(content);

  for (const memory of existingMemories) {
    const similarity = calculateCosineSimilarity(embedding, memory.embedding);
    if (similarity > 0.9) return true;
  }

  return false;
}

function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  return dotProduct / (magnitudeA * magnitudeB);
}

export function generateAnalysisReasoning(
  content: string,
  importance: number,
  category: string,
  isDuplicate: boolean
): string {
  const reasons = [];

  if (importance >= 8)
    reasons.push("High importance due to significant content");
  if (importance >= 6) reasons.push("Medium-high importance");
  if (isDuplicate) reasons.push("Similar content already exists in memory");

  reasons.push(`Categorized as ${category}`);

  if (content.includes("?"))
    reasons.push("Contains questions or seeks information");
  if (/(?:decide|choose)/i.test(content))
    reasons.push("Contains decision-making content");

  return reasons.join("; ");
}

export function extractFactualInformation(content: string): string[] {
  const facts = [];

  // Extract sentences with factual patterns
  const sentences = content.split(/[.!?]+/);

  for (const sentence of sentences) {
    if (/(?:is|are|was|were|has|have|will be|can be)/i.test(sentence)) {
      facts.push(sentence.trim());
    }
  }

  return facts.slice(0, 3);
}

export function generateTags(content: string, category: string): string[] {
  const tags = [category];

  // Add topic-based tags
  const topics = extractTopics(content);
  tags.push(...topics);

  // Add context tags
  if (content.includes("?")) tags.push("question");
  if (/(?:urgent|important|asap)/i.test(content)) tags.push("urgent");
  if (/(?:personal|private)/i.test(content)) tags.push("personal");

  return [...new Set(tags)];
}

export async function findRelatedMemories(
  content: string,
  context: ToolMemoryContext
): Promise<string[]> {
  // This would typically use semantic search
  // For now, return empty array as placeholder
  return [];
}

export function calculateConfidence(
  importance: number,
  category: string,
  isDuplicate: boolean
): number {
  let confidence = 0.5;

  if (importance >= 8) confidence += 0.3;
  else if (importance >= 6) confidence += 0.2;
  else if (importance >= 4) confidence += 0.1;

  if (category !== "context") confidence += 0.1;

  if (isDuplicate) confidence -= 0.3;

  return Math.max(0, Math.min(1, confidence));
}
