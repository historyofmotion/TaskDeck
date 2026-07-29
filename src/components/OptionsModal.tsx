import React, { useState } from 'react';
import { Area, BoardData, Column, ThemeOption } from '../types';
import {
  X,
  Sliders,
  Columns as ColumnsIcon,
  Layers,
  Sun,
  Moon,
  Laptop,
  FolderOpen,
  Download,
  Upload,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Check,
  FileCheck,
} from 'lucide-react';
import { useModalAccessibility } from '../utils/useModalAccessibility';

interface OptionsModalProps {
  data: BoardData;
  connectedFileName: string | null;
  onUpdateSettings: (newSettings: { autoArchiveDays: number; theme: ThemeOption }) => void;
  onConnectFile: () => void;
  onCreateFile: () => void;
  onExportJSON: () => void;
  onImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdateColumns: (newColumns: Column[]) => void;
  onDeleteColumn: (columnId: string) => void;
  onUpdateAreas: (newAreas: Area[]) => void;
  onDeleteArea: (areaId: string, reassignAreaId: string | null) => void;
  onClose: () => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({
  data,
  connectedFileName,
  onUpdateSettings,
  onConnectFile,
  onCreateFile,
  onExportJSON,
  onImportJSON,
  onUpdateColumns,
  onDeleteColumn,
  onUpdateAreas,
  onDeleteArea,
  onClose,
}) => {
  const modalRef = useModalAccessibility(true, onClose);
  const [activeTab, setActiveTab] = useState<'general' | 'columns' | 'areas'>('general');

  // General settings state
  const [theme, setTheme] = useState<ThemeOption>(data.settings.theme || 'system');
  const [autoArchiveDays, setAutoArchiveDays] = useState<number>(
    data.settings.autoArchiveDays || 7
  );

  // Columns local editing
  const [columnsList, setColumnsList] = useState<Column[]>(
    [...data.columns].sort((a, b) => a.order - b.order)
  );

  // Areas local editing
  const [areasList, setAreasList] = useState<Area[]>([...data.areas]);

  // Area deletion prompt state
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null);
  const [reassignAreaId, setReassignAreaId] = useState<string | null>(null);

  // Save General settings
  const handleSaveGeneral = () => {
    onUpdateSettings({
      theme,
      autoArchiveDays: Math.max(3, Math.min(90, autoArchiveDays)),
    });
  };

