import React, { useEffect, useRef, useState } from 'react';
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
  Maximize2,
  Minimize2,
  Clock,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { extractUrls, formatHours, getColumnRole, formatFullDate, formatCompletedAtLabel, formatDueDateLabel, getContrastColor, replaceUrlsWithLinkToken } from '../utils/helpers';
import { DescriptionFlyout } from './DescriptionFlyout';
import { formatTracked } from '../utils/workTracking';

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
  workingCardId?: string | null; // card whose timer is running
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
  workingCardId,
}) => {
  const [quickAddInput, setQuickAddInput] = useState<{ [columnId: string]: string }>({});
  const [flyoutCard, setFlyoutCard] = useState<CardItem | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState<boolean>(false);

  // Zoom mode: one column fills the board and its cards flow in a grid
  const [zoomedColumnId, setZoomedColumnId] = useState<string | null>(null);
  const zoomedColumn = columns.find((c) => c.id === zoomedColumnId) || null;
  const visibleColumns = zoomedColumn ? [zoomedColumn] : columns;

  // Escape leaves zoom mode (unless a dialog is open or the user is typing)
  useEffect(() => {
    if (!zoomedColumn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      setZoomedColumnId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomedColumn]);

  // Drag and drop state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const areaMap = new Map<string, Area>(areas.map((a) => [a.id, a]));
  const doneColumn = columns.find((c) => getColumnRole(c) === 'done');

  // Quick add submit
  const handleQuickAddSubmit = (columnId: string) => {
    const text = quickAddInput[columnId]?.trim();
    if (text) {
      onQuickAddCard(columnId, text);
      setQuickAddInput((prev) => ({ ...prev, [columnId]: '' }));
    }
  };

  // Drag handlers
  // Idle hover: if the mouse rests on a card for 15 s without moving, the card wiggles once
  const IDLE_WIGGLE_MS = 15000;
  const [wigglingCardId, setWigglingCardId] = useState<string | null>(null);
  const idleTimer = useRef<number | null>(null);

  const stopIdleTimer = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };

  const startIdleTimer = (cardId: string) => {
    stopIdleTimer();
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = null;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dialogOpen = !!document.querySelector('[role="dialog"]');
      if (reducedMotion || dialogOpen || document.hidden) return;
      setWigglingCardId(cardId);
    }, IDLE_WIGGLE_MS);
  };

  useEffect(() => stopIdleTimer, []);

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('text/plain', cardId);
    stopIdleTimer();
    setDraggedCardId(cardId);
  };

  const handleDragOverCard = (e: React.DragEvent, targetCard: CardItem) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedCardId || draggedCardId === targetCard.id) return;

    // In zoom mode cards flow left to right, so use the horizontal half
    const rect = e.currentTarget.getBoundingClientRect();
    const isBefore = zoomedColumn
      ? e.clientX - rect.left < rect.width / 2
      : e.clientY - rect.top < rect.height / 2;

    setDragOverCardId(targetCard.id);
    setDropPosition(isBefore ? 'before' : 'after');
    setDragOverColumnId(targetCard.columnId);
  };

  const handleDragOverColumn = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (!draggedCardId) return;

    // Do not highlight column if dragged card is already in this column
    const draggedCard = cards.find((c) => c.id === draggedCardId);
    if (draggedCard && draggedCard.columnId === columnId) {
      if (dragOverColumnId === columnId) {
        setDragOverColumnId(null);
      }
      return;
    }

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

    const draggedCard = cards.find((c) => c.id === cardId);
    // If dropped on the same column container without targeting a specific card, do not move to bottom
    if (draggedCard && draggedCard.columnId === targetColumnId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      setDragOverColumnId(null);
      return;
    }

    // Drop on another column container moves card to that column
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

      {/* Spring used for the zoom: the column grows, others fade, cards glide */}
      <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 380, damping: 38 }}>
      <div className="flex gap-4 items-start min-w-[900px]">
        <AnimatePresence mode="popLayout" initial={false}>
        {visibleColumns.map((column) => {
          const columnIndex = columns.findIndex((c) => c.id === column.id);
          const isZoomed = zoomedColumn?.id === column.id;
          const isDoneCol = doneColumn?.id === column.id;
          const columnCards = cards
            .filter((c) => c.columnId === column.id)
            .sort((a, b) => a.priority - b.priority);

          return (
            <motion.div
              key={column.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              style={{ borderRadius: 12 }}
              role="region"
              aria-label={`${column.name} column, ${columnCards.length} tasks`}
              className={`flex-1 ${isZoomed ? 'w-full' : 'min-w-[260px] max-w-[360px]'} bg-slate-100/80 dark:bg-slate-900/60 rounded-xl border transition-colors flex flex-col ${
                dragOverColumnId === column.id && !dragOverCardId
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                  : 'border-slate-200/80 dark:border-slate-800'
              }`}
            >
              {/* Column Header - NOT a drop target */}
              <motion.div
                layout="position"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragOverColumnId) {
                    setDragOverColumnId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraggedCardId(null);
                  setDragOverCardId(null);
                  setDragOverColumnId(null);
                }}
                onDoubleClick={() => setZoomedColumnId(isZoomed ? null : column.id)}
                title={isZoomed ? 'Double-click to show all columns' : `Double-click to zoom in on ${column.name}`}
                className="flex items-center justify-between p-3 border-b border-slate-200/80 dark:border-slate-800 select-none"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-xs text-slate-800 dark:text-slate-200 tracking-tight">
                    {column.name}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {columnCards.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setZoomedColumnId(isZoomed ? null : column.id)}
                  onDoubleClick={(e) => e.stopPropagation()}
                  title={isZoomed ? 'Back to all columns (Esc)' : `Zoom in on ${column.name}`}
                  aria-label={isZoomed ? 'Back to all columns' : `Zoom in on ${column.name}`}
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                >
                  {isZoomed ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </motion.div>

              {/* Column Cards Container - Drop zone for cards */}
              <div
                onDragOver={(e) => handleDragOverColumn(e, column.id)}
                onDrop={(e) => handleDropOnColumn(e, column.id)}
                className={`flex-1 min-h-[120px] ${
                  isZoomed
                    ? 'p-3 grid gap-3 content-start grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'
                    : 'p-2 space-y-2.5'
                }`}
              >
                {columnCards.map((card, cardIndex) => {
                  const area = card.areaId ? areaMap.get(card.areaId) : null;
                  const urls = extractUrls(card.description || '');
                  const dateInfo = formatDueDateLabel(card.dueDate, isDoneCol);
                  const completedInfo = isDoneCol ? formatCompletedAtLabel(card.completedAt) : '';
                  const isStarred = card.starred;
                  const isDropTarget = dragOverCardId === card.id;

                  return (
                    <motion.div layout="position" key={card.id} className={`relative ${isZoomed ? 'h-full' : ''}`}>
                      {/* Insertion Indicator Line (Before) */}
                      {isDropTarget && dropPosition === 'before' && (
                        <div
                          className={`absolute bg-indigo-600 rounded-full z-20 shadow-xs animate-pulse ${
                            isZoomed ? '-left-2 top-0 bottom-0 w-1' : '-top-1.5 left-0 right-0 h-1'
                          }`}
                        />
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
                        onClick={() => {
                          stopIdleTimer();
                          onOpenCardModal(card);
                        }}
                        onKeyDown={(e) => handleCardKeyDown(e, card)}
                        onMouseEnter={() => startIdleTimer(card.id)}
                        onMouseMove={() => startIdleTimer(card.id)}
                        onMouseLeave={stopIdleTimer}
                        onAnimationEnd={(e) => {
                          if (e.animationName !== 'card-idle-wiggle') return;
                          setWigglingCardId(null);
                          startIdleTimer(card.id); // still resting here: wiggle again after another 15 s
                        }}
                        className={`group relative ${isZoomed ? 'h-full flex flex-col' : ''} bg-white dark:bg-slate-800/90 rounded-xl shadow-2xs hover:shadow-md border transition-all cursor-pointer overflow-hidden p-3 pl-4 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                          draggedCardId === card.id ? 'opacity-40 scale-98' : ''
                        } ${wigglingCardId === card.id ? 'card-idle-wiggle' : ''} ${
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
                        <div className={`flex items-center justify-between gap-2 text-[11px] ${isZoomed ? 'mt-auto pt-2.5' : 'mt-2.5'}`}>
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

                            {/* Timer running on this card */}
                            {card.id === workingCardId && (
                              <span
                                title="You're working on this card (timer running)"
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 inline-flex items-center gap-1"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 working-dim" />
                                <span className="working-pulse">Working</span>
                              </span>
                            )}

                            {/* Time tracked / hour estimate */}
                            {card.estimateHours || card.trackedSeconds ? (
                              <span
                                title={[
                                  card.trackedSeconds ? `Tracked: ${formatTracked(card.trackedSeconds)}` : '',
                                  card.estimateHours ? `Estimate: ${formatHours(card.estimateHours)}` : '',
                                ].filter(Boolean).join(' · ')}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 inline-flex items-center gap-0.5"
                              >
                                <Clock className="w-3 h-3" />
                                {card.trackedSeconds ? formatTracked(card.trackedSeconds) : ''}
                                {card.trackedSeconds && card.estimateHours ? ' / ' : ''}
                                {card.estimateHours ? formatHours(card.estimateHours) : ''}
                              </span>
                            ) : null}

                            {/* Link Icons */}
                            {urls.map((u, i) => (
                              <a
                                key={i}
                                href={u}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title={`Open URL: ${u}`}
                                className="p-0.5 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ))}
                          </div>

                          {/* Right Progress Donut */}
                          <div className="shrink-0">
                            {renderProgressDonut(card.progress, isDoneCol)}
                          </div>
                        </div>
                        </div>

                      {/* Insertion Indicator Line (After) */}
                      {isDropTarget && dropPosition === 'after' && (
                        <div
                          className={`absolute bg-indigo-600 rounded-full z-20 shadow-xs animate-pulse ${
                            isZoomed ? '-right-2 top-0 bottom-0 w-1' : '-bottom-1.5 left-0 right-0 h-1'
                          }`}
                        />
                      )}
                    </motion.div>
                  );
                })}

                {/* Inline Collapsible Archive Section in Done Column */}
                {isDoneCol && archiveCards.length > 0 && (
                  <div className="col-span-full mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
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
                            title="View archived card"
                            className="p-2 rounded bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer transition-colors"
                          >
                            <div className="truncate font-medium">{archivedCard.title}</div>
                            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-slate-500 dark:text-slate-500">
                              {archivedCard.completedAt && (
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  Completed {formatFullDate(archivedCard.completedAt)}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Archive className="w-3 h-3" />
                                Archived {formatFullDate(archivedCard.archivedAt) || 'date unknown'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Add at bottom of column (NOT in Done) */}
              {!isDoneCol && (
                <motion.div layout="position" className="p-2 border-t border-slate-200/80 dark:border-slate-800">
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
                </motion.div>
              )}
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
      </MotionConfig>
    </div>
  );
};
