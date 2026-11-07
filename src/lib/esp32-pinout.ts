/**
 * Curated ESP32 DevKit V1 / ESP32-WROOM-32 facts.
 * Header order matches the common DOIT 30-pin DevKit with USB at the bottom.
 * Clone silkscreens vary — the model is told to defer to the board in view.
 */

export type PinKind =
  | "power"
  | "ground"
  | "enable"
  | "input-only"
  | "strapping"
  | "flash"
  | "uart"
  | "gpio";

export type PinInfo = {
  id: string;
  gpio: number | null;
  kind: PinKind;
  aliases: string[];
  summary: string;
  forbiddenAsLedOutput: boolean;
};

const pin = (
  id: string,
  gpio: number | null,
  kind: PinKind,
  aliases: string[],
  summary: string,
  forbiddenAsLedOutput = false,
): PinInfo => ({ id, gpio, kind, aliases, summary, forbiddenAsLedOutput });

export const ESP32_PINS: PinInfo[] = [
  pin("3V3", null, "power", ["3.3v", "3v3"], "Regulated 3.3V output of the onboard regulator. Do not feed 5V into this pin. It cannot power motors."),
  pin("VIN", null, "power", ["5v", "vin", "v5"], "5V input to the regulator. On many DevKit V1 boards this net is also USB 5V when a cable is attached. Never tie VIN to a GPIO or to 3V3."),
  pin("GND", null, "ground", ["gnd", "ground"], "Common ground. All GND pins are the same net and must share ground with the breadboard."),
  pin("EN", null, "enable", ["en", "enable", "rst", "reset"], "Chip enable, pulled high. Pull low to hold the chip in reset. Not a GPIO."),
  pin("GPIO36", 36, "input-only", ["vp", "sensor_vp", "gpio36"], "ADC1_CH0. Input only: no output driver and no internal pull-up or pull-down.", true),
  pin("GPIO39", 39, "input-only", ["vn", "sensor_vn", "gpio39"], "ADC1_CH3. Input only: no output driver and no internal pulls.", true),
  pin("GPIO34", 34, "input-only", ["gpio34", "d34"], "ADC1_CH6. Input only: cannot drive an LED or any output.", true),
  pin("GPIO35", 35, "input-only", ["gpio35", "d35"], "ADC1_CH7. Input only: cannot drive an LED or any output.", true),
  pin("GPIO32", 32, "gpio", ["gpio32", "d32"], "ADC1_CH4, touch. Safe digital pin, and its ADC still works while Wi-Fi is on."),
  pin("GPIO33", 33, "gpio", ["gpio33", "d33"], "ADC1_CH5, touch. Safe digital pin, ADC1 so Wi-Fi does not block analog reads."),
  pin("GPIO25", 25, "gpio", ["gpio25", "d25", "dac1"], "DAC1 and ADC2_CH8. Fine as a digital output. ADC2 reads are unreliable while Wi-Fi is on."),
  pin("GPIO26", 26, "gpio", ["gpio26", "d26", "dac2"], "DAC2 and ADC2_CH9. Fine as a digital output. ADC2 is unreliable with Wi-Fi."),
  pin("GPIO27", 27, "gpio", ["gpio27", "d27"], "ADC2_CH7, touch. Fine as a digital LED pin. Do not trust ADC2 while Wi-Fi is connected."),
  pin("GPIO14", 14, "gpio", ["gpio14", "d14"], "ADC2_CH6. Usable digitally, but it can emit a short pulse at boot."),
  pin("GPIO12", 12, "strapping", ["gpio12", "d12", "mtdi"], "Strapping pin MTDI. MUST be LOW at reset on a 3.3V WROOM module. HIGH selects 1.8V flash voltage and the board will not boot. Avoid it for an LED.", true),
  pin("GPIO13", 13, "gpio", ["gpio13", "d13"], "ADC2_CH4. Acceptable digital output. ADC2 is unreliable while Wi-Fi is on."),
  pin("GPIO23", 23, "gpio", ["gpio23", "d23", "mosi"], "Default VSPI MOSI. Safe general-purpose output."),
  pin("GPIO22", 22, "gpio", ["gpio22", "d22", "scl"], "Default I2C SCL in the Arduino examples. Safe general-purpose output."),
  pin("GPIO1", 1, "uart", ["gpio1", "tx0", "tx", "u0txd"], "UART0 TX, shared with the USB-serial bridge and boot messages. Using it breaks uploads and the serial monitor.", true),
  pin("GPIO3", 3, "uart", ["gpio3", "rx0", "rx", "u0rxd"], "UART0 RX, shared with the USB-serial bridge. Avoid for ordinary wiring.", true),
  pin("GPIO21", 21, "gpio", ["gpio21", "d21", "sda"], "Default I2C SDA in the Arduino examples. Safe general-purpose output."),
  pin("GPIO19", 19, "gpio", ["gpio19", "d19", "miso"], "Default VSPI MISO. Safe general-purpose output."),
  pin("GPIO18", 18, "gpio", ["gpio18", "d18", "sck"], "Default VSPI SCK. Safe general-purpose output."),
  pin("GPIO5", 5, "strapping", ["gpio5", "d5"], "Strapping pin (SDIO timing), default pull-up. It can glitch high at boot. Prefer another pin for an LED."),
  pin("GPIO17", 17, "gpio", ["gpio17", "tx2", "u2txd"], "UART2 TX in Arduino core 2.x. Free on WROOM-32 (no PSRAM). Safe digital output."),
  pin("GPIO16", 16, "gpio", ["gpio16", "rx2", "u2rxd"], "UART2 RX in Arduino core 2.x. Free on WROOM-32. Safe digital output."),
  pin("GPIO4", 4, "gpio", ["gpio4", "d4"], "ADC2_CH0, touch. A good default LED pin: not input-only, not a boot-critical strap like GPIO0/2/12/15."),
  pin("GPIO0", 0, "strapping", ["gpio0", "d0", "boot"], "Strapping pin. Must be HIGH for normal boot. The BOOT button pulls it LOW to enter the serial downloader. Do not strap it low with the LED circuit.", true),
  pin("GPIO2", 2, "strapping", ["gpio2", "d2", "led_builtin"], "Strapping pin. Must be LOW or floating to enter download mode. Often the onboard LED, active HIGH, so the LED is off at boot. Do not pull it HIGH at reset.", true),
  pin("GPIO15", 15, "strapping", ["gpio15", "d15", "mtdo"], "Strapping pin MTDO. Must be HIGH at boot (internal pull-up). Pulling it LOW silences ROM boot logs and can interfere with boot.", true),
  pin("GPIO6", 6, "flash", ["gpio6"], "Connected to the module's SPI flash. Not on the 30-pin header. Do not use.", true),
  pin("GPIO7", 7, "flash", ["gpio7"], "Connected to the module's SPI flash. Do not use.", true),
  pin("GPIO8", 8, "flash", ["gpio8"], "Connected to the module's SPI flash. Do not use.", true),
  pin("GPIO9", 9, "flash", ["gpio9"], "Connected to the module's SPI flash. Do not use.", true),
  pin("GPIO10", 10, "flash", ["gpio10"], "Connected to the module's SPI flash. Do not use.", true),
  pin("GPIO11", 11, "flash", ["gpio11"], "Connected to the module's SPI flash. Do not use.", true),
];

