import { BoardData } from '../types';
import { INITIAL_BOARD_DATA } from './defaultData';
import { normalizePriorities } from './helpers';

const LOCAL_STORAGE_KEY = 'personal_kanban_board_data';
const DB_NAME = 'PersonalKanbanDB';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'board_file_handle';

// Initialize IndexedDB to store FileSystemFileHandle across reloads
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFileHandle(handle: FileSystemFileHandle): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
  } catch (err) {
    console.warn('Failed to store file handle in IndexedDB:', err);
  }
}

export async function getStoredFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function loadFromLocalStorage(): BoardData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BoardData>;
      return {
        version: parsed.version || INITIAL_BOARD_DATA.version,
        settings: {
          ...INITIAL_BOARD_DATA.settings,
          ...(parsed.settings || {}),
        },
        areas: parsed.areas && parsed.areas.length > 0 ? parsed.areas : INITIAL_BOARD_DATA.areas,
        columns: parsed.columns && parsed.columns.length > 0 ? parsed.columns : INITIAL_BOARD_DATA.columns,
        cards: normalizePriorities(parsed.cards || INITIAL_BOARD_DATA.cards),
        archive: parsed.archive || [],
      };
    }
  } catch (err) {
    console.error('Failed to parse localStorage data:', err);
  }
  return INITIAL_BOARD_DATA;
}

export function saveToLocalStorage(data: BoardData): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Debounce file writer
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let activeFileHandle: FileSystemFileHandle | null = null;
let pendingDataToSave: BoardData | null = null;

export function setActiveFileHandle(handle: FileSystemFileHandle | null) {
  activeFileHandle = handle;
  if (handle) {
    storeFileHandle(handle);
  }
}

export function getActiveFileHandle(): FileSystemFileHandle | null {
  return activeFileHandle;
}

export async function saveToFileSystem(data: BoardData): Promise<boolean> {
  if (!activeFileHandle) return false;
  try {
    const handle = activeFileHandle as unknown as {
      queryPermission?: (options: { mode: string }) => Promise<PermissionState>;
      requestPermission?: (options: { mode: string }) => Promise<PermissionState>;
      createWritable: () => Promise<FileSystemWritableFileStream>;
    };

    const options = { mode: 'readwrite' };
    if (handle.queryPermission) {
      if ((await handle.queryPermission(options)) !== 'granted') {
        if (handle.requestPermission) {
          const status = await handle.requestPermission(options);
          if (status !== 'granted') return false;
        }
      }
    }

    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Failed writing to file handle:', err);
    return false;
  }
}

export function debouncedSave(data: BoardData, onSavedToFile?: (success: boolean) => void): void {
  saveToLocalStorage(data);
  pendingDataToSave = data;

  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (activeFileHandle && pendingDataToSave) {
      try {
        const success = await saveToFileSystem(pendingDataToSave);
        if (onSavedToFile) onSavedToFile(success);
      } catch (e) {
        console.error('Error during file save execution:', e);
      } finally {
        pendingDataToSave = null;
      }
    }
  }, 500);
}

export function flushPendingSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (activeFileHandle && pendingDataToSave) {
    saveToFileSystem(pendingDataToSave).catch((e) =>
      console.warn('Flush file save failed on page exit:', e)
    );
    pendingDataToSave = null;
  }
}

// Prompt to pick file or create new
export async function pickBoardFile(): Promise<{ handle: FileSystemFileHandle; data: BoardData } | null> {
  if (!('showOpenFilePicker' in window)) {
    alert('File System Access API is not supported in this browser. You can use Export / Import in Options instead.');
    return null;
  }

  try {
    const [handle] = await (window as unknown as {
      showOpenFilePicker: (options: object) => Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker({
      types: [
        {
          description: 'JSON Board Files',
          accept: { 'application/json': ['.json'] },
        },
      ],
      multiple: false,
    });

    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text) as BoardData;

    setActiveFileHandle(handle);
    return { handle, data };
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Error opening board file:', err);
    }
    return null;
  }
}

export async function createBoardFile(data: BoardData): Promise<FileSystemFileHandle | null> {
  if (!('showSaveFilePicker' in window)) {
    alert('File System Access API is not supported in this browser.');
    return null;
  }

  try {
    const handle = await (window as unknown as {
      showSaveFilePicker: (options: object) => Promise<FileSystemFileHandle>;
    }).showSaveFilePicker({
      suggestedName: 'board.json',
      types: [
        {
          description: 'JSON Board File',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });

    setActiveFileHandle(handle);
    await saveToFileSystem(data);
    return handle;
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Error creating board file:', err);
    }
    return null;
  }
}

export function exportBoardAsJSON(data: BoardData): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kanban-board-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
