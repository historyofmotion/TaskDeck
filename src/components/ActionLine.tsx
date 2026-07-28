import React from 'react';
import { CardItem, Column } from '../types';
import { AlertCircle, Calendar, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { formatDueDateLabel } from '../utils/helpers';

interface ActionLineProps {
  cards: CardItem[];
  columns: Column[];
  onOpenCard: (cardId: string) => void;
}

export const ActionLine: React.FC<ActionLineProps> = ({ cards, columns, onOpenCard }) => {
  const doneColId = columns.find((c) => c.name.toLowerCase() === 'done')?.id;
  const blockedColId = columns.find((c) => c.name.toLowerCase() === 'blocked')?.id;

  const activeCards = cards.filter((c) => c.columnId !== doneColId);

  // Overdue count
  const overdueCards = activeCards.filter((c) => {
    if (!c.dueDate) return false;
    const { isOverdue } = formatDueDateLabel(c.dueDate);
    return isOverdue;
  });

  // Next due card
  const cardsWithDueDate = activeCards
    .filter((c) => c.dueDate)
    .sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1));
  const nextDueCard = cardsWithDueDate.length > 0 ? cardsWithDueDate[0] : null;

  // Next up card: lowest priority rank among actionable cards (not done and not blocked)
  const actionableCards = activeCards
    .filter((c) => c.columnId !== blockedColId)
    .sort((a, b) => a.priority - b.priority);
  const nextUpCard = actionableCards.length > 0 ? actionableCards[0] : null;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-1.5 mb-2">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium bg-slate-100/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50 rounded-lg px-3 py-1.5 shadow-2xs">
        <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[10px] tracking-wider mr-1 shrink-0">
          Focus:
        </span>

        {/* Overdue chip */}
        {overdueCards.length > 0 ? (
          <button
            onClick={() => onOpenCard(overdueCards[0].id)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 transition-colors cursor-pointer"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-400" />
            <span>
              <strong>{overdueCards.length}</strong> Overdue
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>All clear</span>
          </div>
        )}

        {/* Next Due chip */}
        {nextDueCard && (
          <button
            onClick={() => onOpenCard(nextDueCard.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer truncate max-w-xs sm:max-w-sm md:max-w-md flex-1 min-w-[200px]"
            title={`Next Due: ${nextDueCard.title}`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span className="truncate">
              Next due: <strong className="font-semibold">{nextDueCard.title}</strong> ({formatDueDateLabel(nextDueCard.dueDate).label})
            </span>
          </button>
        )}

        {/* Next Up chip */}
        {nextUpCard && (
          <button
            onClick={() => onOpenCard(nextUpCard.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer truncate max-w-xs sm:max-w-sm md:max-w-md flex-1 min-w-[200px]"
            title={`Next Up: ${nextUpCard.title}`}
          >
            <ArrowRightCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span className="truncate">
              Next up: <strong className="font-semibold">#{nextUpCard.priority} {nextUpCard.title}</strong>
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
