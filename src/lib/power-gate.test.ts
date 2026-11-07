import assert from "node:assert/strict";
import { test } from "node:test";
import { CONFIRM_PHRASES, derivePowerGate, enforceGuidance } from "./power-gate";
import { emptyPowerGate, isPowerGateOpen } from "./types";

test("each confirmation phrase opens only its own check", () => {
  const voltage = derivePowerGate([CONFIRM_PHRASES.voltage]);
  assert.equal(voltage.voltageVerified, true);
  assert.equal(voltage.groundingVerified, false);
  assert.equal(voltage.pinoutVerified, false);
  assert.equal(voltage.polarityVerified, false);

  const ground = derivePowerGate([CONFIRM_PHRASES.grounding]);
  assert.equal(ground.groundingVerified, true);
  assert.equal(ground.voltageVerified, false);

  const pinout = derivePowerGate([CONFIRM_PHRASES.pinout]);
  assert.equal(pinout.pinoutVerified, true);
  assert.equal(pinout.voltageVerified, false);

  const polarity = derivePowerGate([CONFIRM_PHRASES.polarity]);
  assert.equal(polarity.polarityVerified, true);
  assert.equal(polarity.groundingVerified, false);
  assert.equal(isPowerGateOpen(derivePowerGate(Object.values(CONFIRM_PHRASES))), true);
});

test("a question about voltage does not confirm it", () => {
  const gate = derivePowerGate(["what is the voltage on this pin?", "where is ground?"]);
  assert.deepEqual(gate, emptyPowerGate());
});

test("power stays blocked until the gate is open", () => {
  const closed = enforceGuidance("Plug in the USB cable now.", emptyPowerGate());
  assert.equal(closed.blocked, true);
  assert.match(closed.text, /Do not connect power yet/);

  const open = enforceGuidance("Plug in the USB cable now.", {
    voltageVerified: true,
    groundingVerified: true,
    pinoutVerified: true,
    polarityVerified: true,
  });
  assert.equal(open.blocked, false);
  assert.match(open.text, /USB/);
});

test("ordinary wiring steps are not treated as power advice", () => {
  const result = enforceGuidance(
    "Connect GPIO4 to the resistor, then the LED anode, with the cathode to GND.",
    emptyPowerGate(),
  );
  assert.equal(result.blocked, false);
  assert.match(result.text, /GPIO4/);
});

test("negated power advice is kept", () => {
  const result = enforceGuidance("Do not connect USB yet. Seat the resistor first.", emptyPowerGate());
  assert.equal(result.blocked, false);
  assert.match(result.text, /Do not connect USB/);
});

test("5V on a GPIO or the 3V3 pin is blocked even after the gate opens", () => {
  const open = {
    voltageVerified: true,
    groundingVerified: true,
    pinoutVerified: true,
    polarityVerified: true,
  };
  const gpio = enforceGuidance("Put 5V on GPIO4 so the LED is brighter.", open);
  assert.equal(gpio.reason, "dangerous");
  const rail = enforceGuidance("Connect 5V to the 3V3 pin.", open);
  assert.equal(rail.reason, "dangerous");
});

test("the model cannot certify safety from a camera frame", () => {
  const result = enforceGuidance("This wiring is electrically safe.", emptyPowerGate());
  assert.match(result.text, /cannot confirm electrical safety/);
  assert.doesNotMatch(result.text, /electrically safe/);
});
