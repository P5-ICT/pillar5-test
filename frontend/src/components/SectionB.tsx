"use client";

import { ChangeEvent, useState } from "react";
import { kb, plural } from "@/lib/format";
import type { FileInfo, SectionBContent } from "@/lib/types";
import { Inline } from "./Inline";

type Props = {
  section: SectionBContent;
  files: FileInfo[];
  maxFiles: number;
  maxTotalBytes: number;
  extensions: string[];
  note: string | null;
  uploading: boolean;
  answered: number;
  total: number;
  submitting: boolean;
  submitError: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (id: number) => void;
  onBack: () => void;
  onSubmit: () => void;
};

export function SectionB(p: Props) {
  const [confirming, setConfirming] = useState(false);
  const missing = p.total - p.answered;

  function picked(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length) p.onFiles(list);
  }

  return (
    <>
      <p><button className="btn ghost small" onClick={p.onBack}>Back to Section A</button></p>
      <section className="secB solo">
        <div className="eyebrow">Section B</div>
        <h2>{p.section.title}</h2>
        <p className="muted">{p.section.marks} marks. Plan for about {p.section.plan_minutes} minutes.</p>
        <div className="prose">
          {p.section.paragraphs.map((text, i) => (
            <p key={i}><Inline text={text} /></p>
          ))}
        </div>
        <div className="marksline">{p.section.marking_line}</div>

        <div className="attach">
          <h3>Attach your code</h3>
          <p className="muted">
            Attach every file of your website, for example app.py and your HTML templates, or attach one .zip of your project folder.
            Code files only: {p.extensions.map((e) => `.${e}`).join(", ")}. Images and other files inside a zip are left out.
            Up to {p.maxFiles} files and {Math.round(p.maxTotalBytes / 1024)} KB of code in total.
          </p>
          <div className="row">
            <label className="btn small" htmlFor="fileInput" style={{ cursor: "pointer" }}>
              {p.uploading ? "Uploading..." : "Browse and attach files or a zip"}
            </label>
            <input
              id="fileInput"
              type="file"
              multiple
              accept={[...p.extensions, "zip"].map((e) => `.${e}`).join(",")}
              onChange={picked}
              disabled={p.uploading}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
            />
          </div>
          {p.note && <p className="note" role="status">{p.note}</p>}
          <ul className="files">
            {p.files.map((f) => (
              <li key={f.id}>
                <span className="fname">{f.name}</span>
                <span className="fsize">{kb(f.size)}</span>
                <button className="linkbtn" onClick={() => p.onRemove(f.id)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="submitzone">
        <button className="btn" onClick={() => setConfirming(true)} disabled={p.submitting}>Submit test</button>
        {confirming && (
          <div className="confirm">
            <p>
              <strong>Ready to submit?</strong> You answered {p.answered} of {p.total} questions
              {missing > 0 && `, so ${plural(missing, "question")} will be marked wrong`}.{" "}
              {p.files.length > 0
                ? `${plural(p.files.length, "code file")} attached for Section B.`
                : "No code files are attached for Section B."}{" "}
              You cannot change anything after you submit.
            </p>
            {p.submitError && <p className="err" role="alert">{p.submitError}</p>}
            <div className="row">
              <button className="btn" onClick={p.onSubmit} disabled={p.submitting}>
                {p.submitting ? "Submitting..." : "Yes, submit my test"}
              </button>
              <button className="btn ghost" onClick={() => setConfirming(false)} disabled={p.submitting}>Go back</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
