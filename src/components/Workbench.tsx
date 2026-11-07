"use client";

import { NobiMark } from "@/components/NobiMark";
import { GrokSpeaker } from "@/lib/grok-voice";
import { DIFF_HEIGHT, DIFF_WIDTH, compareFrames, grayFromImageData, shouldSendFrame } from "@/lib/frame-diff";
import { CONFIRM_PHRASES, derivePowerGate } from "@/lib/power-gate";
import { cancelBrowserSpeech, speechRecognitionCtor, speakWithBrowser, unlockSpeech, type SpeechRec } from "@/lib/speech";
import {
  DEMO_GOAL,
  SAMPLE_INTERVAL_MS,
  emptySession,
  isPowerGateOpen,
  type Annotation,
  type CompanionState,
  type HistoryTurn,
  type ObserveSuccess,
  type SceneChange,
  type SessionState,
  type TranscriptEntry,
} from "@/lib/types";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type VoiceEngine = "browser" | "grok";
type DemoVariant = "correct" | "reversed";

type Health = {
  configured: boolean;
  message: string;
  visionModel: string;
  voiceModel: string;
};

const DEMO_SRC: Record<DemoVariant, string> = {
  correct: "/demo/esp32-led-correct.svg",
  reversed: "/demo/esp32-led-reversed.svg",
};

function uid(): string {
  return crypto.randomUUID();
}

