import React, { useState } from 'react';
import { Area, CardItem, Column } from '../types';
import { Star, GripVertical, Calendar, ExternalLink, CheckCircle2, Menu, ListOrdered, Eye } from 'lucide-react';
import { extractFirstUrl, formatDueDateLabel, getContrastColor } from '../utils/helpers';

interface ListViewProps {
  cards: CardItem[];
  columns: Column[];
  areas: Area[];
  showDetails: boolean; // Controls whether card descriptions are shown or hidden
  onOpenCardModal: (card: CardItem) => void;
  onToggleDetails?: () => void;
  onDragDropCard: (
    draggedCardId: string,
    targetCardId: string | null,
    placeBefore: boolean,
    targetColumnId: string
  ) => void;
  onToggleStarAttempt: (cardId: string, isCurrentlyStarred: boolean, currentTitle: string) => void;
  onReorderAllCards?: (newCards: CardItem[]) => void;
}

export const ListView: React.FC<ListViewProps> = ({
  cards,
  columns,
  areas,
  showDetails,
  onOpenCardModal,
  onToggleDetails,
  onDragDropCard,
  onToggleStarAttempt,
  onReorderAllCards,
}) => {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const areaMap = new Map<string, Area>(areas.map((a) => [a.id, a]));
  const columnMap = new Map<string, Column>(columns.map((c) => [c.id, c]));
  const doneColId = columns.find((c) => c.name.toLowerCase() === 'done')?.id;

  // Active cards sorted by priority, followed by Done cards at the bottom
  const activeCards = cards
    .filter((c) => c.columnId !== doneColId)
    .sort((a, b) => a.priority - b.priority);

  const doneCards = cards
    .filter((c) => c.columnId === doneColId)
    .sort((a, b) => a.priority - b.priority);

  const visibleCards = [...activeCards, ...doneCards];

  const getStatusColorDot = (colId: string, isDoneItem: boolean) => {
    if (isDoneItem) return 'bg-slate-300 dark:bg-slate-700';
    const colName = columnMap.get(colId)?.name.toLowerCase() || '';
    if (colName.includes('pending')) return 'bg-slate-400';
    if (colName.includes('progress')) return 'bg-blue-500';
    if (colName.includes('blocked')) return 'bg-amber-500';
    if (colName.includes('done')) return 'bg-emerald-500';
    return 'bg-purple-500';
  };

  // Renumber/Reorder cards by status priority sequence: In Progress -> Blocked -> Pending -> Done
  const handleRenumberByStatus = () => {
    if (!onReorderAllCards) return;

    const getStatusCategoryOrder = (columnId: string): number => {
      const colName = (columnMap.get(columnId)?.name || '').toLowerCase();
      if (colName.includes('progress') || colName.includes('in progress')) return 1;
      if (colName.includes('blocked')) return 2;
      if (colName.includes('pending')) return 3;
      if (colName.includes('done')) return 4;
      return 5;
    };

    const sorted = [...cards].sort((a, b) => {
      const catA = getStatusCategoryOrder(a.columnId);
      const catB = getStatusCategoryOrder(b.columnId);
      if (catA !== catB) {
        return catA - catB;
      }
      return a.priority - b.priority;
    });

    const renumbered = sorted.map((card, idx) => ({
      ...card,
      priority: idx + 1,
    }));

    onReorderAllCards(renumbered);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCardId(cardId);
  };

  const handleDragOverRow = (e: React.DragEvent, targetCard: CardItem) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const currentDraggedId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (currentDraggedId === targetCard.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const isBefore = offsetY < rect.height / 2;

    setDragOverCardId(targetCard.id);
    setDropPosition(isBefore ? 'before' : 'after');
  };

  const handleDrop = (e: React.DragEvent, targetCard: CardItem) => {
    e.preventDefault();
    e.stopPropagation();

    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId || cardId === targetCard.id) return;

    const draggedCard = cards.find((c) => c.id === cardId);
    const keepColumnId = draggedCard ? draggedCard.columnId : targetCard.columnId;

    onDragDropCard(
      cardId,
      targetCard.id,
      dropPosition === 'before',
      keepColumnId
    );

    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 pb-8">
      {/* List Top Bar Header with Hamburger Menu */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
            Tasks Overview
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {cards.length}
          </span>
        </div>

        {/* Hamburger Menu Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            title="List Options Menu"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5 text-xs font-semibold shadow-2xs"
          >
            <Menu className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="hidden sm:inline">List Menu</span>
          </button>

          {isMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsMenuOpen(false)}
              />

              {/* Menu Popover */}
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80">
                  List View Actions
                </div>

                {/* Reorder / Renumber Action */}
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleRenumberByStatus();
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-start gap-2.5 transition-colors group"
                >
                  <ListOrdered className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="font-semibold">Renumber by Status</div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 font-normal leading-tight mt-0.5">
                      Reorder: In Progress → Blocked → Pending → Done
                    </div>
                  </div>
                </button>

                {/* Toggle Descriptions Action */}
                {onToggleDetails && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onToggleDetails();
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors border-t border-slate-100 dark:border-slate-800/60"
                  >
                    <Eye className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{showDetails ? 'Hide Card Descriptions' : 'Show Card Descriptions'}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200/90 dark:border-slate-800 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider items-center">
          <div className="col-span-1 flex items-center gap-1">
            <span>Rank</span>
          </div>
          <div className="col-span-5 sm:col-span-4 md:col-span-5 lg:col-span-5">Task & Notes</div>
          <div className="col-span-2 sm:col-span-2 md:col-span-1 lg:col-span-1">Status</div>
          <div className="col-span-2 hidden sm:block md:block lg:block">Project</div>
          <div className="col-span-4 sm:col-span-3 md:col-span-3 lg:col-span-3 text-right">Progress & Due</div>
        </div>

        {/* Rows */}
        {visibleCards.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 italic">
            No cards match the current view or filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleCards.map((card, index) => {
              const area = card.areaId ? areaMap.get(card.areaId) : null;
              const column = columnMap.get(card.columnId);
              const isBlocked = column?.name.toLowerCase().includes('blocked');
              const isDone = column?.id === doneColId;
              const isFirstDoneCard = isDone && (index === 0 || visibleCards[index - 1].columnId !== doneColId);
              const dateInfo = formatDueDateLabel(card.dueDate);
              const url = extractFirstUrl(card.description || '');
              const isDropTarget = dragOverCardId === card.id;

              return (
                <React.Fragment key={card.id}>
                  {/* Completed Section Header */}
                  {isFirstDoneCard && (
                    <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-800/50 border-y border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>Completed ({doneCards.length})</span>
                    </div>
                  )}

                  <div className="relative group">
                    {/* Drop line before */}
                    {isDropTarget && dropPosition === 'before' && (
                      <div className="absolute -top-0.5 left-0 right-0 h-1 bg-indigo-600 z-20 shadow-xs" />
                    )}

                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragOver={(e) => handleDragOverRow(e, card)}
                      onDrop={(e) => handleDrop(e, card)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onOpenCardModal(card)}
                      className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center transition-colors cursor-pointer text-xs ${
                        isDone
                          ? 'bg-slate-50/40 dark:bg-slate-900/20 text-slate-400 dark:text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      } ${draggedCardId === card.id ? 'opacity-40' : ''}`}
                    >
                      {/* Rank & Drag Handle & Star */}
                      <div className="col-span-1 flex items-center gap-1.5 shrink-0">
                        <GripVertical className={`w-3.5 h-3.5 shrink-0 cursor-grab active:cursor-grabbing ${
                          isDone ? 'text-slate-300 dark:text-slate-700' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                        }`} />

                        <span className={`font-bold text-[11px] min-w-[20px] ${
                          isDone ? 'text-slate-400 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          #{card.priority}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStarAttempt(card.id, card.starred, card.title);
                          }}
                          className={`p-0.5 rounded transition-transform hover:scale-110 ${
                            card.starred
                              ? isDone ? 'text-amber-500/60' : 'text-amber-500'
                              : isDone ? 'text-slate-300 dark:text-slate-700 hover:text-amber-500/70' : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${card.starred ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>

                      {/* Title & Description (PRIMARY COLUMN) */}
                      <div className="col-span-5 sm:col-span-4 md:col-span-5 lg:col-span-5 min-w-0 pr-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`font-semibold truncate ${
                              isDone
                                ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {card.title}
                          </span>
                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`p-0.5 rounded shrink-0 ${
                                isDone
                                  ? 'text-slate-400 dark:text-slate-600 hover:text-indigo-500'
                                  : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
                              }`}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        {showDetails && card.description && (
                          <p className={`text-[11px] truncate mt-0.5 ${
                            isDone ? 'text-slate-400 dark:text-slate-600 font-normal' : 'text-slate-500 dark:text-slate-400'
                          }`}>
                            {card.description}
                          </p>
                        )}
                      </div>

                      {/* Status / Column */}
                      <div className="col-span-2 sm:col-span-2 md:col-span-1 lg:col-span-1 flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColorDot(card.columnId, isDone)}`} />
                        <span
                          className={`font-semibold text-xs truncate ${
                            isDone
                              ? 'line-through text-slate-400 dark:text-slate-500 font-normal'
                              : isBlocked
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {column?.name || 'Unknown'}
                        </span>
                      </div>

                      {/* Area / Project */}
                      <div className="col-span-2 hidden sm:flex md:flex lg:flex items-center min-w-0">
                        {area ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold shadow-2xs truncate ${
                              isDone ? 'opacity-50 grayscale-[30%]' : ''
                            }`}
                            style={{ backgroundColor: area.color, color: getContrastColor(area.color) }}
                          >
                            {area.name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        )}
                      </div>

                      {/* Combined Progress & Due Date Column (Distinct Right-Justified Separation) */}
                      <div className="col-span-4 sm:col-span-3 md:col-span-3 lg:col-span-3 flex items-center justify-end gap-3 sm:gap-4 text-right">
                        {/* Optional Due Date */}
                        <div className="flex items-center justify-end min-w-0">
                          {dateInfo.label ? (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                isDone
                                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 font-normal'
                                  : dateInfo.isOverdue
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 font-bold'
                                  : dateInfo.isToday
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-semibold'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              <Calendar className="w-3 h-3" />
                              <span className="truncate">{dateInfo.label}</span>
                            </span>
                          ) : null}
                        </div>

                        {/* Subtle Divider when Due Date is present */}
                        {dateInfo.label && (
                          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700/80 shrink-0 hidden sm:block" />
                        )}

                        {/* Progress (ALWAYS SHOWN & FIXED WIDTH SLOT AT FAR RIGHT) */}
                        <div className="flex items-center justify-end gap-1.5 w-20 shrink-0">
                          <div className="w-12 lg:w-14 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div
                              className={`h-full rounded-full ${
                                isDone ? 'bg-slate-300 dark:bg-slate-700' : 'bg-indigo-600 dark:bg-indigo-400'
                              }`}
                              style={{ width: `${isDone ? 100 : card.progress}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-mono font-medium w-7 text-right shrink-0 ${
                            isDone ? 'text-slate-400 dark:text-slate-600' : 'text-slate-400'
                          }`}>
                            {isDone ? 100 : card.progress}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Drop line after */}
                    {isDropTarget && dropPosition === 'after' && (
                      <div className="absolute -bottom-0.5 left-0 right-0 h-1 bg-indigo-600 z-20 shadow-xs" />
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
