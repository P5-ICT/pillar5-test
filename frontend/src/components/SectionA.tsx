import { LETTERS } from "@/lib/format";
import type { Question } from "@/lib/types";

type Props = {
  questions: Question[];
  answers: Record<number, number>;
  index: number;
  setIndex: (i: number) => void;
  onPick: (questionId: number, choice: number) => void;
  onFinish: () => void;
};

export function SectionA({ questions, answers, index, setIndex, onPick, onFinish }: Props) {
  const q = questions[index];
  const last = index === questions.length - 1;
  if (!q) return null;

  return (
    <section>
      <div className="sechead">
        <div className="eyebrow">Section A</div>
        <h2>Python multiple choice</h2>
        <p className="muted">One question at a time. Use Next and Previous, or the numbers below, to move around.</p>
      </div>

      <nav className="qnav" aria-label="Jump to a question">
        {questions.map((item, i) => {
          const done = answers[item.id] !== undefined;
          return (
            <button
              key={item.id}
              type="button"
              className={`qchip${done ? " done" : ""}${i === index ? " cur" : ""}`}
              aria-label={`Question ${i + 1}, ${done ? "answered" : "not answered"}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>Filled numbers are questions you have answered.</p>

      <div className="qprog">Question {index + 1} of {questions.length}</div>

      <div className="q" role="radiogroup" aria-labelledby={`qt${q.id}`}>
        <div className="qhead">
          <span className="qnum">Q{index + 1}</span>
          <span className="qtext" id={`qt${q.id}`}>{q.prompt}</span>
        </div>
        {q.code && <pre className="code"><code>{q.code}</code></pre>}
        <div className="opts">
          {q.options.map((text, j) => (
            <label className="opt" key={j}>
              <input
                type="radio"
                name={`q${q.id}`}
                value={j}
                checked={answers[q.id] === j}
                onChange={() => onPick(q.id, j)}
              />
              <span className="key">{LETTERS[j]}</span>
              <span className="txt">{text}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="navrow">
        <button className="btn ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}>Previous</button>
        <button className="btn" onClick={() => (last ? onFinish() : setIndex(index + 1))}>
          {last ? "Finish Section A" : "Next question"}
        </button>
      </div>
    </section>
  );
}