export function Workbench() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const demoRef = useRef<HTMLImageElement>(null);
  const shotRef = useRef<HTMLCanvasElement>(null);
  const diffRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const speakerRef = useRef<GrokSpeaker | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const grayRef = useRef<Uint8Array | null>(null);
  const genRef = useRef(0);
  const inFlightRef = useRef(false);
  const lastCaptureRef = useRef(0);
  const dirtyRef = useRef(false);
  const sampleLock = useRef(false);
  const wasChangeRef = useRef(false);
  const lastLookRef = useRef(0);
  const questionRef = useRef<string | null>(null);
  const forceRef = useRef(false);
  const sessionRef = useRef<SessionState>(emptySession());
  const historyRef = useRef<HistoryTurn[]>([]);
  const observingRef = useRef(false);
  const demoModeRef = useRef(false);
  const mutedRef = useRef(false);
  const engineRef = useRef<VoiceEngine>("browser");
  const configuredRef = useRef(false);
  const sessionIdRef = useRef("");
  const askRef = useRef<(text: string) => void>(() => {});

  const [session, setSession] = useState<SessionState>(emptySession());
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [observing, setObserving] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [variant, setVariant] = useState<DemoVariant>("correct");
  const [muted, setMuted] = useState(false);
  const [engine, setEngine] = useState<VoiceEngine>("browser");
  const [companion, setCompanion] = useState<CompanionState>("listening");
  const [health, setHealth] = useState<Health | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [question, setQuestion] = useState("");
  const [goal, setGoal] = useState("");
  const [scene, setScene] = useState<SceneChange>({ detected: false, score: 0, changedPixels: 0 });
  const [skips, setSkips] = useState(0);
  const [looks, setLooks] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    observingRef.current = observing;
  }, [observing]);
  useEffect(() => {
    demoModeRef.current = demoMode;
  }, [demoMode]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  useEffect(() => {
    sessionIdRef.current = crypto.randomUUID();
    let cancelled = false;
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: Health) => {
        if (cancelled) return;
        setHealth(data);
        configuredRef.current = data.configured;
        if (!data.configured) setBanner(data.message);
      })
      .catch(() => {
        if (!cancelled) setBanner("The server health check failed. Refresh and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pushTranscript = useCallback((role: TranscriptEntry["role"], text: string) => {
    const entry = { id: uid(), role, text, at: Date.now() };
    setTranscript((current) => [...current.slice(-40), entry]);
    if (role === "user" || role === "assistant") {
      historyRef.current = [...historyRef.current, { role, text }].slice(-12);
    }
  }, []);

  const speak = useCallback((text: string | null) => {
    if (!text || mutedRef.current) return;
    if (engineRef.current === "grok" && speakerRef.current?.speak(text)) {
      setVoiceNote("Speaking with Grok Voice.");
      return;
    }
    const spoke = speakWithBrowser(text);
    setVoiceNote(spoke ? "Speaking with browser speech." : "This browser cannot play speech. Read the instruction on screen.");
  }, []);

  const applySession = useCallback((next: SessionState) => {
    sessionRef.current = next;
    setSession(next);
    setAnnotations(next.annotations);
    if (next.projectGoal) setGoal(next.projectGoal);
  }, []);

  const capture = useCallback((): { dataUrl: string; gray: Uint8Array } | null => {
    const shot = shotRef.current;
    const diff = diffRef.current;
    const shotCtx = shot?.getContext("2d", { willReadFrequently: true });
    const diffCtx = diff?.getContext("2d", { willReadFrequently: true });
    if (!shot || !diff || !shotCtx || !diffCtx) return null;

    let source: CanvasImageSource | null = null;
    let width = 0;
    let height = 0;
    if (demoModeRef.current) {
      const image = demoRef.current;
      if (!image || !image.complete || !image.naturalWidth) return null;
      source = image;
      width = image.naturalWidth;
      height = image.naturalHeight;
    } else {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return null;
      source = video;
      width = video.videoWidth;
      height = video.videoHeight;
    }

    const scale = Math.min(1, 768 / width);
    shot.width = Math.max(1, Math.round(width * scale));
    shot.height = Math.max(1, Math.round(height * scale));
    shotCtx.drawImage(source, 0, 0, shot.width, shot.height);
    diff.width = DIFF_WIDTH;
    diff.height = DIFF_HEIGHT;
    diffCtx.imageSmoothingEnabled = true;
    diffCtx.drawImage(source, 0, 0, DIFF_WIDTH, DIFF_HEIGHT);
    const pixels = diffCtx.getImageData(0, 0, DIFF_WIDTH, DIFF_HEIGHT);
    return {
      dataUrl: shot.toDataURL("image/jpeg", 0.62),
      gray: grayFromImageData(pixels.data, DIFF_WIDTH, DIFF_HEIGHT),
    };
  }, []);

  const runAnalysis = useCallback(
    async (frame: { dataUrl: string; gray: Uint8Array }, change: SceneChange, questionText: string | null) => {
      const generation = ++genRef.current;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      inFlightRef.current = true;
      setCompanion("thinking");
      try {
        const response = await fetch("/api/observe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            imageDataUrl: frame.dataUrl,
            session: sessionRef.current,
            history: historyRef.current,
            userQuestion: questionText,
            change,
            source: demoModeRef.current ? "demo" : "camera",
            sessionId: sessionIdRef.current,
          }),
        });
        const data = (await response.json()) as ObserveSuccess | { ok: false; error?: string; missingKey?: boolean };
        if (generation !== genRef.current) return;
        if (!data.ok) {
          if (data.missingKey) configuredRef.current = false;
          setBanner(data.error ?? "Vision analysis failed.");
          pushTranscript("system", data.error ?? "Vision analysis failed.");
          setCompanion(observingRef.current ? "listening" : "guiding");
          return;
        }
        applySession(data.session);
        pushTranscript("assistant", data.reply);
        setCompanion(data.companion);
        speak(data.speak);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (generation !== genRef.current) return;
        setBanner("The vision request was interrupted. Nobi will look again if the scene changes.");
        setCompanion("listening");
      } finally {
        if (generation === genRef.current) inFlightRef.current = false;
      }
    },
    [applySession, pushTranscript, speak],
  );

  const sample = useCallback(async () => {
    if (!observingRef.current) return;
    if (sampleLock.current) return;
    const forced = forceRef.current;
    const now = Date.now();
    if (!forced && now - lastCaptureRef.current < SAMPLE_INTERVAL_MS) return;
    if (inFlightRef.current && !forced) {
      dirtyRef.current = true;
      return;
    }

    sampleLock.current = true;
    try {
      const frame = capture();
      if (!frame) {
        if (questionRef.current && !configuredRef.current) {
          pushTranscript("system", "That question needs the vision model. Add XAI_API_KEY to .env.local and restart.");
          questionRef.current = null;
          forceRef.current = false;
        }
        return;
      }
      lastCaptureRef.current = now;
      forceRef.current = false;

      const previous = grayRef.current;
      grayRef.current = frame.gray;
      const comparison = previous
        ? compareFrames(previous, frame.gray)
        : { score: 0, changedPixels: 0, similar: false };
      const change: SceneChange = {
        detected: Boolean(previous) && !comparison.similar,
        score: comparison.score,
        changedPixels: comparison.changedPixels,
      };
      setScene(change);
      const liveCamera = !demoModeRef.current;
      if (!previous && liveCamera) {
        const note = "First camera frame is in. Nobi is checking what the lens can see.";
        setSession((current) => {
          const next = { ...current, visibleChanges: [note] };
          sessionRef.current = next;
          return next;
        });
      } else if (change.detected && !wasChangeRef.current) {
        const note = liveCamera
          ? `The camera saw a change (delta ${change.score}). This does not identify which wire moved.`
          : `The diagram changed (delta ${change.score}).`;
        setSession((current) => {
          const next = { ...current, visibleChanges: [note] };
          sessionRef.current = next;
          return next;
        });
        if (!configuredRef.current) {
          pushTranscript(
            "system",
            `Scene change detected ${liveCamera ? "from the camera" : "locally"} (delta ${change.score}). Vision answers stay off until XAI_API_KEY is set.`,
          );
        }
      }
      wasChangeRef.current = change.detected;

      const questionText = questionRef.current;
      questionRef.current = null;
      const send = shouldSendFrame({
        similar: comparison.similar,
        hasQuestion: Boolean(questionText),
        dirty: dirtyRef.current,
        liveCamera,
        msSinceLastLook: now - lastLookRef.current,
      });
      if (!send) {
        setSkips((count) => count + 1);
        return;
      }
      dirtyRef.current = false;
      lastLookRef.current = now;
      if (liveCamera) setLooks((count) => count + 1);
      if (!configuredRef.current) {
        if (questionText) {
          pushTranscript("system", "That question needs the vision model. Add XAI_API_KEY to .env.local and restart.");
        }
        setCompanion("listening");
        return;
      }
      await runAnalysis(frame, change, questionText);
    } finally {
      sampleLock.current = false;
    }
  }, [capture, pushTranscript, runAnalysis]);

  useEffect(() => {
    if (!observing) return;
    const timer = window.setInterval(() => {
      void sample();
    }, 400);
    return () => window.clearInterval(timer);
  }, [observing, sample]);

  useEffect(() => {
    if (!observing) return;
    let lock: WakeLockSentinel | null = null;
    void navigator.wakeLock?.request("screen").then((sentinel) => {
      lock = sentinel;
    }).catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, [observing]);

  const ask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      pushTranscript("user", trimmed);
      const gate = derivePowerGate(historyRef.current.filter((turn) => turn.role === "user").map((turn) => turn.text));
      setSession((current) => {
        const next = { ...current, powerGate: gate };
        sessionRef.current = next;
        return next;
      });
      questionRef.current = trimmed;
      forceRef.current = true;
      lastCaptureRef.current = 0;
      if (observingRef.current) void sample();
      else setBanner("Start observing so Nobi can look at the frame while answering. Your confirmation is already saved in the session.");
    },
    [pushTranscript, sample],
  );

  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  useEffect(() => {
    if (!observing || muted || engine !== "browser") {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setMicOn(false);
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) {
      setMicOn(false);
      setVoiceNote("This browser has no SpeechRecognition. Type questions below. Answers still use speech synthesis when it exists.");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let finalText = "";
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i]?.isFinal) finalText += piece;
        else live += piece;
      }
      setInterim(live);
      if (finalText.trim()) {
        setInterim("");
        askRef.current(finalText.trim());
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed") {
        setVoiceNote("Microphone permission was blocked. Type a question instead.");
        setMicOn(false);
      }
    };
    let active = true;
    rec.onend = () => {
      if (!active) return;
      try {
        rec.start();
      } catch {
        setMicOn(false);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setMicOn(true);
      setVoiceNote("Listening with the browser microphone.");
    } catch {
      setVoiceNote("The microphone did not start. Type a question instead.");
    }
    return () => {
      active = false;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [observing, muted, engine]);

  useEffect(() => {
    if (!observing || engine !== "grok") {
      speakerRef.current?.stop();
      speakerRef.current = null;
      return;
    }
    const speaker = new GrokSpeaker();
    speakerRef.current = speaker;
    let cancelled = false;
    setVoiceNote("Connecting Grok Voice…");
    speaker
      .ensure()
      .then(() => {
        if (!cancelled) setVoiceNote("Grok Voice is ready. Browser speech remains the fallback.");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Grok Voice failed.";
        setVoiceNote(`${message} Browser speech will speak the replies.`);
      });
    return () => {
      cancelled = true;
      speaker.stop();
    };
  }, [observing, engine]);

  async function startObserving() {
    unlockSpeech();
    setCameraNote(null);
    grayRef.current = null;
    lastCaptureRef.current = 0;
    lastLookRef.current = 0;
    setSkips(0);
    setLooks(0);
    if (!demoMode) {
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          setCameraNote("The rear camera was unavailable, so the default camera is showing.");
        }
        const facing = stream.getVideoTracks()[0]?.getSettings().facingMode;
        if (facing && facing !== "environment") {
          setCameraNote("This device opened a user-facing camera. On a phone, allow the rear camera for the bench.");
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setCameraNote("Camera permission was blocked. Switch to demo mode to run the same loop on the ESP32 diagram.");
        return;
      }
    }
    setObserving(true);
    setCompanion("listening");
  }

  function stopObserving() {
    setObserving(false);
    abortRef.current?.abort();
    inFlightRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    grayRef.current = null;
    lastLookRef.current = 0;
    wasChangeRef.current = false;
    if (videoRef.current) videoRef.current.srcObject = null;
    cancelBrowserSpeech();
    speakerRef.current?.stop();
    recognitionRef.current?.abort();
    setMicOn(false);
    setInterim("");
    setCompanion("listening");
  }

  function toggleMute() {
    setMuted((current) => {
      const next = !current;
      if (next) {
        cancelBrowserSpeech();
        recognitionRef.current?.abort();
      }
      return next;
    });
  }

  function onGoal(event: FormEvent) {
    event.preventDefault();
    const nextGoal = goal.trim();
    setSession((current) => {
      const next = { ...current, projectGoal: nextGoal || null };
      sessionRef.current = next;
      return next;
    });
  }

  function confirm(key: keyof typeof CONFIRM_PHRASES) {
    ask(CONFIRM_PHRASES[key]);
  }

  function switchDemo(next: boolean) {
    if (observing) stopObserving();
    setDemoMode(next);
    demoModeRef.current = next;
    if (next && !sessionRef.current.projectGoal) {
      setGoal(DEMO_GOAL);
      setSession((current) => {
        const updated = { ...current, projectGoal: DEMO_GOAL };
        sessionRef.current = updated;
        return updated;
      });
    }
  }

  function switchVariant(next: DemoVariant) {
    setVariant(next);
    lastCaptureRef.current = 0;
    forceRef.current = observingRef.current;
  }

  const gate = session.powerGate;
  const gateOpen = isPowerGateOpen(gate);

  return (
    <main className="shell">
      <section className="stage-wrap">
        <header className="topbar">
          <NobiMark state={companion} />
          <div className="top-actions">
            <button type="button" className={demoMode ? "chip chip-on" : "chip"} onClick={() => switchDemo(!demoMode)}>
              {demoMode ? "Demo mode" : "Live camera"}
            </button>
            <label className="chip">
              Voice
              <select value={engine} onChange={(event) => setEngine(event.target.value as VoiceEngine)}>
                <option value="browser">Browser</option>
                <option value="grok">Grok Voice</option>
              </select>
            </label>
          </div>
        </header>

        <div className={observing && !demoMode ? "stage stage-live" : "stage"}>
          <video
            ref={videoRef}
            className={demoMode ? "hidden" : "preview preview-live"}
            autoPlay
            playsInline
            muted
            aria-label="Rear camera preview"
          />
          {/* The demo diagram is drawn to a canvas and sent through the same observe path as the camera. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={demoRef}
            src={DEMO_SRC[variant]}
            alt="ESP32 DevKit V1, LED, and resistor wiring diagram"
            className={demoMode ? "preview demo-still" : "hidden"}
            onLoad={() => {
              lastCaptureRef.current = 0;
              forceRef.current = observingRef.current;
            }}
          />
          {observing && !demoMode && <span className="live-badge">Live camera</span>}
          {!demoMode && !observing && (
            <div className="stage-empty">
              <p>Point the rear camera at the board and start observing. Nobi keeps that preview up and checks a frame every few seconds, including when the bench is sitting still.</p>
            </div>
          )}
          <div className="overlay" aria-hidden="true">
            {annotations.map((mark) => (
              <span
                key={`${mark.label}-${mark.x}-${mark.y}`}
                className={mark.kind === "caution" ? "mark mark-caution" : "mark"}
                style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
              >
                {mark.label}
              </span>
            ))}
          </div>
          <p className="instruction" aria-live="polite">
            {session.lastInstruction ?? (observing ? "Watching the bench. Tell Nobi what you are building." : "Start observing to hear the first step.")}
          </p>
        </div>

        <div className="controls">
          <button type="button" className="btn btn-primary" onClick={() => void startObserving()} disabled={observing}>
            Start Observing
          </button>
          <button type="button" className={muted ? "btn btn-on" : "btn"} onClick={toggleMute} aria-pressed={muted}>
            {muted ? "Muted" : "Mute"}
          </button>
          <button type="button" className="btn" onClick={stopObserving} disabled={!observing}>
            Stop
          </button>
        </div>
        <p className="status-line">
          {observing && !demoMode ? "Checking the camera every 2.5s" : observing ? "Sampling the diagram every 2.5s" : "Idle"}
          {observing && !demoMode ? ` · ${looks} look${looks === 1 ? "" : "s"}` : ""}
          {micOn ? " · mic open" : ""}
          {scene.detected ? ` · scene change ${scene.score}` : ` · scene delta ${scene.score}`}
          {skips ? ` · skipped ${skips} unchanged` : ""}
          {health?.visionModel ? ` · ${health.visionModel}` : ""}
        </p>
        {interim && <p className="interim">Hearing: {interim}</p>}
        {cameraNote && <p className="note">{cameraNote}</p>}
        {voiceNote && <p className="note">{voiceNote}</p>}
        {banner && <p className="banner">{banner}</p>}

        {demoMode && (
          <div className="demo-switch">
            <button type="button" className={variant === "correct" ? "chip chip-on" : "chip"} onClick={() => switchVariant("correct")}>
              GPIO4 diagram
            </button>
            <button type="button" className={variant === "reversed" ? "chip chip-on" : "chip"} onClick={() => switchVariant("reversed")}>
              Move the wire
            </button>
          </div>
        )}

        <form className="ask" onSubmit={(event) => { event.preventDefault(); ask(question); setQuestion(""); }}>
          <label htmlFor="ask">Ask Nobi</label>
          <input
            id="ask"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Type a question if the mic is unavailable"
            autoComplete="off"
          />
          <button type="submit" className="btn">
            Send
          </button>
        </form>
      </section>

      <aside className="panel">
        <form onSubmit={onGoal} className="goal">
          <label htmlFor="goal">Project goal</label>
          <textarea id="goal" value={goal} rows={3} onChange={(event) => setGoal(event.target.value)} placeholder="Blink an LED on GPIO4" />
          <button type="submit" className="btn btn-small">
            Save goal
          </button>
        </form>

        <section>
          <h2>Session</h2>
          <dl>
            <div>
              <dt>Board</dt>
              <dd>{session.board ?? "Not identified yet"}</dd>
            </div>
            <div>
              <dt>Components</dt>
              <dd>{session.components.length ? session.components.join(", ") : "None yet"}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{session.referencePinouts[0] ?? "ESP32 DevKit V1 pinout loads with the first look"}</dd>
            </div>
            <div>
              <dt>Visible change</dt>
              <dd>{session.visibleChanges[0] ?? "Waiting for two different frames"}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2>Power gate</h2>
          <p className="fine">{gateOpen ? "Power may be discussed. 5V still never goes on a GPIO or the 3V3 pin." : "Power stays disconnected until every item is confirmed by you. The camera cannot check these."}</p>
          <ul className="checks">
            <Check label="Voltage 3.3V" done={gate.voltageVerified} onClick={() => confirm("voltage")} />
            <Check label="Grounding" done={gate.groundingVerified} onClick={() => confirm("grounding")} />
            <Check label="Pinout" done={gate.pinoutVerified} onClick={() => confirm("pinout")} />
            <Check label="Polarity" done={gate.polarityVerified} onClick={() => confirm("polarity")} />
          </ul>
        </section>

        <section>
          <h2>Needs confirmation</h2>
          {session.uncertainties.length === 0 ? (
            <p className="fine">Nothing flagged yet.</p>
          ) : (
            <ul className="plain">
              {session.uncertainties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="transcript">
          <h2>Transcript</h2>
          <ol>
            {transcript.length === 0 && <li className="fine">Nobi’s replies and your questions show up here. Frames are not kept.</li>}
            {transcript.map((entry) => (
              <li key={entry.id} className={`line line-${entry.role}`}>
                <span>{entry.role}</span>
                {entry.text}
              </li>
            ))}
          </ol>
        </section>
      </aside>
      <canvas ref={shotRef} className="hidden" />
      <canvas ref={diffRef} className="hidden" />
    </main>
  );
}

function Check({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" className={done ? "check check-done" : "check"} onClick={onClick} aria-pressed={done}>
        <span>{done ? "Confirmed" : "Confirm"}</span>
        {label}
      </button>
    </li>
  );
}
