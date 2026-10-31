import { BoardData, CardItem, Column, ColumnRole } from '../types';

// ---- Column roles ----
// Guess a role from a column name. Only used once, for boards saved before roles existed.
export function inferColumnRole(name: string): ColumnRole {
  const n = name.toLowerCase();
  if (n.includes('done')) return 'done';
  if (n.includes('blocked')) return 'blocked';
  if (n.includes('pending')) return 'pending';
  return 'active';
}

export function getColumnRole(column: Column | undefined): ColumnRole {
  if (!column) return 'active';
  return column.role ?? inferColumnRole(column.name);
}

export function getDoneColumnId(columns: Column[]): string | undefined {
  return columns.find((c) => getColumnRole(c) === 'done')?.id;
}

// Save a role on every column so later renames don't change behaviour
export function withColumnRoles(columns: Column[]): Column[] {
  return columns.map((c) => (c.role ? c : { ...c, role: inferColumnRole(c.name) }));
}


// URL regex to detect http/https links
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  const cleaned = matches.map((u) => u.replace(/[.,;:)]+$/, ''));
  return Array.from(new Set(cleaned)).filter(Boolean);
}

export function extractFirstUrl(text: string): string | null {
  const urls = extractUrls(text);
  return urls.length > 0 ? urls[0] : null;
}

export function replaceUrlsWithLinkToken(text: string): string {
  if (!text) return '';
  return text.replace(URL_REGEX, '[Link]');
}

export function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140 ? '#0f172a' : '#ffffff';
}

