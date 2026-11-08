import { LETTERS, kb } from "@/lib/format";
import type { AttemptState } from "@/lib/types";

export function Results({ attempt }: { attempt: AttemptState }) {
  const result = attempt.result;
  if (!result) return null;
  const pct = Math.round((result.score / result.total) * 100);

  return (
    <>
      <div className="eyebrow">{attempt.timed_out ? "Time ran out" : "Test submitted"}</div>
      <h1>Thank you, {attempt.first_name}</h1>
      <p className="lead">
        {attempt.timed_out
          ? "Your time ran out, so the test was submitted for you with what you had saved. "
          : ""}
        Section A has been marked. Section B will be marked by your facilitator.
      </p>

      <section className="res">
        <div className="eyebrow">Section A · Marked</div>
        <div className="scoreline">
          <span className="score">{result.score}</span>
          <span className="outof">out of {result.total}</span>
          <span className="muted">({pct}%)</span>
        </div>
        <p className="muted">Here is how you did on each question.</p>
        <div className="review">
          {result.per.map((x) => (
            <div className="rv" key={x.n}>
              <span className="n">Q{x.n}</span>
              {x.correct ? (
                <span className="pill ok">Correct</span>
              ) : (
                <>
                  <span className="pill no">Wrong</span>
                  <span className="chose">{x.chosen === null ? "No answer" : `You chose ${LETTERS[x.chosen]}`}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="res">
        <div className="eyebrow">Section B · Asset Loan Tracker website</div>
        <p style={{ marginTop: 6 }}>
          {result.b_mark === null ? (
            <span className="pill wait">Needs marking</span>
          ) : (
            <span className="pill ok">Marked: {result.b_mark} out of {attempt.total_b}</span>
          )}
        </p>
        <p className="muted">
          {result.b_mark === null
            ? "Your code was received for marking. You will get the result from your facilitator."
            : "Your facilitator has marked your code."}
        </p>
        {attempt.files.length > 0 ? (
          <ul className="files">
            {attempt.files.map((f) => (
              <li key={f.id}>
                <span className="fname">{f.name}</span>
                <span className="fsize">{kb(f.size)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No code files were attached.</p>
        )}
        <div className="deliv">
          <p style={{ margin: 0 }}><strong>Saved.</strong> Your answers and code files are stored safely with your facilitator.</p>
        </div>
      </section>
    </>
  );
}
