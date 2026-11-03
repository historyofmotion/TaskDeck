import React from 'react';
import { CardItem, Column } from '../types';
import { Star } from 'lucide-react';
import { getColumnRole } from '../utils/helpers';

interface ActionLineProps {
  cards: CardItem[];
  columns: Column[];
  onOpenCard: (cardId: string) => void;
}

// Starred cards (max 3), pinned under the top bar in rank order. Finished ones are left out; with none, nothing shows.
export const ActionLine: React.FC<ActionLineProps> = ({ cards, columns, onOpenCard }) => {
  const doneColId = columns.find((c) => getColumnRole(c) === 'done')?.id;
  const starredCards = cards
    .filter((c) => c.columnId !== doneColId && c.starred)
    .sort((a, b) => a.priority - b.priority);
  if (starredCards.length === 0) return null;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 py-1.5 mb-2">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium bg-slate-100/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50 rounded-lg px-3 py-1.5 shadow-2xs">
        <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[10px] tracking-wider mr-1 shrink-0">
          Focus:
        </span>
        {starredCards.map((card) => (
          <button
            key={card.id}
            onClick={() => onOpenCard(card.id)}
            title={`Starred: #${card.priority} ${card.title}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/50 hover:border-amber-400 dark:hover:border-amber-600 transition-colors cursor-pointer max-w-[220px]"
          >
            <Star className="w-3.5 h-3.5 shrink-0 fill-amber-400 text-amber-500" />
            <span className="truncate">{card.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
