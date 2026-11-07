import assert from "node:assert/strict";
import { test } from "node:test";
import { parseModelVision } from "./parse";

test("parses a fenced vision payload and clamps annotations", () => {
  const raw = `\`\`\`json
{"board":"ESP32 DevKit V1","components":["LED","330 ohm resistor"],"projectGoal":null,"visibleChanges":["LED moved"],"uncertainties":["polarity"],"instruction":"Check the LED flat side.","speak":"Check the flat side of the LED.","needsCloserView":false,"annotations":[{"label":"GPIO4","x":1.4,"y":-2,"kind":"point"},{"label":"","x":0.2,"y":0.2}]}
\`\`\``;
  const parsed = parseModelVision(raw);
  assert.equal(parsed.board, "ESP32 DevKit V1");
  assert.deepEqual(parsed.components, ["LED", "330 ohm resistor"]);
  assert.equal(parsed.annotations.length, 1);
  assert.equal(parsed.annotations[0]?.x, 1);
  assert.equal(parsed.annotations[0]?.y, 0);
  assert.equal(parsed.annotations[0]?.label, "GPIO4");
});

test("falls back when the model returns prose", () => {
  const parsed = parseModelVision("Hold the board a little closer.");
  assert.match(parsed.instruction, /closer/);
  assert.equal(parsed.uncertainties.length, 1);
});
