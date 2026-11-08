"use client";

import Link from "next/link";
import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/Header";
import {
  ApiError, adminCsv, adminDelete, adminDetail, adminList, adminLogin, adminMark, adminToken,
} from "@/lib/api";
import { kb, localTime } from "@/lib/format";
import type { AdminFile, AdminList, AdminRow } from "@/lib/types";

const messageOf = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");

const STATUS: Record<AdminRow["status"], { label: string; cls: string }> = {
  in_progress: { label: "In progress", cls: "wait" },
  submitted: { label: "Submitted", cls: "ok" },
  timed_out: { label: "Time ran out", cls: "no" },
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [data, setData] = useState<AdminList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [rowError, setRowError] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [code, setCode] = useState<Record<number, AdminFile[]>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    document.body.classList.remove("stagey");
    setToken(adminToken.get());
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    adminToken.set(null);
    setToken(null);
    setData(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setData(await adminList(token));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logout();
      else setError(messageOf(e));
    }
  }, [token, logout]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const id = window.setInterval(refresh, 10000);
    return () => window.clearInterval(id);
  }, [token, refresh]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const { token: t } = await adminLogin(password);
      adminToken.set(t);
      setToken(t);
      setPassword("");
    } catch (err) {
      setLoginError(messageOf(err));
    }
  }

  async function toggleCode(id: number) {
    if (open === id) return setOpen(null);
    setOpen(id);
    if (!code[id] && token) {
      try {
        const detail = await adminDetail(token, id);
        setCode((c) => ({ ...c, [id]: detail.files }));
      } catch (e) {
        setRowError((r) => ({ ...r, [id]: messageOf(e) }));
      }
    }
  }

  async function saveMark(row: AdminRow) {
    if (!token) return;
    const raw = drafts[row.id] ?? (row.b_mark === null ? "" : String(row.b_mark));
    const value = Number(raw);
    const max = (data?.summary.section_b_total ?? 30) + (data?.summary.section_b_bonus ?? 0);
    if (raw.trim() === "" || !Number.isInteger(value) || value < 0 || value > max) {
      setRowError((r) => ({ ...r, [row.id]: `Enter a whole number from 0 to ${max}.` }));
      return;
    }
    try {
      await adminMark(token, row.id, value);
      setRowError((r) => ({ ...r, [row.id]: "" }));
      setDrafts((d) => {
        const next = { ...d };
        delete next[row.id];
        return next;
      });
      refresh();
    } catch (e) {
      setRowError((r) => ({ ...r, [row.id]: messageOf(e) }));
    }
  }

  async function remove(id: number) {
    if (!token) return;
    try {
      await adminDelete(token, id);
      setConfirmDelete(null);
      refresh();
    } catch (e) {
      setRowError((r) => ({ ...r, [id]: messageOf(e) }));
    }
  }

  async function downloadCsv() {
    if (!token) return;
    try {
      const blob = await adminCsv(token);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pillar5-test-results.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(messageOf(e));
    }
  }

  if (!ready) return null;

  if (!token) {
    return (
      <div className="stage">
        <div className="card">
          <Logo size="big" />
          <div className="mono-eyebrow">Facilitator dashboard</div>
          <h1 className="card-h">Facilitator login</h1>
          <p className="sub">Enter the facilitator password to see submissions and mark Section B.</p>
          <form onSubmit={login}>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            {loginError && <p className="err" role="alert">{loginError}</p>}
            <button className="btn block" type="submit">Log in</button>
          </form>
          <p className="center" style={{ margin: "20px 0 0" }}>
            <Link href="/" className="linkbtn">Back to the test</Link>
          </p>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const bTotal = summary?.section_b_total ?? 30;
  const bMax = bTotal + (summary?.section_b_bonus ?? 0);

  return (
    <>
      <header className="admin-top">
        <div className="wrap" style={{ maxWidth: 1100 }}>
          <Logo size="small" />
          <span className="title" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>Facilitator dashboard</span>
          <span style={{ marginLeft: "auto" }} className="row">
            <Link href="/" className="linkbtn">Student page</Link>
            <button className="btn ghost small" onClick={logout}>Log out</button>
          </span>
        </div>
      </header>

      <main className="admin-wrap">
        <div className="eyebrow">Submissions</div>
        <h1>Test results</h1>
        <p className="lead" style={{ marginBottom: 0 }}>
          Section A is marked automatically. Open a student&rsquo;s code to review Section B, then enter its mark out of {bTotal}. This page refreshes by itself every 10 seconds.
        </p>

        <div className="sumrow">
          <div className="stat2"><div className="k">Started</div><div className="v">{summary?.started ?? 0}</div></div>
          <div className="stat2"><div className="k">In progress</div><div className="v">{summary?.in_progress ?? 0}</div></div>
          <div className="stat2"><div className="k">Submitted</div><div className="v">{summary?.submitted ?? 0}</div></div>
        </div>

        <div className="toolbar">
          <button className="btn small" onClick={downloadCsv}>Download results (CSV)</button>
          <button className="btn ghost small" onClick={refresh}>Refresh now</button>
          {error && <span className="err" style={{ margin: 0 }} role="alert">{error}</span>}
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Student</th><th>Status</th><th>Section A</th><th>Section B</th><th>Total</th><th>Started</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data?.attempts.length === 0 && (
                <tr><td colSpan={7} className="muted">No students yet. They appear here as soon as they press Start.</td></tr>
              )}
              {data?.attempts.map((row) => {
                const s = STATUS[row.status];
                const finished = row.status !== "in_progress";
                const value = drafts[row.id] ?? (row.b_mark === null ? "" : String(row.b_mark));
                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td>
                        <strong>{row.first_name} {row.surname}</strong>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {row.answered} answered · {row.files} {row.files === 1 ? "file" : "files"}
                        </div>
                      </td>
                      <td><span className={`pill ${s.cls}`}>{s.label}</span></td>
                      <td>{row.score_a === null ? <span className="muted">Waiting</span> : `${row.score_a} / ${summary?.section_a_total}`}</td>
                      <td>
                        {finished ? (
                          <div className="markbox">
                            <input
                              type="number" min={0} max={bMax} step={1} value={value}
                              aria-label={`Section B mark for ${row.first_name} ${row.surname}`}
                              onChange={(e) => setDrafts((d) => ({ ...d, [row.id]: e.target.value }))}
                            />
                            <span className="muted">/ {bTotal}{bMax > bTotal && ` + ${bMax - bTotal} bonus`}</span>
                            <button className="btn small" onClick={() => saveMark(row)}>Save</button>
                          </div>
                        ) : (
                          <span className="muted">Not submitted</span>
                        )}
                        {finished && row.b_mark === null && <div style={{ marginTop: 6 }}><span className="pill wait">Needs marking</span></div>}
                      </td>
                      <td>{row.total === null ? <span className="muted">Waiting</span> : `${row.total} / ${(summary?.section_a_total ?? 0) + bTotal}`}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{localTime(row.started_at)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn ghost small" onClick={() => toggleCode(row.id)}>
                            {open === row.id ? "Hide code" : "View code"}
                          </button>
                          {confirmDelete === row.id ? (
                            <span className="inline-confirm">
                              <button className="btn ghost small danger" onClick={() => remove(row.id)}>Yes, delete</button>
                              <button className="linkbtn" onClick={() => setConfirmDelete(null)}>Cancel</button>
                            </span>
                          ) : (
                            <button className="linkbtn" onClick={() => setConfirmDelete(row.id)}>Delete</button>
                          )}
                        </div>
                        {rowError[row.id] && <div className="err" style={{ fontSize: 13, margin: "6px 0 0" }}>{rowError[row.id]}</div>}
                      </td>
                    </tr>
                    {open === row.id && (
                      <tr>
                        <td colSpan={7}>
                          {!code[row.id] && <span className="muted">Loading code...</span>}
                          {code[row.id]?.length === 0 && <span className="muted">No files were attached.</span>}
                          {code[row.id]?.map((f) => (
                            <details className="code" key={f.id} open>
                              <summary className="fname-s">{f.name} · {kb(f.size)}</summary>
                              <pre>{f.content}</pre>
                            </details>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
