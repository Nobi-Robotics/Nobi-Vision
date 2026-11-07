import type { Annotation } from "./types";

export type ModelVision = {
  board: string | null;
  components: string[];
  projectGoal: string | null;
  visibleChanges: string[];
  uncertainties: string[];
  instruction: string;
  speak: string | null;
  needsCloserView: boolean;
  annotations: Annotation[];
};

function asString(value: unknown, max = 400): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asStringList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = asString(item, maxLen);
    if (!text) continue;
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(source.slice(start, end + 1));
    }
    throw new Error("no-json");
  }
}

export function parseModelVision(raw: string): ModelVision {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(raw);
  } catch {
    const fallback = asString(raw, 500) ?? "I could not read that frame. Hold the board steady and I will look again.";
    return {
      board: null,
      components: [],
      projectGoal: null,
      visibleChanges: [],
      uncertainties: ["The vision reply was not structured. Treat the wording as tentative."],
      instruction: fallback,
      speak: fallback,
      needsCloserView: false,
      annotations: [],
    };
  }

  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const annotations: Annotation[] = [];
  if (Array.isArray(record.annotations)) {
    for (const item of record.annotations) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const label = asString(row.label, 40);
      const x = typeof row.x === "number" ? row.x : Number.NaN;
      const y = typeof row.y === "number" ? row.y : Number.NaN;
      if (!label || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      annotations.push({
        label,
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
        kind: row.kind === "caution" ? "caution" : "point",
      });
      if (annotations.length >= 8) break;
    }
  }

  const instruction =
    asString(record.instruction, 500) ??
    "Tell me what you are building, and keep the board in frame. I will give one step at a time.";

  return {
    board: asString(record.board, 120),
    components: asStringList(record.components, 12, 80),
    projectGoal: asString(record.projectGoal, 240),
    visibleChanges: asStringList(record.visibleChanges, 6, 220),
    uncertainties: asStringList(record.uncertainties, 6, 220),
    instruction,
    speak: asString(record.speak, 320),
    needsCloserView: record.needsCloserView === true,
    annotations,
  };
}
