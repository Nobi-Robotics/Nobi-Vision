# Nobi Vision

Nobi Vision is a voice-first electronics copilot for Nobi Robotics. Mount a phone above the workbench, leave the rear camera running, and talk. Nobi samples the frame every few seconds, compares it with the ESP32 DevKit V1 pin reference, and speaks one next step.

It is a coaching aid. A camera frame is not a measurement. Nobi will not tell you a circuit is electrically safe, and it will not tell you to connect power until you have confirmed voltage, grounding, pinout, and polarity yourself.

## Architecture

Two loops stay separate on purpose.

**Observation loop (this app, low latency).** With **Start Observing** on the live camera, the rear preview stays on and a JPEG is taken about every 2.5 seconds. A downscaled grayscale diff runs locally. Unchanged frames are not uploaded on every tick, but a steady camera shot is checked again about every 6 seconds so a board that is sitting still is still inspected. A visible change, or a question, is sent immediately. Demo mode uses the same loop and skips unchanged diagram frames until the drawing actually changes. One request goes to `POST /api/observe`. The server calls the vision model, merges the reply into the session, and applies the power gate. At most one analysis is in flight; a newer question aborts the previous request with `AbortController`.

**Anything slower stays out of that loop.** Datasheet crawls, firmware generation, flashing, and multi-step automation do not belong in the 3-second sampler. Those jobs should be a separate queue that reads the compact session snapshot (board, components, goal, pin reference, last instruction, changes, uncertainties, power gate). The sampler never waits on them, and it never stores the image.

Session state kept in memory for the page:

- identified board and components
- current project goal
- reference pinout in use
- last instruction
- visible changes between observations
- uncertainties that need confirmation
- power-gate checklist (server-derived from your words, not from the picture)

Frames are not written to disk, localStorage, or server logs. Chat Completions is stateless, so the image is not kept as xAI conversation history either. The browser drops the JPEG after the request.

## xAI API

