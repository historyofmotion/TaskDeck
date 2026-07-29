import React, { useEffect } from 'react';
import { HelpCircle, X, Keyboard, Sparkles, FileText, CheckCircle } from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  const modalRef = useModalAccessibility(true, onClose);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const shortcuts = [
    { key: 'N', label: 'Create New Task' },
    { key: 'V', label: 'Toggle View Mode (Board / List)' },
    { key: 'D', label: 'Toggle Card Descriptions' },
    { key: '/', label: 'Focus Search Input' },
    { key: 'Enter / Space', label: 'Open focused Card Modal' },
    { key: 'Alt + ↑ / ↓', label: 'Move Task Priority Rank Up/Down' },
    { key: 'Alt + ← / →', label: 'Move Task Column Left/Right' },
    { key: '?', label: 'Open Help & Shortcuts' },
    { key: 'Esc', label: 'Close Active Modal / Clear Search' },
  ];

  const tips = [
    {
      title: 'Focus Star Limit (Max 3)',
      desc: 'Star up to 3 high-priority focus tasks to pin them to your focus banner.',
      icon: CheckCircle,
    },
    {
      title: 'Serverless Data Persistence',
      desc: 'TaskDeck auto-saves to LocalStorage or syncs directly with local board.json files via browser File Access API.',
      icon: FileText,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <HelpCircle className="w-5 h-5" />
            <h3 id="help-modal-title" className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
              Help & Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-5 overflow-y-auto flex-1">
          {/* Shortcuts Grid */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4 text-slate-400" />
              <span>Keyboard Shortcuts</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {shortcuts.map((sc) => (
                <div
                  key={sc.key}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs"
                >
                  <span className="text-slate-600 dark:text-slate-300 font-medium truncate pr-2">
                    {sc.label}
                  </span>
                  <kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-[11px] text-slate-700 dark:text-slate-300 shadow-2xs shrink-0">
                    {sc.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Tips Section */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">
              Pro Tips
            </h4>
            <div className="space-y-2.5">
              {tips.map((tip) => {
                const Icon = tip.icon;
                return (
                  <div
                    key={tip.title}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-start gap-3"
                  >
                    <Icon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-0.5">
                        {tip.title}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {tip.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