export const PREFERRED_LED_GPIO = [4, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33] as const;

/** USB at the bottom, antenna at the top. Typical DOIT DevKit V1 30-pin. */
export const DEVKIT_V1_LEFT_TOP_TO_BOTTOM = [
  "EN",
  "VP (GPIO36)",
  "VN (GPIO39)",
  "GPIO34",
  "GPIO35",
  "GPIO32",
  "GPIO33",
  "GPIO25",
  "GPIO26",
  "GPIO27",
  "GPIO14",
  "GPIO12",
  "GND",
  "GPIO13",
  "VIN",
] as const;

export const DEVKIT_V1_RIGHT_TOP_TO_BOTTOM = [
  "GPIO23",
  "GPIO22",
  "TX0 (GPIO1)",
  "RX0 (GPIO3)",
  "GPIO21",
  "GPIO19",
  "GPIO18",
  "GPIO5",
  "TX2 (GPIO17)",
  "RX2 (GPIO16)",
  "GPIO4",
  "GPIO0",
  "GPIO2",
  "GPIO15",
  "3V3",
] as const;

export const LED_WIRING_REQUIREMENTS = [
  "Blink circuit, power still disconnected: ESP32 GPIO (high = 3.3V) → 330Ω resistor → LED anode (long lead) → LED cathode (short lead, flat side) → GND.",
  "The resistor may sit on either side of the LED. It must be in series. Never wire an LED from a GPIO or from 3V3 with no resistor.",
  "Do not power the LED from VIN or from 5V. ESP32 GPIO is 3.3V and is not 5V tolerant.",
  "Do not use GPIO34, GPIO35, GPIO36, or GPIO39 as the LED pin. They are input-only.",
  "Do not use GPIO6–GPIO11. They are bonded to SPI flash inside the module.",
  "Avoid strapping pins for the LED: GPIO0, GPIO2, GPIO12, and GPIO15. GPIO12 pulled high at boot selects 1.8V flash and a 3.3V WROOM will not start.",
  "Preferred LED GPIOs: " + PREFERRED_LED_GPIO.map((n) => `GPIO${n}`).join(", ") + ". GPIO4 is the default suggestion.",
  "ADC2 pins (GPIO0, 2, 4, 12, 13, 14, 15, 25, 26, 27) are a poor choice for analog reads while Wi-Fi is on. Digital output on the preferred pins above is fine.",
  "A 330Ω resistor with a red LED (Vf about 2V) from 3.3V gives roughly 4mA, which is a comfortable GPIO current.",
].join(" ");