Docs checked against [docs.x.ai](https://docs.x.ai) (models, legacy chat completions, image understanding, speech-to-speech, ephemeral tokens).

| Role | Id | Endpoint |
| --- | --- | --- |
| Vision | `grok-4.7` | `POST https://api.x.ai/v1/chat/completions` |
| Voice | `grok-voice-latest` | `wss://api.x.ai/v1/realtime?model=grok-voice-latest` |

`grok-4.7` takes text and image input and returns text. Override it with `XAI_VISION_MODEL` only if the replacement is also vision-capable.

Images are sent as OpenAI-compatible content parts:

```json
{
  "type": "image_url",
  "image_url": {
    "url": "data:image/jpeg;base64,...",
    "detail": "low"
  }
}
```

`detail` is `high` when you ask a question and `low` on a routine sample. The call also sends `response_format: { "type": "json_object" }`, `reasoning_effort` (`low` by default), and the header `x-grok-conv-id` set to the in-memory session id so the stable system prompt can cache. If the account rejects `response_format` or `reasoning_effort`, the server retries once without the rejected field.

`grok-4.7` always reasons. The API default effort is `high`, which is too slow for a bench loop, so Nobi sets `low` unless `XAI_REASONING_EFFORT` is `medium`, `high`, or `xhigh`. Reasoning cannot be turned off on this model.

Chat Completions is the legacy endpoint (new features land on the Responses API first). It is the right one here: it accepts `image_url` parts, and it does not store the request the way Responses does by default. The Responses API uses `input_image` and stores responses for 30 days unless `store` is false.

### Grok Voice

`grok-voice-latest` currently points at `grok-voice-3.0`. Pin `XAI_VOICE_MODEL=grok-voice-3.0` if you want that version fixed. `grok-voice-2.0` is deprecated.

The browser never sees `XAI_API_KEY`. `POST /api/voice/token` calls `POST https://api.x.ai/v1/realtime/client_secrets` with `{ "expires_after": { "seconds": 300 } }` and returns the ephemeral `value`. The page connects with the subprotocol `xai-client-secret.<token>`.

Nobi uses Grok Voice as a mouth, not a second electrician. Session voice is `eve`. Spoken lines are the vision reply after the power-gate filter, sent as a `force_message` item so the voice model does not invent wiring advice. Playback is 24 kHz PCM from `response.output_audio.delta`. If the socket fails, the same text is spoken with `speechSynthesis`.

Microphone input uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`). Typing is always available when the mic is missing or blocked. That browser path is the default and does not depend on Grok Voice.

## Environment

Copy the example and add a key from the [xAI console](https://console.x.ai/).

```bash
cp .env.example .env.local
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | empty | Server-only. Required for vision and for Grok Voice. |
| `XAI_VISION_MODEL` | `grok-4.7` | Vision model id. |
| `XAI_REASONING_EFFORT` | `low` | `low`, `medium`, `high`, or `xhigh`. |
| `XAI_VOICE_MODEL` | `grok-voice-latest` | Realtime voice model id. |

Do not prefix these with `NEXT_PUBLIC_`. A missing key does not crash the page: the camera or demo diagram, local scene diff, transcript, and checklist still run, and the banner explains that vision answers are off.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `npm run dev` is HTTP, which is fine for demo mode on the same computer. Phone cameras and microphones need a secure context.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Phone, HTTPS, and tunnels

```bash
npm run dev:https
# or
bash scripts/dev-https.sh
```

That runs `next dev --experimental-https --hostname 0.0.0.0 --port 3000`. On this machine open `https://localhost:3000`. On a phone on the same Wi-Fi, open `https://<lan-ip>:3000`. The certificate is self-signed, so the phone must accept the warning before `getUserMedia` will run.

Trusted cert with [mkcert](https://github.com/FiloSottile/mkcert), then point Next at the files:

```bash
mkcert -install
mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost 192.168.1.20
npx next dev --experimental-https \
  --experimental-https-key certs/key.pem \
  --experimental-https-cert certs/cert.pem \
  --hostname 0.0.0.0 --port 3000
```

Installing the mkcert root on a phone is awkward. A tunnel with a public certificate is the easier path:

```bash
# terminal 1
npm run dev:https
# terminal 2
cloudflared tunnel --url https://localhost:3000
# or
ngrok http https://localhost:3000
```

Open the `https://` URL on the phone, allow the rear camera and the microphone, and tap **Start Observing**. The screen stays awake while observing when the browser allows a wake lock.

### Vercel

The app is a stock Next.js App Router project. Set `XAI_API_KEY` (and any model overrides) in the project environment. `POST /api/observe` sets `maxDuration = 60` so a reasoning reply can finish. Do not log request bodies; they contain frames.

## Demo mode

**Live camera** needs a phone or a webcam. **Demo mode** swaps the camera for a drawing in `public/demo/` and sends that drawing through the same capture, diff, and `/api/observe` path.

- `public/demo/esp32-led-correct.svg` — ESP32 DevKit V1, GPIO4, 330Ω, LED anode toward the pin, cathode toward GND. USB is drawn disconnected.
- `public/demo/esp32-led-reversed.svg` — the wire leaves GPIO12 (a strapping pin) and the LED flat side faces the pin.

Tap **Move the wire** while observing. The local diff should report a scene change even with no API key. With a key, Nobi should flag GPIO12 and the reversed LED, and it should refuse to connect USB until the four checks are confirmed. Say “confirm voltage”, or tap each check. The phrases are matched on the server; the picture cannot tick the boxes.

## ESP32 reference

The curated card is `src/lib/esp32-pinout.ts` and is inserted into every vision prompt. It covers the ESP32-WROOM-32 on a typical 30-pin DevKit V1:

- 3V3, VIN, GND, EN
- strapping pins GPIO0, GPIO2, GPIO5, GPIO12, GPIO15, including the GPIO12 flash-voltage trap
- input-only GPIO34, GPIO35, GPIO36 (VP), GPIO39 (VN)
- flash pins GPIO6–GPIO11, which must not be wired
- ADC2 (GPIO0, 2, 4, 12–15, 25–27) being unreliable while Wi-Fi is on
- 3.3V logic, not 5V tolerant
- a 330Ω series LED on a normal pin such as GPIO4

Header order in the prompt matches the common DOIT board with USB at the bottom. Clones differ. If the silkscreen disagrees, Nobi should say so.

Server-side checks do not trust the model:

- instructions that tell you to drive an input-only, flash, UART0, or critical strapping pin are rewritten toward GPIO4
- instructions that connect power while any checklist item is open are replaced with the missing confirmations
- 5V onto a GPIO or the 3V3 pin, and an LED with no resistor, are rejected even after the gate is open
- claims that the camera has certified the circuit are stripped

## Safety

- One instruction at a time. Follow-up questions go through the same vision call with the latest frame.
- Possible mistakes are flagged as things to confirm, not as a passed inspection.
- Do not connect USB, VIN, or a battery because the model sounds confident. Confirm voltage, grounding, pinout, and polarity, then decide.
- Nobi is not a substitute for the module datasheet, a meter, or basic lab practice.

## Limitations

- Thin jumper wires can fall below the downscaled diff. The demo diagrams use thick strokes so a swap is visible. Live benches with busy backgrounds will retrigger more often.
- Reflections, occlusion, and identical wire colors fool the model. `needsCloserView` asks you to move the phone instead of guessing.
- Web Speech recognition quality depends on the browser. Chrome and Safari are the useful ones. Firefox needs the typed box.
- Grok Voice adds a second network hop and can fail independently. Browser `speechSynthesis` covers that.
- `grok-4.7` still spends some tokens reasoning at effort `low`, so a look is often several seconds, not instantaneous. The loop does not stack those calls.
- The pin card is for the ESP32 DevKit V1 / WROOM-32. Other boards are identified only as “not this reference.”
- This build does not flash firmware, store sessions, or retain images.
