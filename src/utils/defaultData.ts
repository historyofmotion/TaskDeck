import { BoardData } from '../types';

export const INITIAL_BOARD_DATA: BoardData = {
  version: 1,
  settings: {
    autoArchiveDays: 7,
    theme: 'system',
    appIcon: 'kanban',
  },
  areas: [
    { id: 'a1', name: 'Work', color: '#3B82F6' },
    { id: 'a2', name: 'Personal', color: '#10B981' },
    { id: 'a3', name: 'Admin', color: '#8B5CF6' },
    { id: 'a4', name: 'Errands', color: '#F59E0B' },
  ],
  columns: [
    { id: 'c1', name: 'Pending', order: 0 },
    { id: 'c2', name: 'In Progress', order: 1 },
    { id: 'c3', name: 'Blocked', order: 2 },
    { id: 'c4', name: 'Done', order: 3 },
  ],
  cards: [
    {
      id: 'k1',
      title: 'Review Q3 roadmap & launch deliverables',
      description: 'Check main project milestones in https://docs.google.com and align with team requirements.',
      areaId: 'a1',
      columnId: 'c2',
      priority: 1,
      starred: true,
      progress: 60,
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      completedAt: null,
    },
    {
      id: 'k2',
      title: 'Schedule annual dentist visit',
      description: 'Call clinic or book online at https://example-clinic.com/book',
      areaId: 'a2',
      columnId: 'c1',
      priority: 2,
      starred: false,
      progress: 0,
      dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Overdue
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      completedAt: null,
    },
    {
      id: 'k3',
      title: 'Organize tax receipts & quarterly file',
      description: 'Gather receipts from email folder.',
      areaId: 'a3',
      columnId: 'c1',
      priority: 3,
      starred: false,
      progress: 25,
      dueDate: null,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      completedAt: null,
    },
  ],
  archive: [],
};
