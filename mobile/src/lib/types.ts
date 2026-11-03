export type Check = {
  mode: 'clear' | 'show';
  look_for: string[];
  spot: string;
};

export type Chore = {
  id: string;
  name: string;
  icon: string;
  minutes: number;
  effort: number;
  per_week: number;
  min_age: number;
  check: Check;
};

export type Member = {
  id: string;
  name: string;
  age: number;
  admin: boolean;
  free: number[];
  dislikes: string[];
  away?: number[];
};

export type CheckResult = {
  verdict: 'done' | 'retry';
  reason: string;
  mode?: string;
  look_for?: string[];
  spot?: string;
  before?: { count: number; area: number };
  after?: { count: number; area: number };
  cleared?: number;
  before_marked?: string;
  after_marked?: string;
  manual?: boolean;
};

export type Task = {
  id: string;
  chore: string;
  member: string;
  day: number;
  status: 'todo' | 'started' | 'retry' | 'done';
  tight?: boolean;
  carried?: number;
  before?: string | null;
  after?: string | null;
  check?: CheckResult | null;
  by?: string;
  done_at?: number;
};

export type BoardRow = {
  member: string;
  tasks: number;
  done: number;
  minutes: number;
  free: number;
  share: number;
  fair_share: number;
};

export type Household = {
  id: string;
  name: string;
  code: string;
  tz: string;
  week: string;
  today: number;
  members: Member[];
  chores: Chore[];
  tasks: Task[];
  notes: string;
  board: BoardRow[];
  fairness: number;
  ai: boolean;
  plan_by?: string;
  messages?: Record<string, string>;
  summary?: string;
};

// what the assistant changed, for the summary card under its reply
export type AssistantChanges = {
  id: string;
  moved: string[];
  added: string[];
  notes: string[];
  fairness?: { from: number; to: number };
};
