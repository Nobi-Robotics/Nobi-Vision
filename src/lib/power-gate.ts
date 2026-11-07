import { isPowerGateOpen, unmetPowerChecks, type PowerGate } from "./types";

const VOLTAGE =
  /\b(confirm|confirmed|verify|verified)\b.{0,40}\b(voltage|3\.3\s*v(?:olts)?)|\b(voltage|3\.3\s*v(?:olts)?)\b.{0,40}\b(confirmed|verified|is 3\.3)|\bi confirm the supply voltage\b/i;

const GROUND =
  /\b(confirm|confirmed|verify|verified)\b.{0,40}\b(ground|grounding|gnd)|\b(ground|grounding|gnd)\b.{0,32}\b(confirmed|verified|tied|connected)|\bi confirm the grounds\b/i;

const PINOUT =
  /\b(confirm|confirmed|verify|verified)\b.{0,40}\bpin-?out|\bpin-?out\b.{0,32}\b(confirmed|verified|matches)|\bi confirm the pinout\b/i;

const POLARITY =
  /\b(confirm|confirmed|verify|verified)\b.{0,40}\bpolarit|\bpolarit\w*\b.{0,32}\b(confirmed|verified|correct)|\bi confirm (?:the )?led polarity\b|\banode toward the gpio\b/i;

export function derivePowerGate(userTexts: string[]): PowerGate {
  const gate: PowerGate = {
    voltageVerified: false,
    groundingVerified: false,
    pinoutVerified: false,
    polarityVerified: false,
  };
  for (const raw of userTexts) {
    const text = raw.trim();
    if (!text) continue;
    if (VOLTAGE.test(text)) gate.voltageVerified = true;
    if (GROUND.test(text)) gate.groundingVerified = true;
    if (PINOUT.test(text)) gate.pinoutVerified = true;
    if (POLARITY.test(text)) gate.polarityVerified = true;
  }
  return gate;
}

export const CONFIRM_PHRASES = {
  voltage: "I confirm the supply voltage is 3.3V for ESP32 logic and GPIO. I am not feeding 5V into a GPIO or the 3V3 pin.",
  grounding: "I confirm the grounds are tied together.",
  pinout: "I confirm the pinout against the ESP32 DevKit V1 reference.",
  polarity: "I confirm LED polarity: anode toward the GPIO through the resistor, cathode toward ground.",
} as const;

const NEGATION = /\b(do not|don't|dont|never|avoid|without connecting|keep .{0,24}disconnected|leave .{0,20}(off|disconnected)|not yet)\b/i;

function recommendsConnectingPower(text: string): boolean {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.some((sentence) => {
    if (NEGATION.test(sentence)) return false;
    const s = sentence.toLowerCase();
    const action = /\b(connect|plug|apply|enable|attach|turn on|switch on|power up|hook up)\b/.test(s);
    const powerObject = /\b(usb|vin|battery|supply)\b/.test(s) || /\bpower\b/.test(s) || /\b5\s*v\b/.test(s);
    if (action && powerObject) return true;
    return /\bplug (it|the board|the esp32|usb|the usb|the cable) in\b/.test(s);
  });
}

const PIN_OR_RAIL = "gpio\\s*\\d{0,2}|3\\s*v\\s*3|3v3|3\\s*\\.\\s*3|signal pin|data pin";

const ALWAYS_DANGEROUS = [
  new RegExp(`\\b5\\s*v(?:olts)?\\b.{0,48}\\b(?:${PIN_OR_RAIL})\\b`, "i"),
  new RegExp(`\\b(?:${PIN_OR_RAIL})\\b.{0,48}\\b5\\s*v(?:olts)?\\b`, "i"),
  new RegExp(`\\b(?:feed|put|apply|connect|tie|inject)\\b.{0,40}\\b5\\s*v(?:olts)?\\b.{0,48}\\b(?:${PIN_OR_RAIL})\\b`, "i"),
  /\bled\b.{0,40}\bwithout (a |the )?(series )?resistor\b/i,
  /\bno (series )?resistor\b/i,
];

const SAFETY_CLAIM =
  /\b(electrically safe|safe to power|confirmed correct|definitely correct|i certify|guaranteed (safe|correct)|wiring is correct|this is safe)\b/i;

function dangerousRegardlessOfGate(text: string): boolean {
  return ALWAYS_DANGEROUS.some((pattern) => pattern.test(text));
}

export function enforceGuidance(
  text: string,
  gate: PowerGate,
): { text: string; blocked: boolean; reason: "power-gate" | "dangerous" | "safety-claim" | null } {
  const trimmed = text.trim();
  if (!trimmed) return { text: trimmed, blocked: false, reason: null };

  if (dangerousRegardlessOfGate(trimmed)) {
    return {
      text: "Stop. Leave power disconnected. ESP32 logic is 3.3V only: do not put 5V on a GPIO or the 3V3 pin, and do not drive an LED without a series resistor.",
      blocked: true,
      reason: "dangerous",
    };
  }

  if (!isPowerGateOpen(gate) && recommendsConnectingPower(trimmed)) {
    const missing = unmetPowerChecks(gate);
    return {
      text: `Do not connect power yet. Still needs a spoken or tapped confirmation: ${missing.join("; ")}. A camera frame cannot verify voltage, grounding, pinout, or polarity.`,
      blocked: true,
      reason: "power-gate",
    };
  }

  if (SAFETY_CLAIM.test(trimmed)) {
    const softened = trimmed.replace(SAFETY_CLAIM, "not something the camera can certify");
    const caveat = /camera (images|imagery|view|frame)/i.test(softened)
      ? softened
      : `${softened} Camera imagery alone cannot confirm electrical safety or correctness.`;
    return { text: caveat, blocked: false, reason: "safety-claim" };
  }

  return { text: trimmed, blocked: false, reason: null };
}
