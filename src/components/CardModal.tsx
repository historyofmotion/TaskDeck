import React, { useState, useEffect } from 'react';
import { Area, CardItem, Column } from '../types';
import { Star, ExternalLink, Archive, Trash2, X, Calendar, Layers, SlidersHorizontal, Check, Clock, Play, Square } from 'lucide-react';
import { extractUrls, formatHours, getDoneColumnId } from '../utils/helpers';
import { useModalAccessibility } from '../utils/useModalAccessibility';
import { formatTracked } from '../utils/workTracking';

interface CardModalProps {
  card: CardItem | null; // null if creating a new card
  initialColumnId?: string;
  columns: Column[];
  areas: Area[];
  onSave: (cardData: Partial<CardItem>) => void;
  onDelete?: (cardId: string) => void;
  onArchive?: (cardId: string) => void;
  onClose: () => void;
  onToggleStarAttempt: (cardId: string | null, isCurrentlyStarred: boolean, currentTitle: string) => void;
  isStarredState: boolean;
  isWorking?: boolean; // this card's timer is running
  onStartWork?: (cardId: string) => void;
  onStopWork?: () => void;
}

export const CardModal: React.FC<CardModalProps> = ({
  card,
  initialColumnId,
  columns,
  areas,
  onSave,
  onDelete,
  onArchive,
  onClose,
  onToggleStarAttempt,
  isStarredState,
  isWorking,
  onStartWork,
  onStopWork,
}) => {
  const [title, setTitle] = useState(card?.title || '');
  const [description, setDescription] = useState(card?.description || '');
  const [areaId, setAreaId] = useState<string | null>(card ? card.areaId : null);
  const getInitialColumnId = (): string => {
    if (card && columns.some((c) => c.id === card.columnId)) {
      return card.columnId;
    }
    if (initialColumnId && columns.some((c) => c.id === initialColumnId)) {
      return initialColumnId;
    }
    return columns[0]?.id || 'c1';
  };

  const [columnId, setColumnId] = useState<string>(getInitialColumnId());
  const [dueDate, setDueDate] = useState<string>(card?.dueDate || '');
  const [progress, setProgress] = useState<number>(card ? card.progress : 0);
  const [estimate, setEstimate] = useState<string>(card?.estimateHours ? String(card.estimateHours) : '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [starred, setStarred] = useState<boolean>(card ? card.starred : isStarredState);

  const modalRef = useModalAccessibility(true, onClose);
  const backdropMouseDownRef = React.useRef<EventTarget | null>(null);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
      handleSaveAndClose();
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    setStarred(card ? card.starred : isStarredState);
  }, [card, isStarredState]);

  const handleToggleStarInModal = () => {
    onToggleStarAttempt(card?.id || null, starred, title || 'New Task');
  };

  const doneColId = getDoneColumnId(columns);
  const isDoneStatus = columnId === doneColId;

  const urlsInDescription = extractUrls(description);

  const ESTIMATE_PRESETS = [0.25, 0.5, 1, 2, 4, 8];
  const parseEstimate = (text: string): number | null => {
    const n = parseFloat(text);
    return isFinite(n) && n > 0 ? Math.min(n, 1000) : null;
  };

  // Auto-save on backdrop click / close
  const handleSaveAndClose = () => {
    if (!title.trim()) {
      onClose(); // Discard empty card
      return;
    }

    onSave({
      id: card?.id,
      title: title.trim(),
      description: description.trim(),
      areaId,
      columnId,
      dueDate: dueDate || null,
      progress,
      estimateHours: parseEstimate(estimate),
      starred: starred,
      completedAt: isDoneStatus
        ? card?.completedAt || new Date().toISOString()
        : null,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2">
            <span id="card-modal-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {card ? `Card #${card.priority}` : 'New Card'}
            </span>

            <button
              type="button"
              onClick={handleToggleStarInModal}
              title={starred ? 'Unstar task' : 'Star task (Max 3 focus cards)'}
              className={`p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${
                starred
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Star className={`w-5 h-5 ${starred ? 'fill-amber-400 text-amber-500' : ''}`} />
            </button>
          </div>

          <button
            onClick={handleSaveAndClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with px-2 padding so active rings/borders are never clipped */}
        <div className="py-4 px-2 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAndClose();
              }}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium"
            />
          </div>

          {/* Area & Due Date (Side by side) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Project Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Project</span>
              </label>
              <select
                value={areaId || ''}
                onChange={(e) => setAreaId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
              >
                <option value="">No Project</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Due Date</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
              />
            </div>
          </div>

          {/* Status Column & Progress Slider */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Status Column */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Column / Status
              </label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer font-medium"
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Progress Slider */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Progress</span>
                </span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{isDoneStatus ? '100%' : `${progress}%`}</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                disabled={isDoneStatus}
                value={isDoneStatus ? 100 : progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Hour estimate */}
          <div>
            <label htmlFor="card-estimate" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Estimate (hours to finish)</span>
              {card?.trackedSeconds ? (
                <span className="ml-auto font-normal text-slate-500 dark:text-slate-400">
                  {formatTracked(card.trackedSeconds)} tracked so far
                </span>
              ) : null}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                id="card-estimate"
                type="number"
                min="0"
                step="0.25"
                inputMode="decimal"
                placeholder="—"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                className="w-20 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              {ESTIMATE_PRESETS.map((h) => {
                const active = parseEstimate(estimate) === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setEstimate(active ? '' : String(h))}
                    aria-pressed={active}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {formatHours(h)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description & Links
              </label>
              {urlsInDescription.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {urlsInDescription.map((u, i) => (
                    <a
                      key={i}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={u}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>{urlsInDescription.length > 1 ? `Link ${i + 1}` : 'Open URL'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or links (e.g. https://...)"
              className="w-full px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Delete button (if editing existing card) */}
            {card && onDelete && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-red-500 font-medium">Confirm delete?</span>
                    <button
                      type="button"
                      onClick={() => onDelete(card.id)}
                      className="px-2 py-1 text-[11px] bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1 text-[11px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </>
            )}

            {/* Timer: start working on this card, or stop it */}
            {card && !isDoneStatus && onStartWork && (
              isWorking ? (
                <button
                  type="button"
                  onClick={() => onStopWork?.()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                  title="Stop the timer and record the time on this card"
                >
                  <Square className="w-3 h-3" />
                  <span>Stop timer</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartWork(card.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Start the timer: you're working on this card now"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start working</span>
                </button>
              )
            )}

            {/* Archive button: ONLY appears when card status is Done! */}
            {card && isDoneStatus && onArchive && (
              <button
                type="button"
                onClick={() => {
                  onArchive(card.id);
                  onClose();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Archive className="w-3.5 h-3.5 text-slate-500" />
                <span>Archive Now</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
