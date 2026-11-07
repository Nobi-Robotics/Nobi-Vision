type SpeechResult = { isFinal: boolean; 0: { transcript: string } };

export type SpeechRecEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
};

export type SpeechRecErrorEvent = { error: string };

export type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecEvent) => void) | null;
  onerror: ((event: SpeechRecErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRec;
  webkitSpeechRecognition?: new () => SpeechRec;
};

export function speechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function unlockSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const primer = new SpeechSynthesisUtterance(" ");
  primer.volume = 0;
  window.speechSynthesis.speak(primer);
}

export function speakWithBrowser(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((item) => /en[-_]US/i.test(item.lang) && /samantha|google|natural|aria/i.test(item.name)) ??
    voices.find((item) => item.lang.toLowerCase().startsWith("en"));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function cancelBrowserSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}
