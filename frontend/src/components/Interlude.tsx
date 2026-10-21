import type { Question } from "@/lib/types";

type Props = {
  questions: Question[];
  answers: Record<number, number>;
  planMinutes: number;
  onStartB: () => void;
  onReview: () => void;
};

export function Interlude({ questions, answers, planMinutes, onStartB, onReview }: Props) {
  const missing = questions.map((q, i) => (answers[q.id] === undefined ? `Q${i + 1}` : null)).filter(Boolean);
  const answered = questions.length - missing.length;

  return (
    <div className="card interlude">
      <div className="mono-eyebrow" style={{ marginTop: 0 }}>Section A complete</div>
      <h1 className="card-h">You are moving to Section B</h1>
      <p className="sub">
        You answered {answered} of {questions.length} questions in Section A.
        {missing.length > 0 && ` Not answered yet: ${missing.join(", ")}.`}
      </p>
      <p>
        Section B is the Help Desk website task. You will read the task, build the website on your computer, and attach
        your code files at the end. Plan about {planMinutes} minutes. Your countdown keeps running.
      </p>
      <p className="muted">You can still go back to Section A before you submit the test.</p>
      <div className="row" style={{ marginTop: 22 }}>
        <button className="btn" onClick={onStartB}>Start Section B</button>
        <button className="btn ghost" onClick={onReview}>Review Section A</button>
      </div>
    </div>
  );
}
