import React from 'react';
import { CardItem } from '../types';
import { Star, AlertTriangle, X } from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

interface StarLimitModalProps {
  newCardTitle: string;
  lowestStarredCard: CardItem;
  onConfirm: () => void;
  onCancel: () => void;
}

export const StarLimitModal: React.FC<StarLimitModalProps> = ({
  newCardTitle,
  lowestStarredCard,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useModalAccessibility(true, onCancel);
  const backdropMouseDownRef = React.useRef<EventTarget | null>(null);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current === e.currentTarget) {
      onCancel();
    }
  };

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
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
        aria-labelledby="star-limit-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-semibold text-sm pb-3 border-b border-slate-100 dark:border-slate-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h3 id="star-limit-modal-title">Star Limit Reached (Max 3)</h3>
          <button
            onClick={onCancel}
            className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <p>
            You already have 3 starred focus items. Starring <strong className="text-slate-900 dark:text-slate-100 font-semibold">"{newCardTitle}"</strong> will unstar your lowest-priority starred item:
          </p>
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 flex items-center gap-2 font-medium">
            <Star className="w-4 h-4 fill-amber-400 text-amber-500 shrink-0" />
            <span className="truncate">#{lowestStarredCard.priority} {lowestStarredCard.title}</span>
          </div>
          <p className="text-slate-500 text-[11px]">Would you like to replace it?</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-xs"
          >
            Replace Star
          </button>
        </div>
      </div>
    </div>
  );
};
