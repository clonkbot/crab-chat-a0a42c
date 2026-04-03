import { action } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// 1. TEXT CHAT — Grok (xAI) via OpenAI-compatible API
// ---------------------------------------------------------------------------
export const chat = action({
  args: {
    messages: v.array(
      v.object({
        role: v.union(
          v.literal("user"),
          v.literal("assistant"),
          v.literal("system")
        ),
        content: v.string(),
      })
    ),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("XAI_API_KEY not configured");

    const messages = args.systemPrompt
      ? [{ role: "system" as const, content: args.systemPrompt }, ...args.messages]
      : args.messages;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content as string;
  },
});

// ---------------------------------------------------------------------------
// 2. IMAGE GENERATION / EDITING — Gemini (Google)
// ---------------------------------------------------------------------------
export const generateImage = action({
  args: {
    prompt: v.string(),
    referenceImage: v.optional(v.string()), // base64 PNG for editing
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const parts: any[] = [];

    // If editing an existing image, include it as inline_data first
    if (args.referenceImage) {
      parts.push({
        inline_data: { mime_type: "image/png", data: args.referenceImage },
      });
    }
    parts.push({ text: args.prompt });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData
    );
    return (imagePart?.inlineData?.data as string) || null;
  },
});

// ---------------------------------------------------------------------------
// 3. TEXT-TO-SPEECH — Gemini TTS (Google)
// ---------------------------------------------------------------------------
export const textToSpeech = action({
  args: {
    text: v.string(),
    voice: v.optional(v.string()), // "Kore", "Puck", "Charon", "Fenrir", "Leda", "Orus"
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: args.text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: args.voice || "Kore",
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini TTS error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // Returns base64 PCM audio (24kHz, 16-bit, mono)
    return (data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data as string) || null;
  },
});
