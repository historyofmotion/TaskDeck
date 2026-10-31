import { BoardData } from '../types';
import { INITIAL_BOARD_DATA } from './defaultData';
import { normalizePriorities, withColumnRoles } from './helpers';
import { parseBoardFile } from './boardCheck';

const LOCAL_STORAGE_KEY = 'personal_kanban_board_data';
const LOCAL_SAVED_AT_KEY = 'personal_kanban_saved_at';
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

// Fill in defaults and column types for any board loaded from storage, an import or a file
export function normalizeBoardData(parsed: Partial<BoardData>): BoardData {
  return {
    version: parsed.version || INITIAL_BOARD_DATA.version,
    settings: {
      ...INITIAL_BOARD_DATA.settings,
      ...(parsed.settings || {}),
    },
    areas: parsed.areas && parsed.areas.length > 0 ? parsed.areas : INITIAL_BOARD_DATA.areas,
    columns: withColumnRoles(
      parsed.columns && parsed.columns.length > 0 ? parsed.columns : INITIAL_BOARD_DATA.columns
    ),
    cards: normalizePriorities(parsed.cards || INITIAL_BOARD_DATA.cards),
    archive: parsed.archive || [],
  };
}

export function loadFromLocalStorage(): BoardData {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return normalizeBoardData(JSON.parse(raw) as Partial<BoardData>);
    }
  } catch (err) {
    console.error('Failed to parse localStorage data:', err);
  }
  return INITIAL_BOARD_DATA;
}

export function saveToLocalStorage(data: BoardData): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(LOCAL_SAVED_AT_KEY, String(Date.now()));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// When the board was last changed in this browser (0 if unknown)
export function getLocalSavedAt(): number {
  try {
    return Number(localStorage.getItem(LOCAL_SAVED_AT_KEY)) || 0;
  } catch {
    return 0;
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

type PermissionHandle = {
  queryPermission?: (options: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: string }) => Promise<PermissionState>;
};

// Check (and optionally ask for) read/write access to a stored file.
// Asking only works from a click, so on startup pass ask=false.
export async function ensureFilePermission(handle: FileSystemFileHandle, ask: boolean): Promise<boolean> {
  const h = handle as unknown as PermissionHandle;
  const options = { mode: 'readwrite' };
  if (!h.queryPermission) return true;
  if ((await h.queryPermission(options)) === 'granted') return true;
  if (!ask || !h.requestPermission) return false;
  return (await h.requestPermission(options)) === 'granted';
}

export interface BoardFileContents {
  handle: FileSystemFileHandle;
  data: BoardData;
  lastModified: number;
  fixes: string[]; // small problems repaired while checking the file
}

// Read and check a board file without connecting to it.
// Throws BoardCheckError if the file can't be used.
export async function readBoardFile(handle: FileSystemFileHandle): Promise<BoardFileContents> {
  const file = await handle.getFile();
  const { data, fixes } = parseBoardFile(await file.text());
  return { handle, data, lastModified: file.lastModified, fixes };
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

// Prompt to pick a file. It is NOT connected yet: the caller compares it with the browser copy first.
export async function pickBoardFile(): Promise<BoardFileContents | null> {
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

    return await readBoardFile(handle);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return null;
    console.error('Error opening board file:', err);
    throw err;
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
