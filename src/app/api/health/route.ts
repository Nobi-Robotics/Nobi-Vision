import { visionModelId, voiceModelId } from "@/lib/grok";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const configured = Boolean(process.env.XAI_API_KEY);
  return NextResponse.json(
    {
      ok: true,
      configured,
      visionModel: visionModelId(),
      voiceModel: voiceModelId(),
      message: configured
        ? "Vision model is configured."
        : "XAI_API_KEY is not set on the server. Add it to .env.local and restart. Camera preview, demo mode, and local scene-change detection still work.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
