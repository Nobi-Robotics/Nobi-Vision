import { reviewInstructionAgainstPinout } from "./esp32-pinout";
import { analyzeWithGrok } from "./grok";
import { parseModelVision } from "./parse";
import { derivePowerGate, enforceGuidance } from "./power-gate";
import {
  REFERENCE_PINOUT_ID,
  isPowerGateOpen,
  unmetPowerChecks,
  type Annotation,
  type CompanionState,
  type ObserveRequest,
  type SessionState,
} from "./types";

function unique(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function clampAnnotations(items: Annotation[]): Annotation[] {
  return items.slice(0, 8).map((item) => ({
    label: item.label.slice(0, 40),
    x: Math.min(1, Math.max(0, item.x)),
    y: Math.min(1, Math.max(0, item.y)),
    kind: item.kind,
  }));
}

export async function runObservation(
  input: ObserveRequest,
  signal: AbortSignal,
): Promise<{
  session: SessionState;
  reply: string;
  speak: string | null;
  companion: CompanionState;
  powerBlocked: boolean;
  powerGateOpen: boolean;
  model: string;
}> {
  const userTexts = input.history.filter((turn) => turn.role === "user").map((turn) => turn.text);
  if (input.userQuestion) userTexts.push(input.userQuestion);
  const powerGate = derivePowerGate(userTexts);

  const grounded: ObserveRequest = {
    ...input,
    session: { ...input.session, powerGate },
  };

  const { content, model } = await analyzeWithGrok(grounded, signal);
  const vision = parseModelVision(content);
  const pinReview = reviewInstructionAgainstPinout(vision.instruction);
  const gated = enforceGuidance(pinReview.instruction, powerGate);

  const speakSource = vision.speak && vision.speak.trim() ? vision.speak : gated.text;
  const speakReviewed = reviewInstructionAgainstPinout(speakSource);
  const speakGated = enforceGuidance(speakReviewed.instruction, powerGate);

  const uncertainties = unique(
    [
      ...vision.uncertainties,
      ...pinReview.notes,
      ...unmetPowerChecks(powerGate).map((item) => `Needs confirmation before power: ${item}.`),
    ],
    8,
  );

  const changes = input.change.detected
    ? vision.visibleChanges.length
      ? vision.visibleChanges
      : ["The scene changed, but the model did not describe a specific wire movement. Confirm what moved."]
    : vision.visibleChanges.length
      ? vision.visibleChanges
      : ["No significant scene change since the last sample."];

  const session: SessionState = {
    board: vision.board ?? input.session.board,
    components: vision.components.length ? vision.components : input.session.components,
    projectGoal: input.session.projectGoal ?? vision.projectGoal,
    referencePinouts: [REFERENCE_PINOUT_ID],
    lastInstruction: gated.text,
    visibleChanges: changes,
    uncertainties,
    powerGate,
    annotations: clampAnnotations(vision.annotations),
  };

  let companion: CompanionState = "guiding";
  if (vision.needsCloserView && input.source === "camera") companion = "needs_closer_view";

  const shouldSpeak = Boolean(input.userQuestion) || input.change.detected || session.lastInstruction !== input.session.lastInstruction;

  return {
    session,
    reply: gated.text,
    speak: shouldSpeak ? speakGated.text : null,
    companion,
    powerBlocked: gated.blocked,
    powerGateOpen: isPowerGateOpen(powerGate),
    model,
  };
}
