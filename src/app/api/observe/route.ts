import { GrokConfigError, GrokRequestError } from "@/lib/grok";
import { runObservation } from "@/lib/observe";
import { clientKey, takeToken } from "@/lib/throttle";
import { MAX_ANALYSIS_IMAGE_CHARS, emptyPowerGate, type ObserveRequest } from "@/lib/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isObserveRequest(value: unknown): value is ObserveRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as ObserveRequest;
  return (
    typeof body.imageDataUrl === "string" &&
    typeof body.sessionId === "string" &&
    body.session !== null &&
    typeof body.session === "object" &&
    Array.isArray(body.history) &&
    (body.source === "camera" || body.source === "demo") &&
    body.change !== null &&
    typeof body.change === "object"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "The observation request was not valid JSON." }, { status: 400 });
  }

  if (!isObserveRequest(body)) {
    return NextResponse.json({ ok: false, error: "The observation request was missing a frame or session." }, { status: 400 });
  }

  if (!takeToken(clientKey(request))) {
    return NextResponse.json(
      { ok: false, error: "Too many vision requests. Nobi is waiting a moment before looking again." },
      { status: 429 },
    );
  }

  const image = body.imageDataUrl.trim();
  if (!/^data:image\/(jpeg|jpg|png);base64,[a-z0-9+/=\s]+$/i.test(image)) {
    return NextResponse.json(
      { ok: false, error: "Frames must be a JPEG or PNG data URL. Nothing was stored." },
      { status: 400 },
    );
  }
  if (image.length > MAX_ANALYSIS_IMAGE_CHARS) {
    return NextResponse.json(
      { ok: false, error: "That frame is too large. Nobi will try a smaller sample." },
      { status: 413 },
    );
  }

  const history = body.history
    .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string")
    .slice(-12)
    .map((turn) => ({ role: turn.role, text: turn.text.slice(0, 500) }));

  const question = typeof body.userQuestion === "string" ? body.userQuestion.slice(0, 500) : null;
  const session = {
    board: typeof body.session.board === "string" ? body.session.board.slice(0, 120) : null,
    components: Array.isArray(body.session.components)
      ? body.session.components.filter((item): item is string => typeof item === "string").slice(0, 12)
      : [],
    projectGoal: typeof body.session.projectGoal === "string" ? body.session.projectGoal.slice(0, 300) : null,
    referencePinouts: [],
    lastInstruction:
      typeof body.session.lastInstruction === "string" ? body.session.lastInstruction.slice(0, 500) : null,
    visibleChanges: [],
    uncertainties: [],
    powerGate: emptyPowerGate(),
    annotations: [],
  };

  const input: ObserveRequest = {
    imageDataUrl: image,
    session,
    history,
    userQuestion: question,
    change: {
      detected: Boolean(body.change.detected),
      score: Number.isFinite(body.change.score) ? body.change.score : 0,
      changedPixels: Number.isFinite(body.change.changedPixels) ? body.change.changedPixels : 0,
    },
    source: body.source,
    sessionId: body.sessionId.slice(0, 64),
  };

  try {
    const result = await runObservation(input, request.signal);
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof GrokConfigError) {
      return NextResponse.json({ ok: false, error: error.message, missingKey: true }, { status: 503 });
    }
    if (error instanceof GrokRequestError) {
      const status = error.status === 401 ? 401 : error.status === 429 ? 429 : 502;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ ok: false, error: "The observation was cancelled." }, { status: 499 });
    }
    return NextResponse.json(
      { ok: false, error: "The vision request failed before a reply came back." },
      { status: 502 },
    );
  }
}
