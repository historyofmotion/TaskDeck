import React from 'react';
import { CardItem } from '../types';
import { Archive, RotateCcw, Trash2, X, ExternalLink } from 'lucide-react';
import { extractFirstUrl } from '../utils/helpers';
import { useModalAccessibility } from '../utils/useModalAccessibility';

interface ArchivedCardModalProps {
  card: CardItem;
  onRestore: (cardId: string) => void;
  onDeletePermanent: (cardId: string) => void;
  onClose: () => void;
}

export const ArchivedCardModal: React.FC<ArchivedCardModalProps> = ({
  card,
  onRestore,
  onDeletePermanent,
  onClose,
}) => {
  const modalRef = useModalAccessibility(true, onClose);
  const urlInDescription = extractFirstUrl(card.description || '');

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archived-card-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              <Archive className="w-4 h-4" />
            </span>
            <span id="archived-card-modal-title" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Archived Task
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-snug">
            {card.title}
          </h3>

          {card.description ? (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-100 dark:border-slate-800">
              {card.description}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No description provided.</p>
          )}

          {urlInDescription && (
            <a
              href={urlInDescription}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <span>{urlInDescription}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {card.archivedAt && (
            <p className="text-[11px] text-slate-400">
              Archived on {new Date(card.archivedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => {
              onDeletePermanent(card.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Permanently</span>
          </button>

          <button
            onClick={() => {
              onRestore(card.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore to Board</span>
          </button>
        </div>
      </div>
    </div>
  );
};
