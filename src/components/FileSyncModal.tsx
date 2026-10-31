import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { BoardDiff } from '../utils/helpers';
import { useModalAccessibility } from '../utils/useModalAccessibility';

interface FileSyncModalProps {
  fileName: string;
  fileModified: number;
  browserSavedAt: number; // 0 if unknown
  diff: BoardDiff;
  onUseFile: () => void;
  onKeepBrowser: () => void;
  onDecideLater: () => void;
}

const formatTime = (ms: number) =>
  ms
    ? new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'unknown';

const MAX_TITLES = 5;

const TitleList: React.FC<{ label: string; titles: string[] }> = ({ label, titles }) => {
  if (titles.length === 0) return null;
  return (
    <div>
      <p className="font-semibold text-slate-800 dark:text-slate-200">
        {label} ({titles.length})
      </p>
      <ul className="mt-1 ml-4 list-disc space-y-0.5 text-slate-600 dark:text-slate-400">
        {titles.slice(0, MAX_TITLES).map((t, i) => (
          <li key={i} className="truncate">{t}</li>
        ))}
        {titles.length > MAX_TITLES && <li className="list-none -ml-4 text-slate-400">…and {titles.length - MAX_TITLES} more</li>}
      </ul>
    </div>
  );
};

// Shown when board.json and this browser's saved board don't match, so the user picks which to keep
export const FileSyncModal: React.FC<FileSyncModalProps> = ({
  fileName,
  fileModified,
  browserSavedAt,
  diff,
  onUseFile,
  onKeepBrowser,
  onDecideLater,
}) => {
  const modalRef = useModalAccessibility(true, onDecideLater);
  const fileIsNewer = browserSavedAt > 0 && fileModified > browserSavedAt;
  const browserIsNewer = browserSavedAt > 0 && browserSavedAt > fileModified;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-sync-modal-title"
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 overflow-hidden"
      >
        <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-semibold text-sm pb-3 border-b border-slate-100 dark:border-slate-800">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h3 id="file-sync-modal-title">{fileName} doesn't match this browser's board</h3>
          <button
            onClick={onDecideLater}
            aria-label="Decide later"
            className="ml-auto p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 text-xs text-slate-600 dark:text-slate-300 space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2.5 rounded-lg border ${fileIsNewer ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                File {fileIsNewer && <span className="text-indigo-600 dark:text-indigo-400">· newer</span>}
              </p>
              <p className="mt-0.5">Saved {formatTime(fileModified)}</p>
              <p className="text-slate-500">
                {diff.fileCounts.cards} cards, {diff.fileCounts.archived} archived
              </p>
            </div>
            <div className={`p-2.5 rounded-lg border ${browserIsNewer ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                This browser {browserIsNewer && <span className="text-indigo-600 dark:text-indigo-400">· newer</span>}
              </p>
              <p className="mt-0.5">Saved {formatTime(browserSavedAt)}</p>
              <p className="text-slate-500">
                {diff.browserCounts.cards} cards, {diff.browserCounts.archived} archived
              </p>
            </div>
          </div>

          <TitleList label="Only in the file" titles={diff.onlyInFile} />
          <TitleList label="Only in this browser" titles={diff.onlyInBrowser} />
          <TitleList label="Changed" titles={diff.changed} />
          {diff.other.length > 0 && (
            <ul className="ml-4 list-disc space-y-0.5 text-slate-600 dark:text-slate-400">
              {diff.other.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-slate-500">
            The version you don't keep is replaced. Export a backup from Options first if you're unsure.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onDecideLater}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Decide later
          </button>
          <button
            onClick={onKeepBrowser}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Keep browser copy
          </button>
          <button
            onClick={onUseFile}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            Use file
          </button>
        </div>
      </div>
    </div>
  );
};
