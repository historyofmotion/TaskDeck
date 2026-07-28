import React, { useRef, useEffect } from 'react';
import { Area, ViewMode } from '../types';
import {
  Copy,
  Kanban,
  ListFilter,
  Eye,
  EyeOff,
  Search,
  Plus,
  Settings,
  X,
  HelpCircle,
} from 'lucide-react';

interface TopBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showDetails: boolean;
  onToggleDetails: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedAreaId: string;
  onAreaChange: (areaId: string) => void;
  areas: Area[];
  onNewCard: () => void;
  onOpenOptions: () => void;
  onOpenHelp: () => void;
  onCopyBoard: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  onViewModeChange,
  showDetails,
  onToggleDetails,
  searchQuery,
  onSearchChange,
  selectedAreaId,
  onAreaChange,
  areas,
  onNewCard,
  onOpenOptions,
  onOpenHelp,
  onCopyBoard,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global search shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing inside an input/textarea/select
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.getAttribute('contenteditable') === 'true');

      if (!isInput) {
        if (e.key === '/') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      } else if (activeEl === searchInputRef.current && e.key === 'Escape') {
        onSearchChange('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchChange]);

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: App Title + Copy Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCopyBoard}
            title="Click title or copy icon to copy board state as plain text"
            className="flex items-center gap-2.5 group text-left rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
              <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
                <rect width="64" height="64" rx="16" fill="#0f172a" />
                <rect x="14" y="38" width="36" height="12" rx="4" fill="#10b981" opacity="0.7" />
                <rect x="14" y="26" width="36" height="12" rx="4" fill="#06b6d4" opacity="0.85" />
                <rect x="14" y="14" width="36" height="16" rx="5" fill="#6366f1" />
                <path d="M19 22L22 25L29 18" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="33" y="19" width="12" height="2.5" rx="1.25" fill="#ffffff" opacity="0.9" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100 text-base leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                TaskDeck
              </span>
            </div>
            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 ml-0.5 transition-colors" />
          </button>
        </div>

        {/* Center: View Toggle + Details Eye (h-[34px]) */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700/60 h-[34px] shrink-0">
          <button
            onClick={() => onViewModeChange('board')}
            title="Board view (Shortcut: V)"
            className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
              viewMode === 'board'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Board</span>
          </button>

          <button
            onClick={() => onViewModeChange('list')}
            title="List view (Shortcut: V)"
            className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>List</span>
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            onClick={onToggleDetails}
            title={
              showDetails
                ? 'Hide card descriptions (Shortcut: D)'
                : 'Show card descriptions (Shortcut: D)'
            }
            className={`p-1.5 h-full aspect-square rounded-md text-xs font-medium transition-all flex items-center justify-center ${
              showDetails
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {showDetails ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Right Controls (All h-[34px] aligned) */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Find Box */}
          <div className="relative flex items-center h-[34px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Find cards... (/)"
              className="pl-8 pr-7 h-[34px] w-36 sm:w-48 rounded-lg text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Area Filter */}
          <div className="flex items-center h-[34px]">
            <select
              value={selectedAreaId}
              onChange={(e) => onAreaChange(e.target.value)}
              className="h-[34px] px-2.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all cursor-pointer"
            >
              <option value="ALL">All Projects</option>
              <option value="NO_AREA">No Project</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          {/* New Card Button */}
          <button
            onClick={onNewCard}
            title="Create new card (Shortcut: N)"
            className="h-[34px] flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          {/* Options Gear Button */}
          <button
            onClick={onOpenOptions}
            title="Settings & Options"
            className="h-[34px] w-[34px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Help & Shortcuts Button */}
          <button
            onClick={onOpenHelp}
            title="Help & Keyboard Shortcuts (Shortcut: ?)"
            className="h-[34px] w-[34px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-xs"
          >
            ?
          </button>
        </div>
      </div>
    </header>
  );
};
