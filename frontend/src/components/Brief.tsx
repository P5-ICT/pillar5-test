import { hours } from "@/lib/format";
import type { PublicConfig } from "@/lib/types";
import { Logo } from "./Header";

type Props = {
  first: string;
  config: PublicConfig | null;
  starting: boolean;
  error: string | null;
  onStart: () => void;
  onBack: () => void;
};

export function Brief({ first, config, starting, error, onStart, onBack }: Props) {
  const totalA = config?.total_a ?? 30;
  const totalB = config?.total_b ?? 30;
  const duration = hours(config?.duration_seconds ?? 7200);

  return (
    <div className="stage">
      <div className="card wide brief">
        <Logo size="big" />
        <div className="mono-eyebrow">Before you start</div>
        <h1 className="card-h">Hello, {first}. Here is how the test works.</h1>
        <p className="sub" style={{ marginBottom: 0 }}>Read this page once. The countdown begins when you press Start.</p>

        <div className="stats">
          <div className="stat2"><div className="k">Time</div><div className="v">{duration}</div></div>
          <div className="stat2"><div className="k">Section A</div><div className="v">{totalA} marks</div></div>
          <div className="stat2"><div className="k">Section B</div><div className="v">{totalB} marks</div></div>
          <div className="stat2"><div className="k">Total</div><div className="v">{totalA + totalB} marks</div></div>
        </div>

        <div className="blk">
          <div className="eyebrow">Section A</div>
          <h3>Python multiple choice</h3>
          <p>
            You get {totalA} multiple choice questions on Python, shown one at a time, from simple ones to a few tricky
            ones. Choose one answer, then press Next. You can go back to any question and change your answer before you
            submit. Every question is worth 1 mark. Section A is marked the moment you submit, and you will see which
            questions you got right and which you got wrong. When you reach the last question, the test tells you that
            you are moving to Section B. Aim to finish Section A in about 30 minutes.
          </p>
        </div>

        <div className="blk">
          <div className="eyebrow">Section B</div>
          <h3>Build a Help Desk website</h3>
          <p>
            You will read a task and build a small website called Help Desk on your own computer. The website must read
            what a person types, save it and reply. Flask is recommended, or you can use HTML and JavaScript. When your
            website works, come back to this page and attach all your code files with the Browse button at the bottom of
            the test. Your facilitator marks Section B later, so your result will show Needs marking for this section.
            Plan about 90 minutes.
          </p>
        </div>

        <div className="blk">
          <div className="eyebrow">Good to know</div>
          <ul>
            <li>The {duration} countdown cannot be paused. It stays at the top of the page while you work, and it is kept by the server.</li>
            <li>Your answers and attached files are saved as you go. If you refresh the page or your connection drops, you pick up where you stopped.</li>
            <li>When time runs out, the test submits itself with whatever you have answered and attached.</li>
            <li>You may search online for help. You must be able to explain your code if you are asked.</li>
          </ul>
        </div>

        {error && <p className="err" role="alert" style={{ marginTop: 18 }}>{error}</p>}
        <div className="actions">
          <button className="btn" onClick={onStart} disabled={starting}>{starting ? "Starting..." : "Start the test"}</button>
          <button className="btn ghost" onClick={onBack} disabled={starting}>Back</button>
        </div>
      </div>
    </div>
  );
}
