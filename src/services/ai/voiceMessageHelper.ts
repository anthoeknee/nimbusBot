import { Message, Attachment } from "discord.js";
import {
  AIProvider,
  AISpeechToTextRequest,
  AISpeechToTextResponse,
} from "../../types/ai";
import { AIClient } from "./client";

// Core extraction function: extracts speech from a Discord message's audio attachment
export async function extractSpeechFromMessage(
  message: Message,
  options: { provider: AIProvider; model?: string; language?: string },
): Promise<AISpeechToTextResponse | null> {
  // Find the first audio attachment (Discord voice messages are .ogg, .mp3, .wav, etc)
  const audioAttachment = message.attachments.find(
    (att: Attachment) =>
      att.contentType?.startsWith("audio") ||
      att.name.endsWith(".ogg") ||
      att.name.endsWith(".mp3") ||
      att.name.endsWith(".wav") ||
      att.name.endsWith(".m4a"),
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

  // Use your AIClient to perform speech-to-text
  const aiClient = new AIClient();
  return aiClient.speechToText(sttRequest);
}

// High-level handler: extracts speech and runs a callback, with user feedback
export async function handleVoiceMessage(
  message: Message,
  options: { provider: AIProvider; model?: string; language?: string },
  onText: (text: string, response: AISpeechToTextResponse) => Promise<void>,
): Promise<AISpeechToTextResponse | null> {
  try {
    const sttResponse = await extractSpeechFromMessage(message, options);
    if (sttResponse && sttResponse.text) {
      await onText(sttResponse.text, sttResponse);
      return sttResponse;
    } else {
      await message.reply(
        "❌ Sorry, I couldn't recognize any speech in your audio.",
      );
      return null;
    }
  } catch (error: any) {
    await message.reply(`❌ Error extracting speech: ${error.message}`);
    return null;
  }
}
