import type { CompanionState } from "@/lib/types";

const LABEL: Record<CompanionState, string> = {
  listening: "Listening",
  thinking: "Thinking",
  guiding: "Guiding",
  needs_closer_view: "Needs closer view",
};

export function NobiMark({ state }: { state: CompanionState }) {
  return (
    <div className={`nobi nobi-${state}`} aria-live="polite">
      <svg viewBox="0 0 64 64" className="nobi-svg" aria-hidden="true">
        <circle className="nobi-ring" cx="32" cy="34" r="22" />
        <circle className="nobi-head" cx="32" cy="34" r="16" />
        <path className="nobi-antenna" d="M32 12v8" />
        <circle className="nobi-tip" cx="32" cy="10" r="2.4" />
        <circle className="nobi-eye" cx="26" cy="33" r="2.2" />
        <circle className="nobi-eye" cx="38" cy="33" r="2.2" />
        <path className="nobi-mouth" d="M26 40h12" />
      </svg>
      <div>
        <p className="nobi-name">Nobi</p>
        <p className="nobi-state">{LABEL[state]}</p>
      </div>
    </div>
  );
}
