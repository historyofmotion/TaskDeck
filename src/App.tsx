import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Area,
  BoardData,
  CardItem,
  Column,
  ThemeOption,
  ToastMessage,
  ViewMode,
} from './types';
import {
  debouncedSave,
  exportBoardAsJSON,
  getActiveFileHandle,
  getStoredFileHandle,
  loadFromLocalStorage,
  pickBoardFile,
  createBoardFile,
  setActiveFileHandle,
  flushPendingSave,
} from './utils/storage';
import {
  generatePlainTextCopy,
  moveCardToColumnEnd,
  normalizePriorities,
  reorderCardsInGlobalSequence,
  resortWithStarredTop,
  runAutoArchive,
} from './utils/helpers';
import { updateBrowserFavicon } from './utils/appIconUtils';
import { TopBar } from './components/TopBar';
import { ActionLine } from './components/ActionLine';
import { BoardView } from './components/BoardView';
import { ListView } from './components/ListView';
import { CardModal } from './components/CardModal';
import { ArchivedCardModal } from './components/ArchivedCardModal';
import { OptionsModal } from './components/OptionsModal';
import { StarLimitModal } from './components/StarLimitModal';
import { Toast } from './components/Toast';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const [boardData, setBoardData] = useState<BoardData>(() => loadFromLocalStorage());
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');

  // Modals state
  const [editingCard, setEditingCard] = useState<CardItem | null>(null);
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState<boolean>(false);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string>('c1');
  const [viewingArchivedCard, setViewingArchivedCard] = useState<CardItem | null>(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);

  // Star limit state
  const [pendingStarCard, setPendingStarCard] = useState<{
    cardId: string | null;
    title: string;
  } | null>(null);
  const [isEditingCardStarred, setIsEditingCardStarred] = useState<boolean>(false);

  // File connection name
  const [connectedFileName, setConnectedFileName] = useState<string | null>(null);

  // Toast messages
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = `t_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // State updater that auto-saves to localStorage and connected file
  const updateBoardData = useCallback(
    (newBoardData: BoardData) => {
      // Run auto archive check
      const { updatedData } = runAutoArchive(newBoardData);
      setBoardData(updatedData);
      debouncedSave(updatedData);
    },
    []
  );

  // Attempt to restore file handle on boot and flush saves on window exit
  useEffect(() => {
    getStoredFileHandle().then((handle) => {
      if (handle) {
        setActiveFileHandle(handle);
        setConnectedFileName(handle.name);
      }
    });

    const handleBeforeUnload = () => {
      flushPendingSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Theme application with live system listener support
  useEffect(() => {
    const theme = boardData.settings.theme || 'system';
    const root = document.documentElement;

    const applyDark = () => {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    };
    const applyLight = () => {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      if (theme === 'dark') {
        applyDark();
      } else if (theme === 'light') {
        applyLight();
      } else {
        if (mediaQuery.matches) {
          applyDark();
        } else {
          applyLight();
        }
      }
    };

    updateTheme();

    if (theme === 'system') {
      const handleSystemChange = (e: MediaQueryListEvent) => {
        if (e.matches) applyDark();
        else applyLight();
      };
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }
  }, [boardData.settings.theme]);

  // App Icon / Favicon application
  useEffect(() => {
    updateBrowserFavicon(boardData.settings.appIcon);
  }, [boardData.settings.appIcon]);

  // Keyboard Shortcuts: N = New, D = Details, V = View Toggle, ? = Help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.getAttribute('contenteditable') === 'true');

      if (isInput) return;
      if (editingCard || isNewCardModalOpen || viewingArchivedCard || isOptionsOpen || isHelpOpen || pendingStarCard) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setIsNewCardModalOpen(true);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setShowDetails((prev) => !prev);
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'board' ? 'list' : 'board'));
      } else if (e.key === '?') {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingCard, isNewCardModalOpen, viewingArchivedCard, isOptionsOpen, isHelpOpen, pendingStarCard]);

  // Copy board state to clipboard
  const handleCopyBoard = () => {
    const text = generatePlainTextCopy(boardData);
    navigator.clipboard
      .writeText(text)
      .then(() => {
        addToast('Board status copied to clipboard!', 'success');
      })
      .catch(() => {
        addToast('Failed to copy to clipboard.', 'error');
      });
  };

  // Filtered Cards logic
  const areaMap = useMemo(() => new Map(boardData.areas.map((a) => [a.id, a])), [boardData.areas]);

  const filteredCards = useMemo(() => {
    return boardData.cards.filter((card) => {
      // Area filter
      if (selectedAreaId === 'NO_AREA' && card.areaId !== null) return false;
      if (selectedAreaId !== 'ALL' && selectedAreaId !== 'NO_AREA' && card.areaId !== selectedAreaId) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const areaName = card.areaId ? areaMap.get(card.areaId)?.name.toLowerCase() || '' : '';
        const titleMatch = card.title.toLowerCase().includes(q);
        const descMatch = card.description.toLowerCase().includes(q);
        const areaMatch = areaName.includes(q);
        if (!titleMatch && !descMatch && !areaMatch) return false;
      }

      return true;
    });
  }, [boardData.cards, selectedAreaId, searchQuery, areaMap]);

  // Star logic & max 3 limit
  const starredCards = useMemo(() => boardData.cards.filter((c) => c.starred), [boardData.cards]);
  const lowestStarredCard = useMemo(() => {
    if (starredCards.length === 0) return null;
    return [...starredCards].sort((a, b) => b.priority - a.priority)[0];
  }, [starredCards]);

  const handleToggleStarAttempt = (
    cardId: string | null,
    isCurrentlyStarred: boolean,
    currentTitle: string
  ) => {
    if (isCurrentlyStarred) {
      // Simply unstar
      if (cardId) {
        const updated = boardData.cards.map((c) => (c.id === cardId ? { ...c, starred: false } : c));
        updateBoardData({ ...boardData, cards: resortWithStarredTop(updated) });
      } else {
        setIsEditingCardStarred(false);
      }
    } else {
      // Attempting to star
      if (starredCards.length >= 3) {
        setPendingStarCard({ cardId, title: currentTitle });
      } else {
        if (cardId) {
          const updated = boardData.cards.map((c) => (c.id === cardId ? { ...c, starred: true } : c));
          updateBoardData({ ...boardData, cards: resortWithStarredTop(updated) });
        } else {
          setIsEditingCardStarred(true);
        }
      }
    }
  };

  const handleConfirmStarReplace = () => {
    if (!pendingStarCard || !lowestStarredCard) return;

    const { cardId } = pendingStarCard;
    const updated = boardData.cards.map((c) => {
      if (c.id === lowestStarredCard.id) return { ...c, starred: false };
      if (c.id === cardId) return { ...c, starred: true };
      return c;
    });

    if (!cardId) {
      setIsEditingCardStarred(true);
    }

    updateBoardData({ ...boardData, cards: resortWithStarredTop(updated) });
    setPendingStarCard(null);
    addToast(`Starred "${pendingStarCard.title}" and unstarred lowest focus task.`, 'info');
  };

  // Save Card (New or Existing)
  const handleSaveCard = (cardData: Partial<CardItem>) => {
    let updatedCards: CardItem[];

    if (cardData.id) {
      // Existing card update
      updatedCards = boardData.cards.map((c) => {
        if (c.id === cardData.id) {
          return {
            ...c,
            ...cardData,
            title: cardData.title || c.title,
            description: cardData.description ?? c.description,
            areaId: cardData.areaId !== undefined ? cardData.areaId : c.areaId,
            columnId: cardData.columnId || c.columnId,
            dueDate: cardData.dueDate !== undefined ? cardData.dueDate : c.dueDate,
            progress: cardData.progress !== undefined ? cardData.progress : c.progress,
            starred: cardData.starred !== undefined ? cardData.starred : c.starred,
            completedAt: cardData.completedAt !== undefined ? cardData.completedAt : c.completedAt,
          };
        }
        return c;
      });
    } else {
      // New card creation
      const newCard: CardItem = {
        id: `k_${Date.now()}`,
        title: cardData.title || 'Untitled Task',
        description: cardData.description || '',
        areaId: cardData.areaId !== undefined ? cardData.areaId : null,
        columnId: cardData.columnId || quickAddColumnId,
        priority: boardData.cards.length + 1,
        starred: isEditingCardStarred,
        progress: cardData.progress || 0,
        dueDate: cardData.dueDate || null,
        createdAt: new Date().toISOString(),
        completedAt: cardData.completedAt || null,
      };
      updatedCards = [...boardData.cards, newCard];
    }

    updateBoardData({
      ...boardData,
      cards: resortWithStarredTop(updatedCards),
    });

    addToast(cardData.id ? 'Task updated!' : 'Task created!', 'success');
  };

  // Quick add card
  const handleQuickAddCard = (columnId: string, title: string) => {
    const newCard: CardItem = {
      id: `k_${Date.now()}`,
      title,
      description: '',
      areaId: null,
      columnId,
      priority: boardData.cards.length + 1,
      starred: false,
      progress: 0,
      dueDate: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    updateBoardData({
      ...boardData,
      cards: normalizePriorities([...boardData.cards, newCard]),
    });

    addToast('Task created!', 'success');
  };

  // Delete card
  const handleDeleteCard = (cardId: string) => {
    const updatedCards = boardData.cards.filter((c) => c.id !== cardId);
    updateBoardData({
      ...boardData,
      cards: normalizePriorities(updatedCards),
    });
    addToast('Task deleted.', 'info');
  };

  // Archive card manually
  const handleArchiveCard = (cardId: string) => {
    const cardToArchive = boardData.cards.find((c) => c.id === cardId);
    if (!cardToArchive) return;

    const remainingCards = boardData.cards.filter((c) => c.id !== cardId);
    const archivedItem: CardItem = {
      ...cardToArchive,
      archivedAt: new Date().toISOString(),
    };

    updateBoardData({
      ...boardData,
      cards: normalizePriorities(remainingCards),
      archive: [...(boardData.archive || []), archivedItem],
    });

    addToast('Task archived.', 'info');
  };

  // Restore archived card
  const handleRestoreArchivedCard = (cardId: string) => {
    const archivedItem = boardData.archive?.find((c) => c.id === cardId);
    if (!archivedItem) return;

    const remainingArchive = boardData.archive.filter((c) => c.id !== cardId);
    const doneColId =
      boardData.columns.find((c) => c.name.toLowerCase() === 'done')?.id ||
      boardData.columns[boardData.columns.length - 1]?.id ||
      'c4';

    const restoredCard: CardItem = {
      ...archivedItem,
      columnId: doneColId,
      completedAt: archivedItem.completedAt || new Date().toISOString(),
      archivedAt: null,
      priority: boardData.cards.length + 1,
    };

    updateBoardData({
      ...boardData,
      cards: normalizePriorities([...boardData.cards, restoredCard]),
      archive: remainingArchive,
    });

    addToast('Task restored to Done column!', 'success');
  };

  // Permanently delete archived card
  const handleDeleteArchivedPermanent = (cardId: string) => {
    const remainingArchive = boardData.archive.filter((c) => c.id !== cardId);
    updateBoardData({
      ...boardData,
      archive: remainingArchive,
    });
    addToast('Archived task deleted permanently.', 'info');
  };

  // Drag and Drop reorder
  const handleDragDropCard = (
    draggedCardId: string,
    targetCardId: string | null,
    placeBefore: boolean,
    targetColumnId: string
  ) => {
    const doneColId = boardData.columns.find((c) => c.name.toLowerCase() === 'done')?.id || 'c4';

    let updatedCards: CardItem[];
    if (targetCardId) {
      updatedCards = reorderCardsInGlobalSequence(
        boardData.cards,
        draggedCardId,
        targetCardId,
        placeBefore,
        targetColumnId
      );
    } else {
      updatedCards = moveCardToColumnEnd(
        boardData.cards,
        draggedCardId,
        targetColumnId,
        doneColId
      );
    }

    // Ensure completedAt is kept up to date for target column
    updatedCards = updatedCards.map((c) => {
      if (c.id === draggedCardId) {
        if (targetColumnId === doneColId && !c.completedAt) {
          return { ...c, completedAt: new Date().toISOString() };
        } else if (targetColumnId !== doneColId && c.completedAt) {
          return { ...c, completedAt: null };
        }
      }
      return c;
    });

    updateBoardData({
      ...boardData,
      cards: updatedCards,
    });
  };

  // Reorder all cards (e.g. from List View menu)
  const handleReorderAllCards = (newCards: CardItem[]) => {
    updateBoardData({
      ...boardData,
      cards: newCards,
    });
    addToast('Renumbered tasks: In Progress → Blocked → Pending → Done', 'success');
  };

  // File Options Handlers
  const handleConnectFile = async () => {
    const result = await pickBoardFile();
    if (result) {
      setBoardData(result.data);
      setConnectedFileName(result.handle.name);
      addToast(`Connected to file: ${result.handle.name}`, 'success');
    }
  };

  const handleCreateFile = async () => {
    const handle = await createBoardFile(boardData);
    if (handle) {
      setConnectedFileName(handle.name);
      addToast(`Created and connected file: ${handle.name}`, 'success');
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = JSON.parse(text) as BoardData;
        updateBoardData(imported);
        addToast('Board data imported successfully!', 'success');
      } catch {
        addToast('Invalid JSON board file format.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Options Update Columns
  const handleUpdateColumns = (newColumns: Column[]) => {
    updateBoardData({
      ...boardData,
      columns: newColumns,
    });
  };

  const handleDeleteColumn = (deletedColId: string) => {
    const colIndex = boardData.columns.findIndex((c) => c.id === deletedColId);
    if (colIndex === -1 || boardData.columns.length <= 1) return;

    // Target column: left if exists, else right
    const targetCol =
      colIndex > 0 ? boardData.columns[colIndex - 1] : boardData.columns[colIndex + 1];

    const updatedCards = boardData.cards.map((c) =>
      c.columnId === deletedColId ? { ...c, columnId: targetCol.id } : c
    );

    const updatedCols = boardData.columns
      .filter((c) => c.id !== deletedColId)
      .map((c, i) => ({ ...c, order: i }));

    updateBoardData({
      ...boardData,
      columns: updatedCols,
      cards: updatedCards,
    });

    addToast(`Column deleted. Tasks moved to ${targetCol.name}.`, 'info');
  };

  // Options Update Areas
  const handleUpdateAreas = (newAreas: Area[]) => {
    updateBoardData({
      ...boardData,
      areas: newAreas,
    });
  };

  const handleDeleteArea = (deletedAreaId: string, reassignAreaId: string | null) => {
    const updatedCards = boardData.cards.map((c) =>
      c.areaId === deletedAreaId ? { ...c, areaId: reassignAreaId } : c
    );

    const updatedAreas = boardData.areas.filter((a) => a.id !== deletedAreaId);

    updateBoardData({
      ...boardData,
      areas: updatedAreas,
      cards: updatedCards,
    });

    addToast('Area deleted.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header Controls */}
      <TopBar
        appIcon={boardData.settings.appIcon}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showDetails={showDetails}
        onToggleDetails={() => setShowDetails((prev) => !prev)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedAreaId={selectedAreaId}
        onAreaChange={setSelectedAreaId}
        areas={boardData.areas}
        onNewCard={() => {
          setIsEditingCardStarred(false);
          setIsNewCardModalOpen(true);
        }}
        onOpenOptions={() => setIsOptionsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onCopyBoard={handleCopyBoard}
      />

      {/* Action Line Focus Banner */}
      <ActionLine
        cards={boardData.cards}
        columns={boardData.columns}
        onOpenCard={(cardId) => {
          const card = boardData.cards.find((c) => c.id === cardId);
          if (card) setEditingCard(card);
        }}
      />

      {/* Main Views */}
      <main className="flex-1 mt-1">
        {viewMode === 'board' ? (
          <BoardView
            columns={boardData.columns}
            cards={filteredCards}
            areas={boardData.areas}
            archiveCards={boardData.archive || []}
            showDetails={showDetails}
            onOpenCardModal={setEditingCard}
            onQuickAddCard={handleQuickAddCard}
            onDragDropCard={handleDragDropCard}
            onToggleStarAttempt={handleToggleStarAttempt}
            onOpenArchivedCard={setViewingArchivedCard}
          />
        ) : (
          <ListView
            cards={filteredCards}
            columns={boardData.columns}
            areas={boardData.areas}
            showDetails={showDetails}
            onOpenCardModal={setEditingCard}
            onToggleDetails={() => setShowDetails((prev) => !prev)}
            onDragDropCard={handleDragDropCard}
            onToggleStarAttempt={handleToggleStarAttempt}
            onReorderAllCards={handleReorderAllCards}
          />
        )}
      </main>

      {/* Create / Edit Card Modal */}
      {(editingCard || isNewCardModalOpen) && (
        <CardModal
          card={editingCard}
          initialColumnId={quickAddColumnId}
          columns={boardData.columns}
          areas={boardData.areas}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onArchive={handleArchiveCard}
          onClose={() => {
            setEditingCard(null);
            setIsNewCardModalOpen(false);
            setIsEditingCardStarred(false);
          }}
          onToggleStarAttempt={handleToggleStarAttempt}
          isStarredState={editingCard ? editingCard.starred : isEditingCardStarred}
        />
      )}

      {/* View Archived Card Read-Only Modal */}
      {viewingArchivedCard && (
        <ArchivedCardModal
          card={viewingArchivedCard}
          onRestore={handleRestoreArchivedCard}
          onDeletePermanent={handleDeleteArchivedPermanent}
          onClose={() => setViewingArchivedCard(null)}
        />
      )}

      {/* Options / Settings Modal */}
      {isOptionsOpen && (
        <OptionsModal
          data={boardData}
          connectedFileName={connectedFileName}
          onUpdateSettings={(newSettings) =>
            updateBoardData({
              ...boardData,
              settings: { ...boardData.settings, ...newSettings },
            })
          }
          onConnectFile={handleConnectFile}
          onCreateFile={handleCreateFile}
          onExportJSON={() => exportBoardAsJSON(boardData)}
          onImportJSON={handleImportJSON}
          onUpdateColumns={handleUpdateColumns}
          onDeleteColumn={handleDeleteColumn}
          onUpdateAreas={handleUpdateAreas}
          onDeleteArea={handleDeleteArea}
          onClose={() => setIsOptionsOpen(false)}
        />
      )}

      {/* Star Limit Confirmation Modal */}
      {pendingStarCard && lowestStarredCard && (
        <StarLimitModal
          newCardTitle={pendingStarCard.title}
          lowestStarredCard={lowestStarredCard}
          onConfirm={handleConfirmStarReplace}
          onCancel={() => setPendingStarCard(null)}
        />
      )}

      {/* Help & Keyboard Shortcuts Modal */}
      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
    </div>
  );
}
