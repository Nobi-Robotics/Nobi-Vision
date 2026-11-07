import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LED_WIRING_REQUIREMENTS,
  lookupPins,
  pinByGpio,
  pinoutPromptBlock,
  reviewInstructionAgainstPinout,
} from "./esp32-pinout";
import { buildSystemPrompt } from "./prompt";

test("input-only, flash, and strapping pins are described accurately", () => {
  assert.equal(pinByGpio(34)?.kind, "input-only");
  assert.equal(pinByGpio(35)?.forbiddenAsLedOutput, true);
  assert.equal(pinByGpio(36)?.kind, "input-only");
  assert.equal(pinByGpio(39)?.kind, "input-only");
  assert.equal(pinByGpio(6)?.kind, "flash");
  assert.equal(pinByGpio(11)?.kind, "flash");
  assert.match(pinByGpio(12)?.summary ?? "", /LOW at reset/);
  assert.match(pinByGpio(4)?.summary ?? "", /good default LED pin/);
  assert.match(LED_WIRING_REQUIREMENTS, /330/);
  assert.match(LED_WIRING_REQUIREMENTS, /ADC2/);
  assert.match(LED_WIRING_REQUIREMENTS, /3\.3V/);
});

test("lookup finds GPIO numbers and power aliases", () => {
  const pins = lookupPins("Is GPIO34 ok, or should I use GPIO 4 and GND?");
  const ids = pins.map((pin) => pin.id).sort();
  assert.deepEqual(ids, ["GND", "GPIO34", "GPIO4"]);
});

test("forbidden LED pins are rewritten and cautious mentions are kept", () => {
  const bad = reviewInstructionAgainstPinout("Connect the LED anode to GPIO34.");
  assert.match(bad.instruction, /input-only/);
  assert.match(bad.instruction, /GPIO4/);

  const strap = reviewInstructionAgainstPinout("Use GPIO12 instead of GPIO4 for the LED.");
  assert.match(strap.instruction, /GPIO12 must stay LOW/);

  const careful = reviewInstructionAgainstPinout(
    "GPIO34 is input-only and cannot drive an LED. Use GPIO4 through the resistor.",
  );
  assert.deepEqual(careful.notes, []);
  assert.match(careful.instruction, /GPIO34 is input-only/);
});

test("the system prompt carries the power gate and the pin reference", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /Do not recommend connecting power/);
  assert.match(prompt, /GPIO34/);
  assert.match(prompt, /GPIO6/);
  assert.match(prompt, /Camera imagery cannot prove/);
  const block = pinoutPromptBlock();
  assert.match(block, /ESP32-WROOM-32/);
  assert.match(block, /not 5V tolerant/);
});
