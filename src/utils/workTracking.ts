// What the user is doing right now: working on a card, or off task.
// Kept in localStorage (this browser only) so a reload doesn't lose a running timer.
// Only working time is recorded, onto the card's trackedSeconds.

export type WorkMode = 'working' | 'off';

export interface WorkState {
  cardId: string | null; // the card being worked on (off task: the card to go back to, if any)
  mode: WorkMode;
  since: number; // ms timestamp when the current working or off-task stretch began
}

export const WORK_KEY = 'taskdeck_work_state';

export function loadWorkState(): WorkState | null {
  try {
    const raw = localStorage.getItem(WORK_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw);
    if ((w.mode === 'working' || w.mode === 'off') && typeof w.since === 'number' && (w.cardId === null || typeof w.cardId === 'string')) {
      return { cardId: w.cardId, mode: w.mode, since: w.since };
    }
  } catch {
    // unreadable or blocked storage: start with nothing running
  }
  return null;
}

export function saveWorkState(state: WorkState | null) {
  try {
    if (state) localStorage.setItem(WORK_KEY, JSON.stringify(state));
    else localStorage.removeItem(WORK_KEY);
  } catch {
    // storage blocked: the timer still runs, it just won't survive a reload
  }
}

// "1:02:03" or "12:34"
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// "2h 05m", "12m", "<1m"
export function formatTracked(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
