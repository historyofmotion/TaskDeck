import { BoardData, CardItem, Column } from '../types';

// URL regex to detect http/https links
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

export function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
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

export function formatDueDateLabel(dateStr: string | null): {
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
    return { label: `${formattedDate} (Overdue)`, isOverdue: true, isToday: false };
  } else if (diffDays === 0) {
    return { label: 'Due Today', isOverdue: false, isToday: true };
  } else if (diffDays === 1) {
    return { label: 'Due Tomorrow', isOverdue: false, isToday: false };
  } else {
    return { label: `Due ${formattedDate}`, isOverdue: false, isToday: false };
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

  const [draggedCard] = cards.splice(draggedIndex, 1);
  if (targetColumnId) {
    draggedCard.columnId = targetColumnId;
  }

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

  const [dragged] = cards.splice(draggedIndex, 1);
  dragged.columnId = targetColumnId;
  if (targetColumnId === doneColumnId && !dragged.completedAt) {
    dragged.completedAt = new Date().toISOString();
  } else if (targetColumnId !== doneColumnId) {
    dragged.completedAt = null;
  }

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
      const pct = card.columnId === (data.columns.find((c) => c.name.toLowerCase() === 'done')?.id || 'c4')
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
  const doneColumn = data.columns.find((c) => c.name.toLowerCase() === 'done');
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
