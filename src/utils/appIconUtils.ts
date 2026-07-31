import React from 'react';
import { Kanban, Layers, Sparkles, CheckCircle2, Rocket, LayoutGrid, LucideIcon } from 'lucide-react';

export interface AppIconOption {
  id: string;
  name: string;
  tagline: string;
  description: string;
  gradientClass: string;
  shadowClass: string;
  badgeBg: string;
  IconComponent: LucideIcon;
  svgFavicon: string;
}

export const APP_ICON_OPTIONS: AppIconOption[] = [
  {
    id: 'kanban',
    name: 'Classic Kanban',
    tagline: 'Standard 3-Column Deck',
    description: 'Vibrant indigo to pink gradient with 3-column kanban board layout. Intuitive and timeless.',
    gradientClass: 'from-indigo-600 via-purple-600 to-pink-500',
    shadowClass: 'shadow-indigo-500/25',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    IconComponent: Kanban,
    svgFavicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#4f46e5"/><stop offset="50%" stop-color="#9333ea"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M9 8v12M16 8v7M23 8v15" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'deck',
    name: '3D Stacked Deck',
    tagline: 'Multi-Layered Perspective',
    description: 'Deep sapphire to cyan gradient featuring floating 3D task card deck layers in elevation.',
    gradientClass: 'from-blue-600 via-indigo-600 to-cyan-400',
    shadowClass: 'shadow-blue-500/25',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    IconComponent: Layers,
    svgFavicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#2563eb"/><stop offset="50%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M16 7L7 12l9 5 9-5-9-5zM7 17l9 5 9-5M7 22l9 5 9-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'star',
    name: 'Priority Ember',
    tagline: 'Focus-Starred Deck',
    description: 'Warm sunset gradient with a glowing star ember highlighting top priority focus tasks.',
    gradientClass: 'from-amber-500 via-rose-500 to-purple-600',
    shadowClass: 'shadow-amber-500/25',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    IconComponent: Sparkles,
    svgFavicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="50%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#9333ea"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M16 6l2.5 6.5L25 15l-6.5 2.5L16 24l-2.5-6.5L7 15l6.5-2.5L16 6z" fill="white"/></svg>`,
  },
  {
    id: 'check',
    name: 'Check Deck',
    tagline: 'Completion & Productivity',
    description: 'Refreshing emerald to cyan gradient with an integrated high-satisfaction task check mark.',
    gradientClass: 'from-emerald-500 via-teal-600 to-cyan-500',
    shadowClass: 'shadow-emerald-500/25',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    IconComponent: CheckCircle2,
    svgFavicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#10b981"/><stop offset="50%" stop-color="#0d9488"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M10 16.5l4 4 8-8" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'rocket',
    name: 'Speed Launcher',
    tagline: 'High-Velocity Workflow',
    description: 'Fiery crimson and violet launch gradient signifying rapid execution and momentum.',
    gradientClass: 'from-orange-500 via-red-600 to-purple-700',
    shadowClass: 'shadow-orange-500/25',
    badgeBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    IconComponent: Rocket,
    svgFavicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f97316"/><stop offset="50%" stop-color="#dc2626"/><stop offset="100%" stop-color="#7e22ce"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><path d="M19 7c-4 0-7 3-8 6l-3 1 2 2-1 3 3-1 2 2 1-3c3-1 6-4 6-8v-2h-2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: 'grid',
    name: 'Minimalist T-Deck',
    tagline: 'Geometric Dark Mode',
    description: 'Sleek dark navy and electric purple geometric grid mark crafted for dark mode aesthetics.',
    gradientClass: 'from-slate-800 via-indigo-900 to-violet-800 border border-slate-700/50',
    shadowClass: 'shadow-slate-900/40',
    badgeBg: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    IconComponent: LayoutGrid,
    svgFavicon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#1e293b"/><stop offset="50%" stop-color="#312e81"/><stop offset="100%" stop-color="#5b21b6"/></linearGradient></defs><rect width="32" height="32" rx="8" fill="url(#g)"/><rect x="7" y="7" width="8" height="8" rx="2" fill="white"/><rect x="17" y="7" width="8" height="8" rx="2" stroke="white" stroke-width="2"/><rect x="7" y="17" width="8" height="8" rx="2" stroke="white" stroke-width="2"/><rect x="17" y="17" width="8" height="8" rx="2" fill="white"/></svg>`,
  },
];

export function getAppIconConfig(iconId?: string): AppIconOption {
  const found = APP_ICON_OPTIONS.find((opt) => opt.id === iconId);
  return found || APP_ICON_OPTIONS[0];
}

export function updateBrowserFavicon(iconId?: string): void {
  const config = getAppIconConfig(iconId);

  // Remove all existing icon links to force browser tab DOM refresh
  const existingFavicons = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
  existingFavicons.forEach((el) => el.remove());

  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(config.svgFavicon)}`;

  // Primary SVG favicon
  const faviconLink = document.createElement('link');
  faviconLink.rel = 'icon';
  faviconLink.type = 'image/svg+xml';
  faviconLink.href = svgDataUrl;
  document.head.appendChild(faviconLink);

  // Shortcut icon fallback for browser compatibility
  const shortcutLink = document.createElement('link');
  shortcutLink.rel = 'shortcut icon';
  shortcutLink.type = 'image/svg+xml';
  shortcutLink.href = svgDataUrl;
  document.head.appendChild(shortcutLink);
}
