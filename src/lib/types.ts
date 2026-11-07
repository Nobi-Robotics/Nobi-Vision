export type CompanionState =
  | "listening"
  | "thinking"
  | "guiding"
  | "needs_closer_view";

export type PowerGate = {
  voltageVerified: boolean;
  groundingVerified: boolean;
  pinoutVerified: boolean;
  polarityVerified: boolean;
};

export type Annotation = {
  label: string;
  x: number;
  y: number;
  kind: "point" | "caution";
};

export type TranscriptRole = "user" | "assistant" | "system";

export type TranscriptEntry = {
  id: string;
  role: TranscriptRole;
  text: string;
  at: number;
};

export type HistoryTurn = {
  role: "user" | "assistant";
  text: string;
};

export type SessionState = {
  board: string | null;
  components: string[];
  projectGoal: string | null;
  referencePinouts: string[];
  lastInstruction: string | null;
  visibleChanges: string[];
  uncertainties: string[];
  powerGate: PowerGate;
  annotations: Annotation[];
};

export type SceneChange = {
  detected: boolean;
  score: number;
  changedPixels: number;
};

export type ObserveRequest = {
  imageDataUrl: string;
  session: SessionState;
  history: HistoryTurn[];
  userQuestion: string | null;
  change: SceneChange;
  source: "camera" | "demo";
  sessionId: string;
};

export type ObserveSuccess = {
  ok: true;
  session: SessionState;
  reply: string;
  speak: string | null;
  companion: CompanionState;
  powerBlocked: boolean;
  powerGateOpen: boolean;
  model: string;
};

export type ObserveFailure = {
  ok: false;
  error: string;
  missingKey?: boolean;
};

export const SAMPLE_INTERVAL_MS = 2500;
export const MAX_ANALYSIS_IMAGE_CHARS = 1_500_000;
export const REFERENCE_PINOUT_ID = "ESP32 DevKit V1 / ESP32-WROOM-32 curated pinout";

export const DEMO_GOAL =
  "Blink an LED on GPIO4 through a 330 ohm resistor. Leave power disconnected until voltage, grounding, pinout, and polarity are confirmed.";

export function emptyPowerGate(): PowerGate {
  return {
    voltageVerified: false,
    groundingVerified: false,
    pinoutVerified: false,
    polarityVerified: false,
  };
}

export function emptySession(): SessionState {
  return {
    board: null,
    components: [],
    projectGoal: null,
    referencePinouts: [],
    lastInstruction: null,
    visibleChanges: [],
    uncertainties: [],
    powerGate: emptyPowerGate(),
    annotations: [],
  };
}

export function isPowerGateOpen(gate: PowerGate): boolean {
  return (
    gate.voltageVerified &&
    gate.groundingVerified &&
    gate.pinoutVerified &&
    gate.polarityVerified
  );
}

export function unmetPowerChecks(gate: PowerGate): string[] {
  const missing: string[] = [];
  if (!gate.voltageVerified) missing.push("voltage (3.3V logic, not 5V on a GPIO or the 3V3 pin)");
  if (!gate.groundingVerified) missing.push("grounding (common GND)");
  if (!gate.pinoutVerified) missing.push("pinout (against the ESP32 DevKit V1 reference)");
  if (!gate.polarityVerified) missing.push("polarity (LED anode toward the GPIO, cathode toward GND)");
  return missing;
}
