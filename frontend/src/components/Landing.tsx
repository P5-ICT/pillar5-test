"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Logo } from "./Header";

type Props = {
  first: string;
  last: string;
  setFirst: (v: string) => void;
  setLast: (v: string) => void;
  onContinue: () => void;
};

export function Landing({ first, last, setFirst, setLast, onContinue }: Props) {
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!first.trim() || !last.trim()) {
      setError("Enter your first name and your surname to continue.");
      return;
    }
    setError(null);
    onContinue();
  }

  return (
    <div className="stage">
      <div className="card">
        <Logo size="big" />
        <div className="mono-eyebrow">Python and Web Basics · Developer Test</div>
        <h1 className="card-h">Before we begin</h1>
        <p className="sub">Tell us who’s taking this assessment.</p>
        <form onSubmit={submit} autoComplete="off" noValidate>
          <div className="field">
            <label htmlFor="first">First name</label>
            <input id="first" type="text" placeholder="e.g. Thabo" value={first} onChange={(e) => setFirst(e.target.value)} maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor="last">Surname</label>
            <input id="last" type="text" placeholder="e.g. Dlamini" value={last} onChange={(e) => setLast(e.target.value)} maxLength={60} />
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn block" type="submit">Continue</button>
        </form>
        <p className="center" style={{ margin: "20px 0 0" }}>
          <Link href="/admin" className="linkbtn">Facilitator dashboard</Link>
        </p>
      </div>
    </div>
  );
}
