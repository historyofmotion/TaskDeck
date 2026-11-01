import { Area, BoardData, CardItem, Column, ColumnRole, ThemeOption } from '../types';
import { INITIAL_BOARD_DATA } from './defaultData';
import { normalizePriorities, withColumnRoles } from './helpers';

// Thrown when a file can't be used at all. The board in the app is left untouched.
export class BoardCheckError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(problems.join('; '));
    this.name = 'BoardCheckError';
    this.problems = problems;
  }
}

export interface CheckedBoard {
  data: BoardData;
  fixes: string[]; // small problems that were repaired, in plain words
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const isoOrNull = (v: unknown): string | null =>
  typeof v === 'string' && !isNaN(new Date(v).getTime()) ? v : null;
const ROLES: ColumnRole[] = ['pending', 'active', 'blocked', 'done'];
const THEMES: ThemeOption[] = ['light', 'dark', 'system'];
const MAX_STARS = 3;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const was = (n: number) => (n === 1 ? 'was' : 'were');

// Parse and check a board file's text. Throws BoardCheckError if it can't be used.
export function parseBoardFile(text: string): CheckedBoard {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new BoardCheckError([`It isn't valid JSON (${(err as Error).message})`]);
  }
  return checkBoard(raw);
}

export function checkBoard(raw: unknown): CheckedBoard {
  const problems: string[] = [];
  const fixes: string[] = [];

  if (!isObj(raw)) throw new BoardCheckError(['It is not a TaskDeck board (expected a JSON object)']);
  if (!Array.isArray(raw.cards)) throw new BoardCheckError(['It has no "cards" list']);
  if (raw.archive !== undefined && !Array.isArray(raw.archive)) problems.push('"archive" is not a list');

  // ---- Columns ----
  let columns: Column[] = INITIAL_BOARD_DATA.columns;
  if (raw.columns === undefined || (Array.isArray(raw.columns) && raw.columns.length === 0)) {
    fixes.push('No columns found, so the default columns were used');
  } else if (!Array.isArray(raw.columns)) {
    problems.push('"columns" is not a list');
  } else {
    const seen = new Set<string>();
    columns = [];
    raw.columns.forEach((c, i) => {
      const id = isObj(c) ? nonEmpty(c.id) : null;
      const name = isObj(c) ? str(c.name) : null;
      if (!isObj(c) || !id || name === null) {
        problems.push(`Column ${i + 1} is missing an id or name`);
        return;
      }
      if (seen.has(id)) problems.push(`Two columns share the id "${id}"`);
      seen.add(id);
      const role = ROLES.includes(c.role as ColumnRole) ? (c.role as ColumnRole) : undefined;
      columns.push({ id, name, order: typeof c.order === 'number' ? c.order : i, ...(role ? { role } : {}) });
    });
    columns = withColumnRoles(columns);
  }

  // ---- Projects (areas) ----
  let areas: Area[] = INITIAL_BOARD_DATA.areas;
  if (Array.isArray(raw.areas) && raw.areas.length > 0) {
    areas = raw.areas
      .filter((a): a is Obj => isObj(a) && !!nonEmpty(a.id) && str(a.name) !== null)
      .map((a) => ({ id: a.id as string, name: a.name as string, color: nonEmpty(a.color) || '#64748B' }));
    const dropped = raw.areas.length - areas.length;
    if (dropped) fixes.push(`Skipped ${plural(dropped, 'project')} with no id or name`);
  }

  // ---- Cards ----
  const columnIds = new Set(columns.map((c) => c.id));
  const areaIds = new Set(areas.map((a) => a.id));
  const cardIds = new Set<string>();
  let movedToFirstColumn = 0;
  let clearedProjects = 0;
  let clearedDueDates = 0;
  let fixedProgress = 0;
  let clearedEstimates = 0;
  let clearedTracked = 0;

  const checkCard = (c: unknown, label: string): CardItem | null => {
    const id = isObj(c) ? nonEmpty(c.id) : null;
    const title = isObj(c) ? nonEmpty(c.title) : null;
    if (!isObj(c) || !id || !title) {
      problems.push(`${label} is missing an id or title`);
      return null;
    }
    if (cardIds.has(id)) problems.push(`Two cards share the id "${id}"`);
    cardIds.add(id);

    let columnId = str(c.columnId) || '';
    if (!columnIds.has(columnId)) {
      columnId = columns[0]?.id || '';
      movedToFirstColumn++;
    }
    let areaId = str(c.areaId);
    if (areaId !== null && !areaIds.has(areaId)) {
      areaId = null;
      clearedProjects++;
    }
    let dueDate = c.dueDate == null ? null : str(c.dueDate);
    if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      dueDate = null;
      clearedDueDates++;
    }
    let progress = typeof c.progress === 'number' && isFinite(c.progress) ? c.progress : 0;
    if (c.progress !== undefined && progress !== c.progress) fixedProgress++;
    if (progress < 0 || progress > 100) {
      progress = Math.max(0, Math.min(100, progress));
      fixedProgress++;
    }

    let estimateHours: number | null = null;
    if (c.estimateHours != null) {
      if (typeof c.estimateHours === 'number' && isFinite(c.estimateHours) && c.estimateHours > 0) {
        estimateHours = Math.min(c.estimateHours, 1000);
      } else {
        clearedEstimates++;
      }
    }

    let trackedSeconds = 0;
    if (c.trackedSeconds != null) {
      if (typeof c.trackedSeconds === 'number' && isFinite(c.trackedSeconds) && c.trackedSeconds >= 0) {
        trackedSeconds = Math.round(c.trackedSeconds);
      } else {
        clearedTracked++;
      }
    }

    return {
      id,
      title,
      description: str(c.description) || '',
      areaId,
      columnId,
      priority: typeof c.priority === 'number' && isFinite(c.priority) ? c.priority : Number.MAX_SAFE_INTEGER,
      starred: c.starred === true,
      progress: Math.round(progress),
      dueDate,
      createdAt: isoOrNull(c.createdAt) || new Date().toISOString(),
      completedAt: isoOrNull(c.completedAt),
      ...(c.archivedAt !== undefined ? { archivedAt: isoOrNull(c.archivedAt) } : {}),
      ...(estimateHours !== null ? { estimateHours } : {}),
      ...(trackedSeconds > 0 ? { trackedSeconds } : {}),
    };
  };

  const cards = raw.cards
    .map((c, i) => checkCard(c, `Card ${i + 1}`))
    .filter((c): c is CardItem => c !== null);
  const archive = (Array.isArray(raw.archive) ? raw.archive : [])
    .map((c, i) => checkCard(c, `Archived card ${i + 1}`))
    .filter((c): c is CardItem => c !== null);

  if (problems.length) throw new BoardCheckError(problems);

  // Keep the file's ranking (hand-edited files may not be in rank order), then renumber 1..n
  cards.sort((a, b) => a.priority - b.priority);

  // Star limit
  let stars = 0;
  let unstarred = 0;
  cards.forEach((c) => {
    if (!c.starred) return;
    if (++stars > MAX_STARS) {
      c.starred = false;
      unstarred++;
    }
  });

  if (movedToFirstColumn) fixes.push(`${plural(movedToFirstColumn, 'card')} pointed to a missing column and ${was(movedToFirstColumn)} moved to "${columns[0]?.name}"`);
  if (clearedProjects) fixes.push(`${plural(clearedProjects, 'card')} pointed to a missing project, so ${clearedProjects === 1 ? 'it was' : 'they were'} cleared`);
  if (clearedDueDates) fixes.push(`${plural(clearedDueDates, 'due date')} ${was(clearedDueDates)}n't in YYYY-MM-DD format and ${was(clearedDueDates)} cleared`);
  if (fixedProgress) fixes.push(`${plural(fixedProgress, 'progress value')} ${was(fixedProgress)} invalid and ${was(fixedProgress)} corrected`);
  if (clearedEstimates) fixes.push(`${plural(clearedEstimates, 'hour estimate')} ${was(clearedEstimates)} invalid and ${was(clearedEstimates)} cleared`);
  if (clearedTracked) fixes.push(`${plural(clearedTracked, 'tracked time')} ${was(clearedTracked)} invalid and ${was(clearedTracked)} cleared`);
  if (unstarred) fixes.push(`${plural(unstarred, 'card')} unstarred to keep the ${MAX_STARS}-star limit`);

  // ---- Settings ----
  const s = isObj(raw.settings) ? raw.settings : {};
  const days = typeof s.autoArchiveDays === 'number' && isFinite(s.autoArchiveDays) ? s.autoArchiveDays : INITIAL_BOARD_DATA.settings.autoArchiveDays;

  return {
    data: {
      version: typeof raw.version === 'number' ? raw.version : INITIAL_BOARD_DATA.version,
      settings: {
        ...INITIAL_BOARD_DATA.settings,
        autoArchiveDays: Math.max(3, Math.min(90, Math.round(days))),
        theme: THEMES.includes(s.theme as ThemeOption) ? (s.theme as ThemeOption) : INITIAL_BOARD_DATA.settings.theme,
        appIcon: str(s.appIcon) || INITIAL_BOARD_DATA.settings.appIcon,
      },
      areas,
      columns,
      cards: normalizePriorities(cards),
      archive,
    },
    fixes,
  };
}

// Short message for a toast, e.g. "Card 3 is missing an id or title (and 2 more problems)"
export function summarizeProblems(problems: string[]): string {
  if (problems.length <= 1) return problems[0] || 'Unknown problem';
  return `${problems[0]} (and ${plural(problems.length - 1, 'more problem')})`;
}
