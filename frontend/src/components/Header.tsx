import { clock } from "@/lib/format";

export type SaveState = "saved" | "saving" | "error";

export type Hud = {
  remainingMs: number | null;
  answered: number;
  total: number;
  onSectionB: boolean;
  save: SaveState;
  onRetry: () => void;
};

export function Logo({ size }: { size: "big" | "small" }) {
  return (
    <span className={`tile ${size}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Pillar 5 Above Average" />
    </span>
  );
}

export function Header({ hud }: { hud?: Hud }) {
  return (
    <header className="top">
      <div className="wrap">
        <Logo size="small" />
        <span className="title">Python and Web Basics Test</span>
        {hud && (
          <div className="hud">
            {hud.save === "saving" && <span className="savechip">Saving...</span>}
            {hud.save === "saved" && <span className="savechip">All answers saved</span>}
            {hud.save === "error" && (
              <span className="savechip err" role="alert">
                Not saved. Check your connection.
                <button type="button" onClick={hud.onRetry}>Try again</button>
              </span>
            )}
            <div className="stat">
              <span className="lbl">Time left</span>
              <span className={`val${hud.remainingMs !== null && hud.remainingMs < 10 * 60000 ? " low" : ""}`}>
                {hud.remainingMs === null ? "..." : clock(hud.remainingMs)}
              </span>
            </div>
            <div className="stat">
              <span className="lbl">{hud.onSectionB ? "Now on" : "Answered"}</span>
              <span className="val">{hud.onSectionB ? "Section B" : `${hud.answered} of ${hud.total}`}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