  // Reorder Column
  const handleMoveColumn = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= columnsList.length) return;

    const list = [...columnsList];
    const [moved] = list.splice(index, 1);
    list.splice(newIdx, 0, moved);

    const reordered = list.map((c, i) => ({ ...c, order: i }));
    setColumnsList(reordered);
    onUpdateColumns(reordered);
  };

  // Add Column
  const handleAddColumn = () => {
    const newCol: Column = {
      id: `c_${Date.now()}`,
      name: `New Column ${columnsList.length + 1}`,
      order: columnsList.length,
    };
    const updated = [...columnsList, newCol];
    setColumnsList(updated);
    onUpdateColumns(updated);
  };

  // Update Column Name
  const handleColumnNameChange = (id: string, name: string) => {
    const updated = columnsList.map((c) => (c.id === id ? { ...c, name } : c));
    setColumnsList(updated);
    onUpdateColumns(updated);
  };

  // Confirm Delete Column
  const handleConfirmDeleteColumn = (colId: string) => {
    if (columnsList.length <= 1) {
      alert('You must keep at least one column on the board.');
      return;
    }
    onDeleteColumn(colId);
    setColumnsList(columnsList.filter((c) => c.id !== colId));
  };

  // Add Area
  const handleAddArea = () => {
    const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#6366F1'];
    const newArea: Area = {
      id: `a_${Date.now()}`,
      name: `New Area ${areasList.length + 1}`,
      color: colors[areasList.length % colors.length],
    };
    const updated = [...areasList, newArea];
    setAreasList(updated);
    onUpdateAreas(updated);
  };

  // Update Area name or color
  const handleUpdateAreaField = (id: string, field: 'name' | 'color', value: string) => {
    const updated = areasList.map((a) => (a.id === id ? { ...a, [field]: value } : a));
    setAreasList(updated);
    onUpdateAreas(updated);
  };

  // Confirm Area deletion
  const handleConfirmDeleteArea = () => {
    if (!deletingAreaId) return;
    onDeleteArea(deletingAreaId, reassignAreaId);
    setAreasList(areasList.filter((a) => a.id !== deletingAreaId));
    setDeletingAreaId(null);
    setReassignAreaId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="options-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 id="options-modal-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Options & Board Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>General</span>
          </button>

          <button
            onClick={() => setActiveTab('columns')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'columns'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ColumnsIcon className="w-4 h-4" />
            <span>Columns ({columnsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('areas')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'areas'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Projects ({areasList.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="space-y-3.5">
              {/* Row 1: Appearance & Auto-Archive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Theme selector */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Appearance Theme
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTheme('light');
                        onUpdateSettings({ theme: 'light', autoArchiveDays });
                      }}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                        theme === 'light'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Light</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTheme('dark');
                        onUpdateSettings({ theme: 'dark', autoArchiveDays });
                      }}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                        theme === 'dark'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Dark</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTheme('system');
                        onUpdateSettings({ theme: 'system', autoArchiveDays });
                      }}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                        theme === 'system'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-500 shadow-2xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>System</span>
                    </button>
                  </div>
                </div>

                {/* Auto-archive days setting */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                      Auto-Archive Threshold
                    </label>
                    <p className="text-[11px] text-slate-500 leading-tight mb-2">
                      Done tasks older than this are moved to archive automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="3"
                      max="90"
                      value={autoArchiveDays}
                      onChange={(e) => setAutoArchiveDays(Number(e.target.value))}
                      onBlur={handleSaveGeneral}
                      className="w-20 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">days in Done</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Data File Connection */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Data File Sync
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {connectedFileName ? 'Connected' : 'JSON File'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {connectedFileName ? (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileCheck className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="truncate">
                      <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {connectedFileName ? connectedFileName : 'No file connected'}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {connectedFileName ? 'Auto-saving to disk' : 'Using localStorage mirror'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={onConnectFile}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Open File
                    </button>
                    <button
                      type="button"
                      onClick={onCreateFile}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      New File
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Backup Export / Import */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Backup & Export
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Save or restore your board data via JSON file
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onExportJSON}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>

                  <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={onImportJSON}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* COLUMNS TAB */}
          {activeTab === 'columns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Manage stage columns. Cards in a deleted column move to the column to its left.
                </p>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Column</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {columnsList.map((col, index) => (
                  <div
                    key={col.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                  >
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => handleColumnNameChange(col.id, e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveColumn(index, 'up')}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === columnsList.length - 1}
                        onClick={() => handleMoveColumn(index, 'down')}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={columnsList.length <= 1}
                        onClick={() => handleConfirmDeleteColumn(col.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PROJECTS TAB */}
          {activeTab === 'areas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Manage projects and color coding. Each task can belong to one project.
                </p>
                <button
                  type="button"
                  onClick={handleAddArea}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>
              </div>

              {/* Area deletion reassign modal overlay */}
              {deletingAreaId && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 space-y-2">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Reassign tasks from deleted project?
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={reassignAreaId || ''}
                      onChange={(e) => setReassignAreaId(e.target.value || null)}
                      className="px-2 py-1 rounded text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-slate-100 flex-1"
                    >
                      <option value="">Set to No Project</option>
                      {areasList
                        .filter((a) => a.id !== deletingAreaId)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            Reassign to {a.name}
                          </option>
                        ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleConfirmDeleteArea}
                      className="px-3 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingAreaId(null)}
                      className="px-2.5 py-1 rounded text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {areasList.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                  >
                    <input
                      type="color"
                      value={area.color}
                      onChange={(e) => handleUpdateAreaField(area.id, 'color', e.target.value)}
                      className="w-7 h-7 rounded border-0 cursor-pointer bg-transparent shrink-0"
                    />

                    <input
                      type="text"
                      value={area.name}
                      onChange={(e) => handleUpdateAreaField(area.id, 'name', e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() => setDeletingAreaId(area.id)}
                      className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
