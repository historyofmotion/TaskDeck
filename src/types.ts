export type ThemeOption = 'light' | 'dark' | 'system';

export interface Settings {
  autoArchiveDays: number;
  theme: ThemeOption;
  appIcon?: string;
}

export interface Area {
  id: string;
  name: string;
  color: string;
}

// What a column means, independent of its name. Renaming a column keeps its role.
export type ColumnRole = 'pending' | 'active' | 'blocked' | 'done';

export interface Column {
  id: string;
  name: string;
  order: number;
  role?: ColumnRole; // filled in on load for older boards (see withColumnRoles)
}

export interface CardItem {
  id: string;
  title: string;
  description: string;
  areaId: string | null;
  columnId: string;
  priority: number; // Single global priority rank (1, 2, 3...)
  starred: boolean;
  progress: number; // 0 to 100
  dueDate: string | null; // YYYY-MM-DD
  createdAt: string; // ISO string
  completedAt: string | null; // ISO string
  archivedAt?: string | null;
}

export interface BoardData {
  version: number;
  settings: Settings;
  areas: Area[];
  columns: Column[];
  cards: CardItem[];
  archive: CardItem[];
}

export type ViewMode = 'board' | 'list';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}
