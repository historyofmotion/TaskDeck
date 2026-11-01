import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ensureFilePermission,
  readBoardFile,
  getLocalSavedAt,
  BoardFileContents,
} from './utils/storage';
import {
  generatePlainTextCopy,
  moveCardToColumnEnd,
  normalizePriorities,
  reorderCardsInGlobalSequence,
  resortWithStarredTop,
  runAutoArchive,
  getDoneColumnId,
  getColumnRole,
  diffBoards,
  BoardDiff,
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
import { FileSyncModal } from './components/FileSyncModal';
import { DealView } from './components/DealView';
import { MatrixView, QUADRANT_ORDER, matrixScore, quadrantOf } from './components/MatrixView';
import { WorkIndicator } from './components/WorkIndicator';
import { WORK_KEY, WorkState, formatTracked, loadWorkState, saveWorkState } from './utils/workTracking';
import { BoardCheckError, checkBoard, parseBoardFile, summarizeProblems } from './utils/boardCheck';
import { Toast } from './components/Toast';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const [boardData, setBoardData] = useState<BoardData>(() => loadFromLocalStorage());
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');

  // If the filtered project no longer exists (deleted, or a file/import without it), show all projects
  useEffect(() => {
    if (selectedAreaId === 'ALL' || selectedAreaId === 'NO_AREA') return;
    if (!boardData.areas.some((a) => a.id === selectedAreaId)) setSelectedAreaId('ALL');
  }, [boardData.areas, selectedAreaId]);

  // Modals state
  const [editingCard, setEditingCard] = useState<CardItem | null>(null);
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState<boolean>(false);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string>('c1');
  const [viewingArchivedCard, setViewingArchivedCard] = useState<CardItem | null>(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isDealOpen, setIsDealOpen] = useState<boolean>(false);
  const [work, setWorkState] = useState<WorkState | null>(loadWorkState);
  const setWork = (w: WorkState | null) => {
    setWorkState(w);
    saveWorkState(w);
  };

  // Star limit state
  const [pendingStarCard, setPendingStarCard] = useState<{
    cardId: string | null;
    title: string;
  } | null>(null);
  const [isEditingCardStarred, setIsEditingCardStarred] = useState<boolean>(false);

  // File connection name
  const [connectedFileName, setConnectedFileName] = useState<string | null>(null);
  // A board.json that differs from the browser copy, waiting for the user to choose
  const [pendingFileSync, setPendingFileSync] = useState<
    (BoardFileContents & { diff: BoardDiff; browserSavedAt: number }) | null
  >(null);
  // A remembered board.json that needs a click before the browser lets us read it
  const [fileNeedingAccess, setFileNeedingAccess] = useState<FileSystemFileHandle | null>(null);
  // Latest board, for async file code that runs after later edits
  const boardDataRef = useRef(boardData);
  boardDataRef.current = boardData;

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
    // Don't write to the remembered file until it has been compared with the browser copy
    getStoredFileHandle().then(async (handle) => {
      if (!handle) return;
      if (await ensureFilePermission(handle, false)) {
        loadAndCompareFile(handle);
      } else {
        setFileNeedingAccess(handle);
      }
    });

    const handleBeforeUnload = () => {
      flushPendingSave();
    };

    // Leaving the tab is a more dependable moment to finish writing the file than closing the page
    const handleHidden = () => {
      if (document.visibilityState === 'hidden') flushPendingSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleHidden);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleHidden);
    };
  }, []);

  // ---- board.json sync ----
  const describeFileError = (err: unknown) =>
    err instanceof BoardCheckError ? summarizeProblems(err.problems) : 'it could not be read';

  // Tell the user about small problems that were repaired in a loaded file
  const reportFixes = (fileName: string, fixes: string[]) => {
    if (fixes.length === 0) return;
    console.info(`Fixed while loading ${fileName}:`, fixes);
    addToast(`Fixed in ${fileName}: ${fixes.join('; ')}`, 'warning');
  };

  const connectFile = (handle: FileSystemFileHandle) => {
    setActiveFileHandle(handle);
    setConnectedFileName(handle.name);
  };

  // Compare a file with the browser copy. Same → connect. Different → ask the user.
  function compareWithFile(contents: BoardFileContents, announce: boolean) {
    reportFixes(contents.handle.name, contents.fixes);
    // The file went through the checker, so check the browser copy the same way; otherwise harmless
    // differences (a field that is null here and missing there, rounding) look like real changes.
    let browser = boardDataRef.current;
    try {
      browser = checkBoard(JSON.parse(JSON.stringify(browser))).data;
    } catch {
      /* a browser copy the checker rejects is compared as it is */
    }
    const diff = diffBoards(browser, contents.data);
    if (diff.identical) {
      connectFile(contents.handle);
      if (announce) addToast(`Connected to file: ${contents.handle.name}`, 'success');
      return;
    }
    setPendingFileSync({ ...contents, diff, browserSavedAt: getLocalSavedAt() });
  }

  async function loadAndCompareFile(handle: FileSystemFileHandle) {
    try {
      compareWithFile(await readBoardFile(handle), false);
    } catch (err) {
      console.error('Could not read board file:', err);
      addToast(`${handle.name} not connected: ${describeFileError(err)}. Your board is unchanged.`, 'error');
    }
  }

  const handleGrantFileAccess = async () => {
    const handle = fileNeedingAccess;
    if (!handle) return;
    setFileNeedingAccess(null);
    if (await ensureFilePermission(handle, true)) {
      loadAndCompareFile(handle);
    } else {
      addToast(`No access to ${handle.name}. Changes are only saved in this browser.`, 'warning');
    }
  };

  const handleUseFile = () => {
    if (!pendingFileSync) return;
    connectFile(pendingFileSync.handle);
    updateBoardData(pendingFileSync.data);
    addToast(`Loaded board from ${pendingFileSync.handle.name}`, 'success');
    setPendingFileSync(null);
  };

  const handleKeepBrowser = () => {
    if (!pendingFileSync) return;
    connectFile(pendingFileSync.handle);
    debouncedSave(boardDataRef.current); // overwrites the file with the browser copy
    addToast(`Kept browser copy and saved it to ${pendingFileSync.handle.name}`, 'success');
    setPendingFileSync(null);
  };

  const handleDecideLater = () => {
    if (!pendingFileSync) return;
    addToast(`${pendingFileSync.handle.name} not connected. Changes are only saved in this browser for now.`, 'info');
    setPendingFileSync(null);
  };

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
      if (editingCard || isNewCardModalOpen || viewingArchivedCard || isOptionsOpen || isHelpOpen || pendingStarCard || pendingFileSync) {
        return;
      }
      if (isDealOpen && !'vVmM'.includes(e.key)) return; // Deal has its own keys, except V and M which leave it

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const validColId = boardData.columns.some((c) => c.id === quickAddColumnId)
          ? quickAddColumnId
          : boardData.columns[0]?.id || 'c1';
        setQuickAddColumnId(validColId);
        setIsNewCardModalOpen(true);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setShowDetails((prev) => !prev);
      } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (e.key === 'V') {
          // Shift + V: the list
          setViewMode('list');
          setIsDealOpen(false);
        } else {
          // V: Board → Matrix → Deal → Board (from the list it goes to the board)
          const here = isDealOpen ? 'deal' : viewMode;
          const next = here === 'board' ? 'matrix' : here === 'matrix' ? 'deal' : 'board';
          if (next === 'deal') {
            setIsDealOpen(true);
          } else {
            setViewMode(next);
            setIsDealOpen(false);
          }
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setViewMode('matrix');
        setIsDealOpen(false);
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setIsDealOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editingCard,
    isNewCardModalOpen,
    viewingArchivedCard,
    isOptionsOpen,
    isHelpOpen,
    pendingStarCard,
    pendingFileSync,
    isDealOpen,
    viewMode,
    boardData.columns, // N picks a column, so it needs the current list
    quickAddColumnId,
  ]);

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

  const matchesFilters = useCallback((card: CardItem) => {
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
  }, [selectedAreaId, searchQuery, areaMap]);

  const filteredCards = useMemo(() => boardData.cards.filter(matchesFilters), [boardData.cards, matchesFilters]);

  // Archived cards matching the same filters, most recently archived first
  const filteredArchive = useMemo(
    () =>
      (boardData.archive || [])
        .filter(matchesFilters)
        .sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || '')),
    [boardData.archive, matchesFilters]
  );

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
      const fallbackColId = boardData.columns[0]?.id || 'c1';
      const finalColumnId =
        cardData.columnId && boardData.columns.some((c) => c.id === cardData.columnId)
          ? cardData.columnId
          : boardData.columns.some((c) => c.id === quickAddColumnId)
          ? quickAddColumnId
          : fallbackColId;

      const newCard: CardItem = {
        id: `k_${Date.now()}`,
        title: cardData.title || 'Untitled Task',
        description: cardData.description || '',
        areaId: cardData.areaId !== undefined ? cardData.areaId : null,
        columnId: finalColumnId,
        priority: boardData.cards.length + 1,
        starred: isEditingCardStarred,
        progress: cardData.progress || 0,
        dueDate: cardData.dueDate || null,
        ...(cardData.estimateHours ? { estimateHours: cardData.estimateHours } : {}),
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
      getDoneColumnId(boardData.columns) ||
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
    const draggedCard = boardData.cards.find((c) => c.id === draggedCardId);
    if (!targetCardId && draggedCard && draggedCard.columnId === targetColumnId) {
      // Dragged and dropped onto the same column container without a target card -> do nothing
      return;
    }

    const doneColId = getDoneColumnId(boardData.columns);

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
        doneColId ?? ''
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

  // ---- Time tracking ----
  // Adds working time to a card (on the board or in the archive). Returns the updated board.
  const withTrackedTime = (data: BoardData, cardId: string, ms: number): BoardData => {
    const secs = Math.round(ms / 1000);
    if (secs <= 0) return data;
    const add = (c: CardItem) => (c.id === cardId ? { ...c, trackedSeconds: (c.trackedSeconds || 0) + secs } : c);
    return { ...data, cards: data.cards.map(add), archive: data.archive.map(add) };
  };

  // Close the current working stretch, if any, and save its time
  const recordWorking = (data: BoardData = boardData): BoardData => {
    if (work?.mode === 'working' && work.cardId) {
      const next = withTrackedTime(data, work.cardId, Date.now() - work.since);
      if (next !== data) updateBoardData(next);
      return next;
    }
    return data;
  };

  // Only one card can be worked on: starting a card stops (and records) the one before it
  const handleStartWork = (cardId: string) => {
    if (work?.mode === 'working' && work.cardId === cardId) return;
    const previous = work?.mode === 'working' && work.cardId ? boardData.cards.find((c) => c.id === work.cardId) : undefined;
    const secs = previous && work ? Math.round((Date.now() - work.since) / 1000) : 0;
    recordWorking();
    setWork({ cardId, mode: 'working', since: Date.now() });
    if (previous) addToast(`Stopped "${previous.title}" (${formatTracked(secs) || '<1m'} recorded).`, 'info');
  };

  // Another TaskDeck tab changed the timer: follow it, so two tabs never run two timers.
  // (The tab that made the change has already recorded the time.)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === WORK_KEY) setWorkState(loadWorkState());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const handleOffTask = () => {
    recordWorking();
    setWork({ cardId: work?.cardId ?? null, mode: 'off', since: Date.now() });
  };
  const handleResumeWork = () => {
    if (work?.cardId) setWork({ cardId: work.cardId, mode: 'working', since: Date.now() });
  };
  const handleStopWork = () => {
    const card = work?.cardId ? boardData.cards.find((c) => c.id === work.cardId) : undefined;
    const secs = work?.mode === 'working' ? Math.round((Date.now() - work.since) / 1000) : 0;
    recordWorking();
    setWork(null);
    if (card && secs > 0) addToast(`Recorded ${formatTracked(secs) || '<1m'} on "${card.title}".`, 'success');
  };

  // A card being worked on that's finished, archived or deleted stops its timer (its time is kept)
  useEffect(() => {
    if (!work?.cardId) return;
    const card = boardData.cards.find((c) => c.id === work.cardId);
    if (card && card.columnId !== getDoneColumnId(boardData.columns)) return;
    if (work.mode === 'working') {
      const secs = Math.round((Date.now() - work.since) / 1000);
      recordWorking();
      setWork(null);
      if (secs > 0) addToast(`Timer stopped: ${formatTracked(secs) || '<1m'} recorded.`, 'info');
    } else {
      setWork({ ...work, cardId: null }); // stay off task, with no card to go back to
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardData.cards, boardData.columns, work]);

  const workCard = work?.cardId ? boardData.cards.find((c) => c.id === work.cardId) : undefined;
  const workIndicator = (tone: 'light' | 'felt') => (
    <WorkIndicator
      work={work}
      card={workCard}
      onOffTask={handleOffTask}
      onResume={handleResumeWork}
      onStop={handleStopWork}
      onOpenCard={tone === 'light' ? (id) => {
        const c = boardData.cards.find((x) => x.id === id);
        if (c) setEditingCard(c);
      } : undefined}
      tone={tone}
    />
  );

  // ---- Matrix view ----
  const handlePlaceOnMatrix = (cardId: string, pos: { x: number; y: number } | null) => {
    updateBoardData({
      ...boardData,
      cards: boardData.cards.map((c) => {
        if (c.id !== cardId) return c;
        if (pos) return { ...c, matrix: { x: Math.round(pos.x * 1000) / 1000, y: Math.round(pos.y * 1000) / 1000 } };
        const { matrix: _drop, ...rest } = c;
        return rest;
      }),
    });
  };

  // A finished card is open again: it goes back to the To do column (clearing its completion), and is placed
  // on the matrix if it was dropped on the grid. Works for archived cards too.
  const handleReopenCard = (cardId: string, pos: { x: number; y: number } | null) => {
    const target =
      boardData.columns.find((c) => getColumnRole(c) === 'pending') ||
      boardData.columns.find((c) => getColumnRole(c) === 'active') ||
      boardData.columns.find((c) => getColumnRole(c) !== 'done');
    const fromArchive = boardData.archive.find((c) => c.id === cardId);
    const base = fromArchive || boardData.cards.find((c) => c.id === cardId);
    if (!target || !base) return;
    const { archivedAt: _archived, ...rest } = base;
    const matrix = pos ? { x: Math.round(pos.x * 1000) / 1000, y: Math.round(pos.y * 1000) / 1000 } : base.matrix;
    const reopened: CardItem = { ...rest, columnId: target.id, completedAt: null, ...(matrix ? { matrix } : {}) };
    const cards = fromArchive
      ? [...boardData.cards, { ...reopened, priority: boardData.cards.length + 1 }]
      : boardData.cards.map((c) => (c.id === cardId ? reopened : c));
    updateBoardData({
      ...boardData,
      cards: resortWithStarredTop(cards),
      archive: fromArchive ? boardData.archive.filter((c) => c.id !== cardId) : boardData.archive,
    });
    addToast(`"${base.title}" is open again in ${target.name}.`, 'success');
  };

  // Renumber ranks from the matrix: Urgent, Important, Needed, Questionable (nearest top-right first),
  // then unplaced open cards in their current order, then Done. Starred cards stay on top.
  const handleUseMatrixOrder = () => {
    const doneId = getDoneColumnId(boardData.columns);
    const byRank = [...boardData.cards].sort((a, b) => a.priority - b.priority);
    const open = byRank.filter((c) => c.columnId !== doneId);
    const placed = open
      .filter((c) => c.matrix)
      .sort(
        (a, b) =>
          QUADRANT_ORDER.indexOf(quadrantOf(a.matrix!)) - QUADRANT_ORDER.indexOf(quadrantOf(b.matrix!)) ||
          matrixScore(b.matrix!) - matrixScore(a.matrix!)
      );
    const ordered = [...placed, ...open.filter((c) => !c.matrix), ...byRank.filter((c) => c.columnId === doneId)];
    updateBoardData({ ...boardData, cards: resortWithStarredTop(normalizePriorities(ordered)) });
    addToast('Ranks updated from the matrix (starred cards stay on top).', 'success');
  };

  // ---- Deal mode ----
  // Unblock a card: move it to the end of the first Active column
  const handleMakeActive = (cardId: string) => {
    const activeCol = boardData.columns.find((c) => getColumnRole(c) === 'active');
    if (!activeCol) return;
    handleDragDropCard(cardId, null, false, activeCol.id);
    addToast('Card moved to ' + activeCol.name + '.', 'success');
  };
  const handleDealDone = (cardId: string) => {
    const doneColId = getDoneColumnId(boardData.columns);
    if (doneColId) handleDragDropCard(cardId, null, false, doneColId);
  };

  // Put a card back where it was before Deal moved it to Done (column, completion and rank)
  const handleDealUndoDone = (before: CardItem) => {
    const sorted = [...boardData.cards].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((c) => c.id === before.id);
    if (idx === -1) return;
    const [current] = sorted.splice(idx, 1);
    const restored: CardItem = {
      ...current,
      columnId: before.columnId,
      completedAt: before.completedAt,
      progress: before.progress,
    };
    sorted.splice(Math.min(Math.max(before.priority - 1, 0), sorted.length), 0, restored);
    updateBoardData({ ...boardData, cards: normalizePriorities(sorted) });
  };

  const handleSetEstimate = (cardId: string, hours: number) => {
    updateBoardData({
      ...boardData,
      cards: boardData.cards.map((c) => (c.id === cardId ? { ...c, estimateHours: hours } : c)),
    });
  };

  // Reorder all cards (e.g. from List View menu)
  const handleReorderAllCards = (newCards: CardItem[], mode: 'status' | 'project') => {
    updateBoardData({
      ...boardData,
      cards: newCards,
    });
    addToast(
      mode === 'project'
        ? 'Renumbered: starred first, then each project in Options order (Active → Blocked → Pending), Done last'
        : 'Renumbered: starred first, then Active & Blocked → Pending → Done',
      'success'
    );
  };

  // File Options Handlers
  const handleConnectFile = async () => {
    try {
      const contents = await pickBoardFile();
      if (contents) compareWithFile(contents, true);
    } catch (err) {
      addToast(`File not connected: ${describeFileError(err)}`, 'error');
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
        const { data, fixes } = parseBoardFile(text);
        updateBoardData(data); // also saves to localStorage
        addToast('Board data imported successfully!', 'success');
        reportFixes(file.name, fixes);
      } catch (err) {
        addToast(`Import cancelled, your board is unchanged: ${describeFileError(err)}`, 'error');
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

    // Archived cards follow the same choice, so none point to a missing project
    const updatedArchive = boardData.archive.map((c) =>
      c.areaId === deletedAreaId ? { ...c, areaId: reassignAreaId } : c
    );

    const updatedAreas = boardData.areas.filter((a) => a.id !== deletedAreaId);

    updateBoardData({
      ...boardData,
      areas: updatedAreas,
      cards: updatedCards,
      archive: updatedArchive,
    });

    addToast('Project deleted.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header Controls */}
      <TopBar
        appIcon={boardData.settings.appIcon}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setIsDealOpen(false);
        }}
        dealOpen={isDealOpen}
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
        onOpenDeal={() => setIsDealOpen((open) => !open)}
        onCopyBoard={handleCopyBoard}
      />

      {/* Action Line Focus Banner */}
      {fileNeedingAccess && (
        <div className="mx-4 mt-2 flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200">
          <span className="flex-1">
            <strong>{fileNeedingAccess.name}</strong> isn't syncing yet. Your browser needs permission to read it,
            then you'll see whether it matches this board.
          </span>
          <button
            onClick={handleGrantFileAccess}
            className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-medium shrink-0"
          >
            Check file
          </button>
          <button
            onClick={() => setFileNeedingAccess(null)}
            className="px-2 py-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0"
          >
            Not now
          </button>
        </div>
      )}

      <ActionLine
        workSlot={workIndicator('light')}
        cards={boardData.cards}
        columns={boardData.columns}
        onOpenCard={(cardId) => {
          const card = boardData.cards.find((c) => c.id === cardId);
          if (card) setEditingCard(card);
        }}
      />

      {/* Main Views */}
      <main className="flex-1 mt-1 flex flex-col">
        {isDealOpen ? (
          <DealView
            cards={filteredCards}
            columns={boardData.columns}
            areas={boardData.areas}
            filterLabel={
              selectedAreaId === 'ALL'
                ? null
                : selectedAreaId === 'NO_AREA'
                ? 'No project'
                : areaMap.get(selectedAreaId)?.name || null
            }
            onDone={handleDealDone}
            onUndoDone={handleDealUndoDone}
            onSetEstimate={handleSetEstimate}
            onClose={() => setIsDealOpen(false)}
            workingCardId={work?.mode === 'working' ? work.cardId : null}
            onStartWork={handleStartWork}
            onMakeActive={handleMakeActive}
            onEditCard={setEditingCard}
            paused={!!editingCard || !!pendingStarCard}
          />
        ) : viewMode === 'matrix' ? (
          <MatrixView
            cards={filteredCards}
            archiveCards={filteredArchive}
            columns={boardData.columns}
            areas={boardData.areas}
            workingCardId={work?.mode === 'working' ? work.cardId : null}
            onPlace={handlePlaceOnMatrix}
            onOpenCard={setEditingCard}
            onStartWork={handleStartWork}
            onUseMatrixOrder={handleUseMatrixOrder}
            onReopen={handleReopenCard}
            onOpenArchivedCard={setViewingArchivedCard}
          />
        ) : viewMode === 'board' ? (
          <BoardView
            columns={boardData.columns}
            cards={filteredCards}
            areas={boardData.areas}
            archiveCards={filteredArchive}
            showDetails={showDetails}
            onOpenCardModal={setEditingCard}
            onQuickAddCard={handleQuickAddCard}
            onDragDropCard={handleDragDropCard}
            onToggleStarAttempt={handleToggleStarAttempt}
            onOpenArchivedCard={setViewingArchivedCard}
            workingCardId={work?.mode === 'working' ? work.cardId : null}
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
            archiveCards={filteredArchive}
            onOpenArchivedCard={setViewingArchivedCard}
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
          isWorking={!!editingCard && work?.mode === 'working' && work.cardId === editingCard.id}
          onStartWork={handleStartWork}
          onStopWork={handleStopWork}
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
      {pendingFileSync && (
        <FileSyncModal
          fileName={pendingFileSync.handle.name}
          fileModified={pendingFileSync.lastModified}
          browserSavedAt={pendingFileSync.browserSavedAt}
          diff={pendingFileSync.diff}
          onUseFile={handleUseFile}
          onKeepBrowser={handleKeepBrowser}
          onDecideLater={handleDecideLater}
        />
      )}

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
