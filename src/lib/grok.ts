import { buildSystemPrompt, buildUserText } from "./prompt";
import type { ObserveRequest } from "./types";
import { isPowerGateOpen, unmetPowerChecks } from "./types";

const CHAT_URL = "https://api.x.ai/v1/chat/completions";

export class GrokConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrokConfigError";
  }
}

export class GrokRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GrokRequestError";
    this.status = status;
  }
}

function safeSnippet(text: string): string {
  return text.replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, "[image]").slice(0, 280);
}

type ChatBody = {
  model: string;
  messages: unknown[];
  max_tokens: number;
  temperature: number;
  reasoning_effort?: string;
  response_format?: { type: "json_object" };
};

async function postChat(apiKey: string, body: ChatBody, signal: AbortSignal, sessionId: string): Promise<Response> {
  const send = (payload: ChatBody) =>
    fetch(CHAT_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "x-grok-conv-id": sessionId.slice(0, 64),
      },
      body: JSON.stringify(payload),
    });

  let response = await send(body);
  if (response.status !== 400) return response;

  const errText = safeSnippet(await response.text());
  const next: ChatBody = { ...body };
  let retry = false;
  if (/response_format/i.test(errText)) {
    delete next.response_format;
    retry = true;
  }
  if (/reasoning_effort/i.test(errText)) {
    delete next.reasoning_effort;
    retry = true;
  }
  if (!retry) {
    throw new GrokRequestError(400, errText || "The vision model rejected the request.");
  }
  response = await send(next);
  return response;
}

export async function analyzeWithGrok(input: ObserveRequest, signal: AbortSignal): Promise<{
  content: string;
  model: string;
}> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new GrokConfigError(
      "XAI_API_KEY is not set on the server. Add it to .env.local and restart. The camera, demo bench, and local scene-change detector keep working.",
    );
  }

  const model = process.env.XAI_VISION_MODEL || "grok-4.7";
  const effort = process.env.XAI_REASONING_EFFORT || "low";
  const gate = input.session.powerGate;
  const gateOpen = isPowerGateOpen(gate);
  const missing = unmetPowerChecks(gate);
  const detail = input.userQuestion ? "high" : "low";

  const body: ChatBody = {
    model,
    temperature: 0.2,
    max_tokens: 700,
    reasoning_effort: effort,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: input.imageDataUrl, detail },
          },
          { type: "text", text: buildUserText(input, gateOpen, missing) },
        ],
      },
    ],
  };

  const response = await postChat(apiKey, body, signal, input.sessionId || "nobi");
  if (!response.ok) {
    const errText = safeSnippet(await response.text());
    if (response.status === 401) {
      throw new GrokRequestError(401, "The server XAI_API_KEY was rejected by xAI. Check the key in .env.local.");
    }
    if (response.status === 429) {
      throw new GrokRequestError(429, "xAI rate limit reached. The observation loop will try again on the next change.");
    }
    throw new GrokRequestError(response.status, errText || `Vision request failed (${response.status}).`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
    model?: string;
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new GrokRequestError(502, "The vision model returned an empty reply.");
  }
  return { content, model: json.model || model };
}

export function visionModelId(): string {
  return process.env.XAI_VISION_MODEL || "grok-4.7";
}

export function voiceModelId(): string {
  return process.env.XAI_VOICE_MODEL || "grok-voice-latest";
}