const BY_GPIO = new Map<number, PinInfo>();
for (const info of ESP32_PINS) {
  if (info.gpio !== null) BY_GPIO.set(info.gpio, info);
}

export function pinByGpio(gpio: number): PinInfo | undefined {
  return BY_GPIO.get(gpio);
}

export function lookupPins(text: string): PinInfo[] {
  const found = new Map<string, PinInfo>();
  const lower = text.toLowerCase();
  const re = /\bgpio\s*[-_ ]?(\d{1,2})\b|\bd(\d{1,2})\b|\b(vp|vn|3v3|3\.3v|vin|gnd|tx0|rx0|tx2|rx2)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(lower))) {
    if (match[1] || match[2]) {
      const n = Number(match[1] ?? match[2]);
      const info = BY_GPIO.get(n);
      if (info) found.set(info.id, info);
      continue;
    }
    const alias = match[3];
    if (!alias) continue;
    const info = ESP32_PINS.find((p) => p.aliases.includes(alias) || p.id.toLowerCase() === alias);
    if (info) found.set(info.id, info);
  }
  return [...found.values()];
}

export function pinoutPromptBlock(): string {
  const lines = ESP32_PINS.map((p) => `- ${p.id}: ${p.summary}`);
  return [
    "Verified reference: ESP32 DevKit V1 board built around the ESP32-WROOM-32 module.",
    "This is curated pin data, not a guess. If the silkscreen in the image disagrees, say so and ask the user to confirm the label. Clones move the onboard LED.",
    "Logic level is 3.3V. GPIOs are not 5V tolerant.",
    "Typical 30-pin header, USB connector at the bottom, antenna at the top.",
    "Left header, top to bottom: " + DEVKIT_V1_LEFT_TOP_TO_BOTTOM.join(", ") + ".",
    "Right header, top to bottom: " + DEVKIT_V1_RIGHT_TOP_TO_BOTTOM.join(", ") + ".",
    "Pin notes:",
    ...lines,
    "LED wiring requirements: " + LED_WIRING_REQUIREMENTS,
  ].join("\n");
}

function mentionsPin(info: PinInfo): RegExp {
  const parts = [info.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")];
  if (info.gpio !== null) parts.push(`gpio\\s*${info.gpio}`);
  for (const alias of info.aliases) {
    if (/^gpio\d+$/i.test(alias) || /^\d+$/.test(alias)) continue;
    parts.push(alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  }
  return new RegExp(`\\b(?:${parts.join("|")})\\b`, "i");
}

function sentenceRecommendsPin(instruction: string, info: PinInfo): boolean {
  const mention = mentionsPin(info);
  const sentences = instruction.split(/(?<=[.!?])\s+/);
  return sentences.some((sentence) => {
    const match = mention.exec(sentence);
    mention.lastIndex = 0;
    if (!match || match.index === undefined) return false;
    const around = sentence.slice(Math.max(0, match.index - 32), match.index + match[0].length + 48);
    if (/\b(do not|don't|dont|never|avoid|cannot|can't|input-only|input only)\b/i.test(around)) {
      return false;
    }
    return /\b(use|wire|connect|drive|blink|attach|tie|put|place|signal|output|anode)\b/i.test(sentence);
  });
}

export function reviewInstructionAgainstPinout(instruction: string): {
  instruction: string;
  notes: string[];
} {
  const notes: string[] = [];
  for (const info of lookupPins(instruction)) {
    if (!info.forbiddenAsLedOutput) continue;
    if (!sentenceRecommendsPin(instruction, info)) continue;
    if (info.kind === "input-only") {
      notes.push(`${info.id} is input-only and cannot drive an LED.`);
    } else if (info.kind === "flash") {
      notes.push(`${info.id} is bonded to the SPI flash. Do not wire it.`);
    } else if (info.id === "GPIO12") {
      notes.push("GPIO12 must stay LOW at boot on a 3.3V ESP32-WROOM-32 or the module will not start.");
    } else if (info.kind === "strapping") {
      notes.push(`${info.id} is a strapping pin and a poor choice for this LED.`);
    } else if (info.kind === "uart") {
      notes.push(`${info.id} is the USB programming serial port. Leave it free.`);
    } else if (info.kind === "power") {
      notes.push(`${info.id} is a power pin, not an LED signal.`);
    }
  }
  if (!notes.length) return { instruction, notes };
  return {
    instruction: `${notes.join(" ")} Move the LED signal to GPIO4 through a 330 ohm series resistor, cathode toward GND, and leave power disconnected.`,
    notes,
  };
}