export function formatDueDateLabel(
  dateStr: string | null,
  isDone?: boolean
): {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!dateStr) {
    return { label: '', isOverdue: false, isToday: false };
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    return { label: '', isOverdue: false, isToday: false };
  }

  const targetUtc = Date.UTC(year, month - 1, day);
  const diffDays = Math.round((targetUtc - todayUtc) / (1000 * 3600 * 24));

  const targetDate = new Date(year, month - 1, day);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${monthNames[targetDate.getMonth()]} ${targetDate.getDate()}`;

  if (diffDays < 0) {
    if (isDone) {
      return { label: `Due ${formattedDate}`, isOverdue: false, isToday: false };
    }
    return { label: `${formattedDate} (Overdue)`, isOverdue: true, isToday: false };
  } else if (diffDays === 0) {
    return { label: 'Due Today', isOverdue: false, isToday: true };
  } else if (diffDays === 1) {
    return { label: 'Due Tomorrow', isOverdue: false, isToday: false };
  } else {
    return { label: `Due ${formattedDate}`, isOverdue: false, isToday: false };
  }
}

// Full calendar date, e.g. "Oct 24, 2026" (empty if missing or invalid)
export function formatFullDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCompletedAtLabel(completedAtStr: string | null): string {
  if (!completedAtStr) return '';
  const completedDate = new Date(completedAtStr);
  if (isNaN(completedDate.getTime())) return '';

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const completedUtc = Date.UTC(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());

  const diffDays = Math.round((todayUtc - completedUtc) / (1000 * 3600 * 24));

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (diffDays >= 0 && diffDays < 7) {
    if (diffDays === 0) {
      return 'Done Today';
    }
    return `Done ${dayNames[completedDate.getDay()]}`;
  } else {
    return `Done ${monthNames[completedDate.getMonth()]} ${completedDate.getDate()}`;
  }
}

// Ensures global priorities are sequential 1, 2, 3... based on current array position
export function normalizePriorities(cards: CardItem[]): CardItem[] {
  return cards.map((card, idx) => ({
    ...card,
    priority: idx + 1,
  }));
}

// Resort cards ensuring starred items always take top priority (1, 2, 3...) before non-starred items
export function resortWithStarredTop(cards: CardItem[]): CardItem[] {
  const sorted = [...cards].sort((a, b) => {
    if (a.starred !== b.starred) {
      return a.starred ? -1 : 1;
    }
    return a.priority - b.priority;
  });
  return normalizePriorities(sorted);
}

// Reorder cards when dragging
export function reorderCardsInGlobalSequence(
  allCards: CardItem[],
  draggedCardId: string,
  targetCardId: string,
  placeBefore: boolean,
  targetColumnId?: string
): CardItem[] {
  const cards = [...allCards].sort((a, b) => a.priority - b.priority);
  const draggedIndex = cards.findIndex((c) => c.id === draggedCardId);
  if (draggedIndex === -1) return allCards;

  // Copy the card instead of changing it: the original belongs to current React state
  const [original] = cards.splice(draggedIndex, 1);
  const draggedCard = targetColumnId ? { ...original, columnId: targetColumnId } : original;

  const targetIndex = cards.findIndex((c) => c.id === targetCardId);
  if (targetIndex === -1) {
    cards.push(draggedCard);
  } else {
    const insertAt = placeBefore ? targetIndex : targetIndex + 1;
    cards.splice(insertAt, 0, draggedCard);
  }

  return normalizePriorities(cards);
}

// Move card to end of a column
export function moveCardToColumnEnd(
  allCards: CardItem[],
  draggedCardId: string,
  targetColumnId: string,
  doneColumnId: string
): CardItem[] {
  const cards = [...allCards].sort((a, b) => a.priority - b.priority);
  const draggedIndex = cards.findIndex((c) => c.id === draggedCardId);
  if (draggedIndex === -1) return allCards;

  // Copy the card instead of changing it: the original belongs to current React state
  const [original] = cards.splice(draggedIndex, 1);
  const isDone = targetColumnId === doneColumnId;
  const dragged: CardItem = {
    ...original,
    columnId: targetColumnId,
    completedAt: isDone ? original.completedAt || new Date().toISOString() : null,
  };

  // Find the last card in targetColumnId
  let lastTargetColIndex = -1;
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].columnId === targetColumnId) {
      lastTargetColIndex = i;
      break;
    }
  }

  if (lastTargetColIndex !== -1) {
    cards.splice(lastTargetColIndex + 1, 0, dragged);
  } else {
    cards.push(dragged);
  }

  return normalizePriorities(cards);
}

export function generatePlainTextCopy(data: BoardData): string {
  const sortedCards = [...data.cards].sort((a, b) => a.priority - b.priority);
  const colMap = new Map<string, string>(data.columns.map((c) => [c.id, c.name]));

  return sortedCards
    .map((card) => {
      const colName = colMap.get(card.columnId) || 'Unknown';
      const pct = card.columnId === getDoneColumnId(data.columns)
        ? 100
        : card.progress;
      let line = `${card.priority}. ${card.title} — ${colName} — ${pct}%`;
      if (card.description && card.description.trim()) {
        line += `\n   ${card.description.trim().replace(/\n/g, '\n   ')}`;
      }
      return line;
    })
    .join('\n\n');
}

export function runAutoArchive(data: BoardData): { updatedData: BoardData; archivedCount: number } {
  const doneColumn = data.columns.find((c) => getColumnRole(c) === 'done');
  if (!doneColumn) return { updatedData: data, archivedCount: 0 };

  const daysThreshold = data.settings.autoArchiveDays || 7;
  const now = Date.now();
  const msThreshold = daysThreshold * 24 * 60 * 60 * 1000;

  const remainingCards: CardItem[] = [];
  const newlyArchived: CardItem[] = [];

  for (const card of data.cards) {
    if (card.columnId === doneColumn.id && card.completedAt) {
      const completedTime = new Date(card.completedAt).getTime();
      if (now - completedTime >= msThreshold) {
        newlyArchived.push({
          ...card,
          archivedAt: new Date().toISOString(),
        });
        continue;
      }
    }
    remainingCards.push(card);
  }

  if (newlyArchived.length === 0) {
    return { updatedData: data, archivedCount: 0 };
  }

  const updatedData: BoardData = {
    ...data,
    cards: normalizePriorities(remainingCards),
    archive: [...(data.archive || []), ...newlyArchived],
  };

  return { updatedData, archivedCount: newlyArchived.length };
}

// ---- Comparing two copies of the board (browser copy vs board.json) ----

// JSON with sorted keys, so key order alone never counts as a difference
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export interface BoardDiff {
  identical: boolean;
  onlyInBrowser: string[]; // card titles
  onlyInFile: string[];
  changed: string[];
  other: string[]; // board-level differences (order, columns, projects, settings)
  browserCounts: { cards: number; archived: number };
  fileCounts: { cards: number; archived: number };
}

export function diffBoards(browser: BoardData, file: BoardData): BoardDiff {
  const index = (d: BoardData) => {
    const m = new Map<string, { card: CardItem; archived: boolean }>();
    d.cards.forEach((card) => m.set(card.id, { card, archived: false }));
    (d.archive || []).forEach((card) => m.set(card.id, { card, archived: true }));
    return m;
  };
  // Rank is compared separately as "order", so one move doesn't flag every card
  const content = (e: { card: CardItem; archived: boolean }) =>
    stableStringify({ ...e.card, priority: undefined, archived: e.archived });

  const a = index(browser);
  const b = index(file);
  const onlyInBrowser: string[] = [];
  const onlyInFile: string[] = [];
  const changed: string[] = [];

  a.forEach((entry, id) => {
    const other = b.get(id);
    if (!other) onlyInBrowser.push(entry.card.title);
    else if (content(entry) !== content(other)) changed.push(entry.card.title);
  });
  b.forEach((entry, id) => {
    if (!a.has(id)) onlyInFile.push(entry.card.title);
  });

  const other: string[] = [];
  // Only compare the order of cards both copies have
  const order = (d: BoardData) =>
    [...d.cards]
      .filter((c) => a.has(c.id) && b.has(c.id))
      .sort((x, y) => x.priority - y.priority)
      .map((c) => c.id)
      .join(',');
  if (order(browser) !== order(file)) other.push('Card order is different');
  if (stableStringify(browser.columns) !== stableStringify(file.columns)) other.push('Columns are different');
  if (stableStringify(browser.areas) !== stableStringify(file.areas)) other.push('Projects are different');
  if (stableStringify(browser.settings) !== stableStringify(file.settings)) other.push('Settings are different');

  return {
    identical: !onlyInBrowser.length && !onlyInFile.length && !changed.length && !other.length,
    onlyInBrowser,
    onlyInFile,
    changed,
    other,
    browserCounts: { cards: browser.cards.length, archived: (browser.archive || []).length },
    fileCounts: { cards: file.cards.length, archived: (file.archive || []).length },
  };
}
