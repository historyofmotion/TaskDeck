import React, { useRef, useEffect, useState } from 'react';
import { Area, ViewMode } from '../types';
import { getAppIconConfig } from '../utils/appIconUtils';
import {
  Kanban,
  ListFilter,
  Eye,
  EyeOff,
  Search,
  Plus,
  Settings,
  X,
  HelpCircle,
  Spade,
  Grid2x2,
  Check,
} from 'lucide-react';

interface TopBarProps {
  appIcon?: string;
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
  onOpenDeal: () => void;
  dealOpen: boolean; // Deal is showing instead of the board / list / matrix
}

export const TopBar: React.FC<TopBarProps> = ({
  appIcon,
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
  onOpenDeal,
  dealOpen,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filtered = searchQuery.trim() !== '' || selectedAreaId !== 'ALL';

  // Focus the find box when the dropdown opens
  useEffect(() => {
    if (filterOpen) searchInputRef.current?.focus();
  }, [filterOpen]);

  // Click outside closes it
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);
  const iconConfig = getAppIconConfig(appIcon);
  const DynamicIcon = iconConfig.IconComponent;

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
          setFilterOpen(true);
          searchInputRef.current?.focus();
        }
      } else if (activeEl === searchInputRef.current && e.key === 'Escape') {
        onSearchChange('');
        searchInputRef.current?.blur();
        setFilterOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchChange]);

  return (
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors">
      <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: App Title */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${iconConfig.gradientClass} flex items-center justify-center text-white shadow-md ${iconConfig.shadowClass} shrink-0`}>
              <DynamicIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-slate-900 dark:text-slate-100 text-base leading-tight">
              TaskDeck
            </span>
          </div>
        </div>

        {/* Center: View Toggle + Details Eye (h-[34px]) */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200/80 dark:border-slate-700/60 h-[34px] shrink-0">
          <button
            onClick={onOpenDeal}
            title="Deal your top cards (Shortcut: 1 or T)"
            aria-label="Deal your top cards"
            aria-pressed={dealOpen}
            className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
              dealOpen
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Spade className="w-3.5 h-3.5" />
            <span>Deal</span>
          </button>

          <button
            onClick={() => onViewModeChange('matrix')}
            title="Matrix view: drag cards by impact and timeframe (Shortcut: 2)"
            aria-label="Switch to Matrix view"
            className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
              !dealOpen && viewMode === 'matrix'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Grid2x2 className="w-3.5 h-3.5" />
            <span>Matrix</span>
          </button>

          <button
            onClick={() => onViewModeChange('board')}
            title="Board view (Shortcut: 3)"
            aria-label="Switch to Board view"
            className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
              !dealOpen && viewMode === 'board'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Board</span>
          </button>

          <button
            onClick={() => onViewModeChange('list')}
            title="List view (Shortcut: 4)"
            aria-label="Switch to List view"
            className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
              !dealOpen && viewMode === 'list'
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
            aria-label={showDetails ? 'Hide card descriptions' : 'Show card descriptions'}
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
          {/* Filter: find box on top, then the projects */}
          <div ref={filterRef} className="relative h-[34px]">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={filterOpen}
              title="Filter cards (Shortcut: /)"
              className={`relative h-[34px] flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                filtered
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Filter</span>
              {filtered && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" aria-label="Filters are on" />}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Find cards... (/)"
                    aria-label="Find cards by title or description"
                    className="pl-8 pr-7 h-8 w-full rounded-lg text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => onSearchChange('')}
                      aria-label="Clear search input"
                      className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                <ul role="listbox" aria-label="Filter cards by project area" className="max-h-64 overflow-y-auto flex flex-col">
                  {[{ id: 'ALL', name: 'All Projects' }, { id: 'NO_AREA', name: 'No Project' }, ...areas].map((a) => (
                    <li key={a.id}>
                      <button
                        role="option"
                        aria-selected={selectedAreaId === a.id}
                        onClick={() => {
                          onAreaChange(a.id);
                          setFilterOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                          selectedAreaId === a.id ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 shrink-0 ${selectedAreaId === a.id ? 'text-blue-600' : 'invisible'}`} />
                        <span className="truncate">{a.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* New Card Button */}
          <button
            onClick={onNewCard}
            title="Create new card (Shortcut: N)"
            aria-label="Create new card"
            className="h-[34px] flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm transition-all shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          {/* Options Gear Button */}
          <button
            onClick={onOpenOptions}
            title="Settings & Options"
            aria-label="Settings and Options"
            className="h-[34px] w-[34px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
