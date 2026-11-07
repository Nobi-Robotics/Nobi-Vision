import { voiceModelId } from "@/lib/grok";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN_URL = "https://api.x.ai/v1/realtime/client_secrets";

export async function POST() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "XAI_API_KEY is not set on the server, so Grok Voice cannot start. Browser speech still works.",
      },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "xAI did not mint a Grok Voice token. Browser speech is still available." },
        { status: 502 },
      );
    }
    const data = (await response.json()) as { value?: string; expires_at?: number };
    if (!data.value) {
      return NextResponse.json(
        { ok: false, error: "The Grok Voice token response was empty. Browser speech is still available." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        value: data.value,
        expiresAt: data.expires_at ?? null,
        model: voiceModelId(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "The Grok Voice token request failed. Browser speech is still available." },
      { status: 502 },
    );
  }
}
