export type Question = {
  id: number;
  prompt: string;
  code: string | null;
  options: string[];
};

export type SectionBContent = {
  title: string;
  marks: number;
  plan_minutes: number;
  paragraphs: string[];
  marking_line: string;
};

export type FileInfo = { id: number; name: string; size: number };

export type PerQuestion = { n: number; chosen: number | null; correct: boolean };

export type Result = {
  score: number;
  total: number;
  per: PerQuestion[];
  b_mark: number | null;
};

export type AttemptState = {
  id: number;
  first_name: string;
  surname: string;
  status: "in_progress" | "submitted";
  server_time: string;
  started_at: string;
  deadline_at: string;
  timed_out: boolean;
  answers: Record<string, number>;
  files: FileInfo[];
  limits: { max_files: number; max_total_bytes: number };
  total_a: number;
  total_b: number;
  questions?: Question[];
  section_b?: SectionBContent;
  result?: Result;
};

export type PublicConfig = {
  duration_seconds: number;
  total_a: number;
  total_b: number;
  max_files: number;
  max_total_bytes: number;
  allowed_extensions: string[];
};

export type AdminRow = {
  id: number;
  first_name: string;
  surname: string;
  status: "in_progress" | "submitted" | "timed_out";
  started_at: string;
  submitted_at: string | null;
  deadline_at: string;
  answered: number;
  files: number;
  score_a: number | null;
  b_mark: number | null;
  total: number | null;
};

export type AdminList = {
  summary: {
    started: number;
    in_progress: number;
    submitted: number;
    section_a_total: number;
    section_b_total: number;
    section_b_bonus: number;
  };
  attempts: AdminRow[];
};

export type AdminFile = { id: number; name: string; size: number; content: string };
