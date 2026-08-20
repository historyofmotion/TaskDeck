import React, { useState } from 'react';
import { Area, CardItem, Column } from '../types';
import {
  Star,
  ExternalLink,
  Plus,
  Archive,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { extractFirstUrl, formatCompletedAtLabel, formatDueDateLabel, getContrastColor, replaceUrlsWithLinkToken } from '../utils/helpers';
import { DescriptionFlyout } from './DescriptionFlyout';

interface BoardViewProps {
  columns: Column[];
  cards: CardItem[];
  areas: Area[];
  archiveCards: CardItem[];
  showDetails: boolean;
  onOpenCardModal: (card: CardItem) => void;
  onQuickAddCard: (columnId: string, title: string) => void;
  onDragDropCard: (
    draggedCardId: string,
    targetCardId: string | null,
    placeBefore: boolean,
    targetColumnId: string
  ) => void;
  onToggleStarAttempt: (cardId: string, isCurrentlyStarred: boolean, currentTitle: string) => void;
  onOpenArchivedCard: (card: CardItem) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  columns,
  cards,
  areas,
  archiveCards,
  showDetails,
  onOpenCardModal,
  onQuickAddCard,
  onDragDropCard,
  onToggleStarAttempt,
  onOpenArchivedCard,
}) => {
  const [quickAddInput, setQuickAddInput] = useState<{ [columnId: string]: string }>({});
  const [flyoutCard, setFlyoutCard] = useState<CardItem | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);

  // Drag and drop state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const areaMap = new Map<string, Area>(areas.map((a) => [a.id, a]));
  const doneColumn = columns.find((c) => c.name.toLowerCase() === 'done');

  // Quick add submit
  const handleQuickAddSubmit = (columnId: string) => {
    const text = quickAddInput[columnId]?.trim();
    if (text) {
      onQuickAddCard(columnId, text);
      setQuickAddInput((prev) => ({ ...prev, [columnId]: '' }));
    }
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('text/plain', cardId);
    setDraggedCardId(cardId);
  };

  const handleDragOverCard = (e: React.DragEvent, targetCard: CardItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCardId || draggedCardId === targetCard.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const isBefore = offsetY < rect.height / 2;

    setDragOverCardId(targetCard.id);
    setDropPosition(isBefore ? 'before' : 'after');
    setDragOverColumnId(targetCard.columnId);
  };

  const handleDragOverColumn = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (!draggedCardId) return;
    setDragOverColumnId(columnId);
  };

  const handleDropOnCard = (e: React.DragEvent, targetCard: CardItem) => {
    e.preventDefault();
    e.stopPropagation();

    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId || cardId === targetCard.id) return;

    onDragDropCard(
      cardId,
      targetCard.id,
      dropPosition === 'before',
      targetCard.columnId
    );

    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverColumnId(null);
  };

  const handleDropOnColumn = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();

    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    // Drop on column container directly sets target card to null
    onDragDropCard(
      cardId,
      null,
      false,
      targetColumnId
    );

    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverColumnId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverColumnId(null);
  };

  // Keyboard navigation for card reordering & modal opening
  const handleCardKeyDown = (e: React.KeyboardEvent, card: CardItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenCardModal(card);
      return;
    }

    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      const sortedAllCards = [...cards].sort((a, b) => a.priority - b.priority);
      const cardIdx = sortedAllCards.findIndex((c) => c.id === card.id);
      if (cardIdx > 0) {
        const prevCard = sortedAllCards[cardIdx - 1];
        onDragDropCard(card.id, prevCard.id, true, card.columnId);
      }
      return;
    }

    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const sortedAllCards = [...cards].sort((a, b) => a.priority - b.priority);
      const cardIdx = sortedAllCards.findIndex((c) => c.id === card.id);
      if (cardIdx < sortedAllCards.length - 1) {
        const nextCard = sortedAllCards[cardIdx + 1];
        onDragDropCard(card.id, nextCard.id, false, card.columnId);
      }
      return;
    }

    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      handleMoveLeft(card);
      return;
    }

    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      handleMoveRight(card);
      return;
    }
  };

  const handleMoveToTop = (card: CardItem) => {
    const colCards = cards
      .filter((c) => c.columnId === card.columnId)
      .sort((a, b) => a.priority - b.priority);
    if (colCards.length > 0 && colCards[0].id !== card.id) {
      onDragDropCard(card.id, colCards[0].id, true, card.columnId);
    }
  };

  const handleMoveToBottom = (card: CardItem) => {
    const colCards = cards
      .filter((c) => c.columnId === card.columnId)
      .sort((a, b) => a.priority - b.priority);
    if (colCards.length > 0 && colCards[colCards.length - 1].id !== card.id) {
      onDragDropCard(card.id, colCards[colCards.length - 1].id, false, card.columnId);
    }
  };

  const handleMoveLeft = (card: CardItem) => {
    const colIdx = columns.findIndex((c) => c.id === card.columnId);
    if (colIdx > 0) {
      const prevColId = columns[colIdx - 1].id;
      const targetColCards = cards
        .filter((c) => c.columnId === prevColId)
        .sort((a, b) => a.priority - b.priority);
      if (targetColCards.length > 0) {
        onDragDropCard(card.id, targetColCards[0].id, true, prevColId);
      } else {
        onDragDropCard(card.id, null, false, prevColId);
      }
    }
  };

  const handleMoveRight = (card: CardItem) => {
    const colIdx = columns.findIndex((c) => c.id === card.columnId);
    if (colIdx < columns.length - 1) {
      const nextColId = columns[colIdx + 1].id;
      const targetColCards = cards
        .filter((c) => c.columnId === nextColId)
        .sort((a, b) => a.priority - b.priority);
      if (targetColCards.length > 0) {
        onDragDropCard(card.id, targetColCards[targetColCards.length - 1].id, false, nextColId);
      } else {
        onDragDropCard(card.id, null, false, nextColId);
      }
    }
  };

  // Render SVG Progress Donut
  const renderProgressDonut = (pct: number, isDone: boolean) => {
    const val = isDone ? 100 : Math.max(0, Math.min(100, pct));

    const radius = 6;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (val / 100) * circumference;

    return (
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0" title={`${val}% complete`}>
        <svg className="w-4 h-4 transform -rotate-90">
          <circle
            cx="8"
            cy="8"
            r={radius}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="2"
            fill="transparent"
          />
          {val > 0 && (
            <circle
              cx="8"
              cy="8"
              r={radius}
              className="stroke-indigo-600 dark:stroke-indigo-400 transition-all duration-300"
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          )}
        </svg>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 pb-8 overflow-x-auto">
      {flyoutCard && (
        <DescriptionFlyout
          title={flyoutCard.title}
          description={flyoutCard.description}
          onClose={() => setFlyoutCard(null)}
        />
      )}

      <div className="flex gap-4 items-start min-w-[900px]">
        {columns.map((column, columnIndex) => {
          const isDoneCol = doneColumn?.id === column.id;
          const columnCards = cards
            .filter((c) => c.columnId === column.id)
            .sort((a, b) => a.priority - b.priority);

          return (
            <div
              key={column.id}
              role="region"
              aria-label={`${column.name} column, ${columnCards.length} tasks`}
              onDragOver={(e) => handleDragOverColumn(e, column.id)}
              onDrop={(e) => handleDropOnColumn(e, column.id)}
              className={`flex-1 min-w-[260px] max-w-[360px] bg-slate-100/80 dark:bg-slate-900/60 rounded-xl border transition-all flex flex-col ${
                dragOverColumnId === column.id && !dragOverCardId
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                  : 'border-slate-200/80 dark:border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between p-3 border-b border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-xs text-slate-800 dark:text-slate-200 tracking-tight">
                    {column.name}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {columnCards.length}
                  </span>
                </div>
              </div>

              {/* Column Cards Container */}
              <div className="p-2 space-y-2.5 flex-1 min-h-[120px]">
                {columnCards.map((card, cardIndex) => {
                  const area = card.areaId ? areaMap.get(card.areaId) : null;
                  const url = extractFirstUrl(card.description || '');
                  const dateInfo = formatDueDateLabel(card.dueDate, isDoneCol);
                  const completedInfo = isDoneCol ? formatCompletedAtLabel(card.completedAt) : '';
                  const isStarred = card.starred;
                  const isDropTarget = dragOverCardId === card.id;

                  return (
                    <div key={card.id} className="relative">
                      {/* Insertion Indicator Line (Before) */}
                      {isDropTarget && dropPosition === 'before' && (
                        <div className="absolute -top-1.5 left-0 right-0 h-1 bg-indigo-600 rounded-full z-20 shadow-xs animate-pulse" />
                      )}

                      {/* Card Tile */}
                      <div
                        tabIndex={0}
                        role="button"
                        aria-label={`Task #${card.priority}: ${card.title}. Column ${column.name}. ${area ? 'Project ' + area.name + '.' : ''} Progress ${isDoneCol ? 100 : card.progress}%. ${dateInfo.label ? dateInfo.label + '.' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        onDragOver={(e) => handleDragOverCard(e, card)}
                        onDrop={(e) => handleDropOnCard(e, card)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onOpenCardModal(card)}
                        onKeyDown={(e) => handleCardKeyDown(e, card)}
                        className={`group relative bg-white dark:bg-slate-800/90 rounded-xl shadow-2xs hover:shadow-md border transition-all cursor-pointer overflow-hidden p-3 pl-4 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                          draggedCardId === card.id ? 'opacity-40 scale-98' : ''
                        } ${
                          isStarred
                            ? 'border-amber-300 dark:border-amber-600/80 ring-1 ring-amber-400/40'
                            : 'border-slate-200/90 dark:border-slate-700/80'
                        }`}
                      >
                        {/* Project Color Vertical Accent Bar on Left */}
                        {area && (
                          <div
                            className="absolute top-0 bottom-0 left-0 w-1 rounded-l-xl"
                            style={{ backgroundColor: area.color }}
                          />
                        )}

                        {/* Quick Move Action Toolbar (Reveals on Hover) */}
                        <div
                          className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute top-1.5 right-7 z-10 flex items-center gap-0.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xs p-0.5 rounded-lg border border-slate-200/90 dark:border-slate-700/90 shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Move to Top */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveToTop(card);
                            }}
                            disabled={cardIndex === 0}
                            title="Move to top"
                            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/70 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                          >
                            <ArrowUpToLine className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Left */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveLeft(card);
                            }}
                            disabled={columnIndex === 0}
                            title={columnIndex > 0 ? `Move to top of ${columns[columnIndex - 1].name} (Alt+←)` : 'No column to left'}
                            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/70 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Right */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveRight(card);
                            }}
                            disabled={columnIndex === columns.length - 1}
                            title={columnIndex < columns.length - 1 ? `Move to bottom of ${columns[columnIndex + 1].name} (Alt+→)` : 'No column to right'}
                            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/70 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Move to Bottom */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveToBottom(card);
                            }}
                            disabled={cardIndex === columnCards.length - 1}
                            title="Move to bottom"
                            className="p-1 rounded text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700/70 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* TOP ROW: Title on left, Star top-right */}
                        <div className="flex items-start justify-between gap-2 mb-1.5 pt-0.5">
                          <h4
                            className={`font-semibold text-xs leading-snug break-words flex-1 min-w-0 ${
                              isDoneCol
                                ? 'line-through text-slate-400 dark:text-slate-500'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {card.title}
                          </h4>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStarAttempt(card.id, isStarred, card.title);
                            }}
                            title={isStarred ? 'Unstar item' : 'Star item'}
                            className={`shrink-0 p-0.5 -mr-0.5 -mt-0.5 rounded hover:scale-110 transition-transform ${
                              isStarred
                                ? 'text-amber-400'
                                : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                        </div>

                        {/* MIDDLE ROW: Description text */}
                        {showDetails && !isDoneCol && card.description && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setFlyoutCard(card);
                            }}
                            title="Click to view full description"
                            className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 my-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer font-normal leading-relaxed"
                          >
                            {replaceUrlsWithLinkToken(card.description)}
                          </div>
                        )}

                        {/* BOTTOM ROW: Rank #, Project Badge, Due Date, Link Icon on left; Progress Donut on right */}
                        <div className="flex items-center justify-between gap-2 mt-2.5 text-[11px]">
                          {/* Left Meta Items */}
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {/* Priority Rank Badge (#5) */}
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/60 font-semibold text-slate-500 dark:text-slate-400 text-[10px] shrink-0">
                              #{card.priority}
                            </span>

                            {/* Project Badge */}
                            {area && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shadow-2xs shrink-0"
                                style={{ backgroundColor: area.color, color: getContrastColor(area.color) }}
                              >
                                {area.name}
                              </span>
                            )}

                            {/* Completed Date or Due Date Badge */}
                            {isDoneCol && completedInfo ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-slate-100 text-slate-500 dark:bg-slate-700/80 dark:text-slate-400 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>{completedInfo}</span>
                              </span>
                            ) : dateInfo.label ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                  dateInfo.isOverdue
                                    ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 font-bold'
                                    : dateInfo.isToday
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-semibold'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {dateInfo.label}
                              </span>
                            ) : null}

                            {/* Link Icon */}
                            {url && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Open URL: ${url}`}
                                className="p-0.5 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          {/* Right Progress Donut */}
                          <div className="shrink-0">
                            {renderProgressDonut(card.progress, isDoneCol)}
                          </div>
                        </div>
                        </div>

                      {/* Insertion Indicator Line (After) */}
                      {isDropTarget && dropPosition === 'after' && (
                        <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-indigo-600 rounded-full z-20 shadow-xs animate-pulse" />
                      )}
                    </div>
                  );
                })}

                {/* Inline Collapsible Archive Section in Done Column */}
                {isDoneCol && archiveCards.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setIsArchiveOpen(!isArchiveOpen)}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archived ({archiveCards.length})</span>
                      </span>
                      {isArchiveOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isArchiveOpen && (
                      <div className="mt-2 space-y-1.5 pl-1">
                        {archiveCards.map((archivedCard) => (
                          <div
                            key={archivedCard.id}
                            onClick={() => onOpenArchivedCard(archivedCard)}
                            className="p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer transition-colors flex items-center justify-between"
                          >
                            <span className="truncate pr-2">{archivedCard.title}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">View</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Add at bottom of column (NOT in Done) */}
              {!isDoneCol && (
                <div className="p-2 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={quickAddInput[column.id] || ''}
                      onChange={(e) =>
                        setQuickAddInput((prev) => ({
                          ...prev,
                          [column.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQuickAddSubmit(column.id);
                      }}
                      placeholder="+ Quick add card..."
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {quickAddInput[column.id]?.trim() && (
                      <button
                        onClick={() => handleQuickAddSubmit(column.id)}
                        className="p-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
