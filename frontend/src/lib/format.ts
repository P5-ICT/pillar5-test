export const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** 7199000 ms becomes 1:59:59 */
export function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function hours(seconds: number): string {
  const h = seconds / 3600;
  if (Number.isInteger(h)) return h === 1 ? "1 hour" : `${h} hours`;
  return `${Math.round(seconds / 60)} minutes`;
}

export function localTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : "";
}
