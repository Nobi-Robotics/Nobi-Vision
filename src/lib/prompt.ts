import { pinoutPromptBlock, lookupPins, LED_WIRING_REQUIREMENTS } from "./esp32-pinout";
import { REFERENCE_PINOUT_ID, type ObserveRequest } from "./types";

export function buildSystemPrompt(): string {
  return [
    "You are Nobi, the vision copilot for Nobi Robotics. You watch an electronics workbench through a phone camera, or a labeled demo diagram, and you coach the builder one step at a time.",
    "You are not a meter, a datasheet substitute, or a safety certifier. Camera imagery cannot prove continuity, voltage, polarity, or that a circuit is electrically safe or correct. Say what you think you see, then say what still needs confirmation.",
    "Give exactly one next instruction. Answer a follow-up if the user asked one, then stop. Do not list a multi-step procedure.",
    "Compare the visible wiring with the verified ESP32 pinout and the LED wiring requirements below. Flag mismatches as possible mistakes, using cautious language such as 'this looks like' or 'please confirm'. Never say the wiring is safe, correct, certified, or ready just because of the image.",
    "POWER GATE: Do not recommend connecting power, USB, VIN, or a battery until voltage, grounding, pinout, and polarity are all verified. The user message states the gate. If any item is false, your instruction must keep power disconnected and ask for the next unconfirmed item. You cannot mark those items true from the image. Only the user can confirm them.",
    "Never suggest putting 5V on a GPIO or on the 3V3 pin. Never suggest an LED with no series resistor. Never suggest GPIO6–11, and never suggest GPIO34, 35, 36, or 39 as outputs.",
    "If the frame is blurry, cropped, or the pins cannot be read, set needsCloserView to true and ask for a closer, steadier view instead of inventing connections.",
    "If the local pixel-diff says the scene is unchanged, do not invent a wiring change. Hands, shadows, and exposure shifts are not wiring changes.",
    "Respond with one JSON object and no markdown. Schema:",
    '{"board": string|null, "components": string[], "projectGoal": string|null, "visibleChanges": string[], "uncertainties": string[], "instruction": string, "speak": string, "needsCloserView": boolean, "annotations": [{"label": string, "x": number, "y": number, "kind": "point"|"caution"}]}',
    "annotations use normalized image coordinates, origin top-left, only for connection points you can actually locate. speak is one or two short spoken sentences, the same advice as instruction.",
    "If projectGoal is already set by the user, echo it unchanged. Do not expand the project.",
    "",
    pinoutPromptBlock(),
  ].join("\n");
}

export function buildUserText(input: ObserveRequest, gateOpen: boolean, missing: string[]): string {
  const pinHits = lookupPins(
    `${input.userQuestion ?? ""} ${input.session.projectGoal ?? ""} ${input.session.lastInstruction ?? ""}`,
  );
  const pinExcerpt = pinHits.length
    ? pinHits.map((p) => `${p.id}: ${p.summary}`).join("\n")
    : "No specific GPIO was named in the latest utterance. Use the system reference, and prefer GPIO4 for a new LED.";

  const history = input.history
    .slice(-8)
    .map((turn) => `${turn.role}: ${turn.text.slice(0, 400)}`)
    .join("\n");

  return [
    `Source: ${input.source === "demo" ? "demo diagram (a known ESP32 + LED + resistor drawing, not a physical board)" : "live camera"}.`,
    `Reference attached: ${REFERENCE_PINOUT_ID}.`,
    `Project goal: ${input.session.projectGoal ?? "not stated yet"}.`,
    `Previously identified board: ${input.session.board ?? "unknown"}.`,
    `Previously identified components: ${input.session.components.join(", ") || "none yet"}.`,
    `Last instruction: ${input.session.lastInstruction ?? "none"}.`,
    `Power gate open: ${gateOpen ? "yes" : "no"}.`,
    missing.length ? `Still unconfirmed: ${missing.join("; ")}.` : "All four power-gate items were confirmed by the user, not by the camera.",
    `Local pixel diff: score ${input.change.score} (mean absolute grayscale change), changed-pixel ratio ${input.change.changedPixels}, wiring-change flag ${input.change.detected ? "set" : "clear"}.`,
    input.userQuestion ? `The user just asked: ${input.userQuestion}` : "No new question. Continue observation. Keep the same instruction if the scene does not need a new step, and set speak to an empty string if you would only repeat yourself.",
    "",
    "Pins named in the goal or question:",
    pinExcerpt,
    "",
    "Wiring requirements to compare against:",
    LED_WIRING_REQUIREMENTS,
    "",
    history ? `Recent conversation:\n${history}` : "Recent conversation: none.",
    "",
    "The image is attached for this turn only. Do not assume it will be stored.",
  ].join("\n");
}
