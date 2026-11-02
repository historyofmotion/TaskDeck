import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, PanInfo, useMotionValue } from 'motion/react';
import { ArrowUp, Ban, Check, ChevronDown, ChevronRight, Clock, ExternalLink, ListOrdered, Pencil, Play, Star, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Area, CardItem, Column, ColumnRole } from '../types';
import { extractUrls, formatDueDateLabel, formatHours, getColumnRole } from '../utils/helpers';
import { formatTracked } from '../utils/workTracking';

// Matrix: drag each open card to a spot on two axes.
//   vertical   = Impact     (major at the top, minor at the bottom)
//   horizontal = Timeframe  (when possible on the left, immediate on the right)
// The four corners are Important (top left), Urgent (top right), Questionable (bottom left), Needed (bottom right).

export type Quadrant = 'urgent' | 'important' | 'needed' | 'questionable';

export const quadrantOf = (m: { x: number; y: number }): Quadrant =>
  m.y >= 0.5 ? (m.x >= 0.5 ? 'urgent' : 'important') : m.x >= 0.5 ? 'needed' : 'questionable';

// Order used for "Use matrix order": Urgent, Important, Needed, Questionable;
// inside a quadrant, the card nearest the top-right corner comes first.
export const QUADRANT_ORDER: Quadrant[] = ['urgent', 'important', 'needed', 'questionable'];
export const matrixScore = (m: { x: number; y: number }) => m.x + m.y;

const QUADRANTS: Record<Quadrant, { name: string; sub: string; corner: string; tint: string; lit: string; text: string }> = {
  important: {
    name: 'Important',
    sub: 'Major impact, can wait: protect time for it',
    corner: 'top-2.5 left-3 text-left',
    tint: 'bg-blue-50 dark:bg-blue-950/25',
    lit: 'bg-blue-100 dark:bg-blue-900/45 ring-blue-400 dark:ring-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
  },
  urgent: {
    name: 'Urgent',
    sub: 'Major impact, needed now',
    corner: 'top-2.5 right-3 text-right',
    tint: 'bg-emerald-50 dark:bg-emerald-950/25',
    lit: 'bg-emerald-100 dark:bg-emerald-900/45 ring-emerald-400 dark:ring-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  needed: {
    name: 'Needed',
    sub: 'Minor, but needed soon: get it off your plate',
    corner: 'bottom-2.5 right-3 text-right',
    tint: 'bg-yellow-50 dark:bg-yellow-950/20',
    lit: 'bg-yellow-100 dark:bg-yellow-900/40 ring-yellow-400 dark:ring-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
  questionable: {
    name: 'Questionable',
    sub: 'Minor and can wait: question it',
    corner: 'bottom-2.5 left-3 text-left',
    tint: 'bg-slate-50 dark:bg-slate-900',
    lit: 'bg-slate-100 dark:bg-slate-800 ring-slate-400 dark:ring-slate-500',
    text: 'text-slate-600 dark:text-slate-400',
  },
};

// Where each quadrant starts on the 0–1 scale (each spans half of each axis)
const ORIGIN: Record<Quadrant, Point> = {
  important: { x: 0, y: 0.5 },
  urgent: { x: 0.5, y: 0.5 },
  needed: { x: 0.5, y: 0 },
  questionable: { x: 0, y: 0 },
};

// Where each quadrant sits in the full grid, as a transform-origin
const CORNER: Record<Quadrant, string> = {
  important: 'top left',
  urgent: 'top right',
  needed: 'bottom right',
  questionable: 'bottom left',
};

const ROLE_ORDER: Record<string, number> = { active: 0, blocked: 1, pending: 2 };

const RECENT_DAYS = 7;

interface MatrixViewProps {
  cards: CardItem[]; // board cards after search / project filter
  archiveCards: CardItem[];
  columns: Column[];
  areas: Area[];
  workingCardId: string | null;
  onPlace: (cardId: string, pos: { x: number; y: number } | null) => void;
  onOpenCard: (card: CardItem) => void;
  onStartWork: (cardId: string) => void;
  onUseMatrixOrder: () => void;
  onReopen: (cardId: string, pos: { x: number; y: number } | null) => void; // Done → open again (optionally placed)
  onOpenArchivedCard: (card: CardItem) => void;
}

export const MatrixView: React.FC<MatrixViewProps> = ({
  cards,
  archiveCards,
  columns,
  areas,
  workingCardId,
  onPlace,
  onOpenCard,
  onStartWork,
  onUseMatrixOrder,
  onReopen,
  onOpenArchivedCard,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // What a dragged card would land in right now: a quadrant, the tray, or nothing
  const [hover, setHover] = useState<Quadrant | 'tray' | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  // One quadrant blown up to fill the whole grid, for finer placement
  const [zoom, setZoom] = useState<Quadrant | null>(null);
  // Zooming animates the grid: in, it grows from the quadrant's corner; out, it shrinks back into it
  const [zooming, setZooming] = useState(false);
  const prevZoom = useRef<Quadrant | null>(null);
  const zoomKey = zoom || 'all';
  const zoomFrom = zoom ? { scale: 0.5, corner: zoom } : prevZoom.current ? { scale: 2, corner: prevZoom.current } : null;
  const lastZoomKey = useRef(zoomKey);
  const zoomOrigin = useRef('center');
  if (lastZoomKey.current !== zoomKey) {
    lastZoomKey.current = zoomKey;
    zoomOrigin.current = zoomFrom ? CORNER[zoomFrom.corner] : 'center';
  }
  useEffect(() => {
    prevZoom.current = zoom;
  }, [zoom]);
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const roleOf = useMemo(() => {
    const m = new Map<string, ColumnRole>(columns.map((c) => [c.id, getColumnRole(c)]));
    return (c: CardItem): ColumnRole | undefined => m.get(c.columnId);
  }, [columns]);

  // Open cards only (Done cards are listed as "Recently done" instead)
  const open = cards.filter((c) => roleOf(c) !== 'done').sort((a, b) => a.priority - b.priority);
  const placed = open.filter((c) => c.matrix);
  // Not placed: in progress first, then blocked, then pending (each in rank order)
  const unplaced = open
    .filter((c) => !c.matrix)
    .sort((a, b) => (ROLE_ORDER[roleOf(a) || 'pending'] ?? 3) - (ROLE_ORDER[roleOf(b) || 'pending'] ?? 3) || a.priority - b.priority);

  const urgent = placed
    .filter((c) => quadrantOf(c.matrix!) === 'urgent')
    .sort((a, b) => matrixScore(b.matrix!) - matrixScore(a.matrix!));
  const urgentHours = urgent.reduce((t, c) => t + (c.estimateHours || 0), 0);
  const urgentUnestimated = urgent.filter((c) => !c.estimateHours).length;

  const since = Date.now() - RECENT_DAYS * 24 * 3600 * 1000;
  const recentDone = [...cards.filter((c) => roleOf(c) === 'done'), ...archiveCards]
    .filter((c) => c.completedAt && new Date(c.completedAt).getTime() >= since)
    .sort((a, b) => (b.completedAt! > a.completedAt! ? 1 : -1))
    .slice(0, 6);

  const archiveIds = useMemo(() => new Set(archiveCards.map((c) => c.id)), [archiveCards]);
  const selected = [...open, ...recentDone].find((c) => c.id === selectedId) || urgent[0];

  // Where a drag is: the grid spot under the card's circle (0–1 on each axis), the tray under the pointer, or nowhere
  const locate = (e: MouseEvent | TouchEvent | PointerEvent, dot: Point): { x: number; y: number } | 'tray' | null => {
    const pt = 'changedTouches' in e ? e.changedTouches[0] : (e as MouseEvent);
    const g = gridRef.current?.getBoundingClientRect();
    const slack = 24; // a circle dropped just past the edge still counts, and lands at the edge
    if (g && dot.x >= g.left - slack && dot.x <= g.right + slack && dot.y >= g.top - slack && dot.y <= g.bottom + slack) {
      // closest the circle can get while the whole pill stays inside the grid
      const mx = 16 / g.width;
      const my = 16 / g.height;
      const vx = Math.min(1 - mx, Math.max(mx, (dot.x - g.left) / g.width));
      const vy = Math.min(1 - my, Math.max(my, 1 - (dot.y - g.top) / g.height));
      // zoomed in, the grid shows just one quadrant (half of each axis)
      return zoom ? { x: ORIGIN[zoom].x + vx * 0.5, y: ORIGIN[zoom].y + vy * 0.5 } : { x: vx, y: vy };
    }
    const t = trayRef.current?.getBoundingClientRect();
    if (t && pt.clientX >= t.left && pt.clientX <= t.right && pt.clientY >= t.top && pt.clientY <= t.bottom) return 'tray';
    return null;
  };

  // While dragging: light up only the quadrant (or the tray) it would drop into
  const handleDragMove = (e: MouseEvent | TouchEvent | PointerEvent, dot: Point) => {
    const spot = locate(e, dot);
    setHover(spot === 'tray' ? 'tray' : spot ? quadrantOf(spot) : null);
  };

  // Returns true if the card was moved (the pill then re-appears at its new spot), false if it should slide back
  const handleDrop = (card: CardItem, e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, dot: Point): boolean => {
    setHover(null);
    if (Math.hypot(info.offset.x, info.offset.y) < 4) return false; // a click, not a move
    const spot = locate(e, dot);
    const isDone = roleOf(card) === 'done' || archiveIds.has(card.id);
    setSelectedId(card.id);
    if (isDone) {
      // A finished card dragged back onto the grid (or the tray) is open again
      if (!spot) return false;
      onReopen(card.id, spot === 'tray' ? null : spot);
      return true;
    }
    if (spot === 'tray') {
      if (!card.matrix) return false;
      onPlace(card.id, null);
      return true;
    }
    if (!spot) return false;
    onPlace(card.id, spot);
    return true;
  };

  const chipProps = (c: CardItem) => ({
    card: c,
    role: roleOf(c),
    area: areaById.get(c.areaId || ''),
    selected: selected?.id === c.id,
    working: c.id === workingCardId,
    onSelect: () => setSelectedId(c.id),
    onOpen: () => onOpenCard(c),
    onDragMove: handleDragMove,
    onDrop: (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, dot: Point) => handleDrop(c, e, info, dot),
  });

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 pb-6 grid grid-cols-1 xl:grid-cols-[auto_320px] justify-center gap-5">
      {/* ---- The matrix (sized so each quadrant is a square) ---- */}
      <div className="min-w-0 mx-auto w-[min(92vw,900px,max(460px,calc(100vh-18rem)))]">
        <div className="flex">
          {/* vertical axis */}
          <div className="w-6 shrink-0 flex flex-col items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 select-none">
            <span className="[writing-mode:vertical-rl] rotate-180">{zoom && ORIGIN[zoom].y < 0.5 ? 'Middle' : 'Major'}</span>
            <span className="flex flex-col items-center gap-1">
              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="[writing-mode:vertical-rl] rotate-180 tracking-[0.2em]">Impact</span>
            </span>
            <span className="[writing-mode:vertical-rl] rotate-180">{zoom && ORIGIN[zoom].y >= 0.5 ? 'Middle' : 'Minor'}</span>
          </div>

          <div
            ref={gridRef}
            className={`relative flex-1 min-w-0 self-start aspect-square rounded-xl border border-slate-200 dark:border-slate-800 ${zooming ? 'overflow-hidden' : ''}`}
          >
            <motion.div
              key={zoomKey}
              className="absolute inset-0 grid grid-cols-2 grid-rows-2"
              style={{ transformOrigin: zoomOrigin.current }}
              initial={zoomFrom ? { scale: zoomFrom.scale, opacity: 0.55 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onAnimationStart={() => setZooming(true)}
              onAnimationComplete={() => setZooming(false)}
            >
            {(zoom ? [zoom] : (['important', 'urgent', 'questionable', 'needed'] as Quadrant[])).map((q) => (
              <div key={q} onDoubleClick={() => setZoom(zoom ? null : q)} title={zoom ? 'Double-click to zoom back out' : `Double-click to zoom in on ${QUADRANTS[q].name}`} className={`relative select-none transition-colors ${zoom ? 'col-span-2 row-span-2 rounded-xl' : { important: 'rounded-tl-xl', urgent: 'rounded-tr-xl', questionable: 'rounded-bl-xl', needed: 'rounded-br-xl' }[q]} ${hover === q ? `${QUADRANTS[q].lit} ring-2 ring-inset z-[5]` : QUADRANTS[q].tint
              } border-slate-200/80 dark:border-slate-800 ${!zoom && (q === 'important' || q === 'questionable') ? 'border-r' : ''} ${!zoom && (q === 'important' || q === 'urgent') ? 'border-b' : ''}`}>
                <div className={`absolute ${QUADRANTS[q].corner} select-none z-[5] pointer-events-none`}>
                  <p className={`text-xs font-bold flex items-center gap-1 ${QUADRANTS[q].text} ${QUADRANTS[q].corner.includes('text-right') ? 'flex-row-reverse' : ''}`}>
                    {QUADRANTS[q].name}
                    <button
                      onClick={() => setZoom(zoom ? null : q)}
                      title={zoom ? 'Back to all four quadrants (Esc)' : `Zoom in on ${QUADRANTS[q].name} to place cards more precisely`}
                      aria-label={zoom ? 'Show all four quadrants' : `Zoom in on ${QUADRANTS[q].name}`}
                      className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 pointer-events-auto"
                    >
                      {zoom ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                    </button>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[180px] leading-tight pointer-events-none">
                    {zoom ? `Zoomed in · ${QUADRANTS[q].sub}` : QUADRANTS[q].sub}
                  </p>
                </div>
              </div>
            ))}

            {/* placed cards: the circle sits exactly on the spot; the title runs right, or left near the right edge */}
            {placed
              .filter((c) => !zoom || quadrantOf(c.matrix!) === zoom)
              .map((c) => (
                <PlacedChip
                  key={`${c.id}:${c.matrix!.x}:${c.matrix!.y}:${zoom || ''}`}
                  card={c}
                  pos={zoom ? { x: (c.matrix!.x - ORIGIN[zoom].x) * 2, y: (c.matrix!.y - ORIGIN[zoom].y) * 2 } : c.matrix!}
                  chip={chipProps(c)}
                />
              ))}

            {placed.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 pointer-events-none">
                Drag cards from the tray below onto the grid
              </p>
            )}
            </motion.div>
          </div>
        </div>

        {/* horizontal axis */}
        <div className="ml-6 mt-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400 select-none">
          <span>{zoom && ORIGIN[zoom].x >= 0.5 ? 'Middle' : 'When possible'}</span>
          <span className="tracking-[0.2em]">Timeframe →</span>
          <span>{zoom && ORIGIN[zoom].x < 0.5 ? 'Middle' : 'Immediate'}</span>
        </div>

        {/* tray of cards not placed yet (drop a card here to take it off the grid) */}
        <div
          ref={trayRef}
          className={`ml-6 mt-3 rounded-xl border border-dashed p-2.5 transition-colors ${
            hover === 'tray' ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-600 dark:bg-indigo-950/30' : 'border-slate-300 dark:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2 text-[11px]">
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Not placed yet <span className="text-slate-400 font-normal">{unplaced.length}</span>
            </span>
            <span className="text-slate-400">Drag onto the grid · drop back here to unplace</span>
          </div>
          {unplaced.length ? (
            <div className="flex flex-wrap gap-1.5">
              {unplaced.map((c) => (
                <Chip key={c.id} {...chipProps(c)} />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Every open card is on the grid.</p>
          )}
        </div>

        {/* legend */}
        <div className="ml-6 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" /> To do
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900" /> In progress
          </span>
          <span className="flex items-center gap-1.5">
            <Ban className="w-3 h-3 text-red-500" /> Blocked
          </span>
          <span className="text-slate-400">Click to see details · double-click to edit</span>
        </div>
      </div>

      {/* ---- Side panel ---- */}
      <aside className="flex flex-col gap-4 min-w-0">
        {/* the point of this view: turn the placement into the board's ranking */}
        <section className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-4 flex flex-col gap-2">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Rank your board from this matrix</p>
          <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 leading-relaxed">
            Urgent first, then Important, Needed, Questionable; nearest the top-right corner first within each. Starred cards stay on top, and cards you haven't placed follow.
          </p>
          <button
            onClick={onUseMatrixOrder}
            disabled={placed.length === 0}
            title="Renumber the board's ranks from where the cards sit on the matrix"
            className="mt-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm disabled:opacity-40 disabled:hover:bg-indigo-600"
          >
            <ListOrdered className="w-4 h-4" />
            Use matrix order for ranks
          </button>
          {placed.length === 0 && <p className="text-[11px] text-indigo-800/70 dark:text-indigo-200/70">Place some cards first.</p>}
        </section>

        <section>
          <p className="text-xs text-slate-500 dark:text-slate-400">Your Urgent corner</p>
          <p className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
            {formatHours(urgentHours) || '0h'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {urgent.length} card{urgent.length === 1 ? '' : 's'}
            {urgentUnestimated ? ` · ${urgentUnestimated} without an estimate` : ''}
          </p>
          {urgent.length > 0 && (
            <ol className="mt-2 divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
              {urgent.map((c, i) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full flex items-center gap-2 py-1.5 text-left text-xs hover:text-emerald-700 dark:hover:text-emerald-300 ${
                      selected?.id === c.id ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-4 text-slate-400 tabular-nums">{i + 1}</span>
                    <span className="flex-1 truncate">{c.title}</span>
                    <span className="text-slate-400 tabular-nums">{formatHours(c.estimateHours) || '—'}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* details of the selected card */}
        <AnimatePresence mode="wait">
          {selected && (
            <motion.section
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2 shadow-xs"
            >
              <Details
                card={selected}
                role={roleOf(selected)}
                area={areaById.get(selected.areaId || '')}
                working={selected.id === workingCardId}
                onStart={() => onStartWork(selected.id)}
                onEdit={() => (archiveIds.has(selected.id) ? onOpenArchivedCard(selected) : onOpenCard(selected))}
                onNotDone={() => onReopen(selected.id, null)}
              />
            </motion.section>
          )}
        </AnimatePresence>


        {/* finished in the last week, folded away until you want one back */}
        {recentDone.length > 0 && (
          <section>
            <button
              onClick={() => setDoneOpen((o) => !o)}
              aria-expanded={doneOpen}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
            >
              {doneOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Done in the last {RECENT_DAYS} days
              <span className="font-normal text-slate-400">{recentDone.length}</span>
            </button>
            {doneOpen && (
              <ul className="mt-2 flex flex-col gap-1.5">
                {recentDone.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <div className="min-w-0">
                      <Chip {...chipProps(c)} role="done" />
                    </div>
                    <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                      {new Date(c.completedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                      onClick={() => onReopen(c.id, null)}
                      title="Make it active again: it goes back to your To do column"
                      className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Undo2 className="w-3 h-3" />
                      Make active
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {doneOpen && <p className="mt-1.5 text-[11px] text-slate-400">Or drag one onto the grid to place it too.</p>}
          </section>
        )}
      </aside>
    </div>
  );
};

type Point = { x: number; y: number };

// A placed card. The circle is the card's exact spot; the title runs to its right, or to its left
// when it would pass the right edge of the grid, so the whole pill stays inside.
const PlacedChip: React.FC<{
  card: CardItem;
  pos: Point; // where it is on the grid being shown (0–1 on each axis)
  chip: Omit<React.ComponentProps<typeof Chip>, 'flip' | 'onDragging'>;
}> = ({ card, pos, chip }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);
  const [lifted, setLifted] = useState(false); // being dragged: sit above the other pills
  const m = pos;
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      const g = el?.parentElement; // the grid (its ref isn't attached yet on first mount)
      if (!el || !g) return;
      setFlip(m.x * g.clientWidth + (el.offsetWidth - DOT_OFFSET) > g.clientWidth - 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current?.parentElement) ro.observe(wrapRef.current.parentElement);
    return () => ro.disconnect();
  }, [m.x, card.title, card.starred, chip.role]);
  return (
    <div
      ref={wrapRef}
      className={`absolute w-max max-w-[190px] ${lifted ? 'z-50' : chip.selected ? 'z-40' : 'z-10'}`}
      style={{
        // never closer than a pill's half-height / circle offset to an edge (cards on a quadrant's border sit just inside it)
        left: `clamp(${DOT_OFFSET}px, ${m.x * 100}%, calc(100% - ${DOT_OFFSET}px))`,
        top: `clamp(14px, ${(1 - m.y) * 100}%, calc(100% - 14px))`,
        transform: flip ? `translate(calc(-100% + ${DOT_OFFSET}px), -50%)` : `translate(-${DOT_OFFSET}px, -50%)`,
      }}
    >
      <Chip {...chip} flip={flip} onDragging={setLifted} />
    </div>
  );
};

const DOT_OFFSET = 14; // from a pill's edge to the centre of its circle

// ---- A card on the matrix: a small pill you can drag ----

const Chip: React.FC<{
  card: CardItem;
  role?: ColumnRole;
  area?: Area;
  selected: boolean;
  working: boolean;
  onSelect: () => void;
  onOpen: () => void;
  flip?: boolean; // circle on the right, title to its left
  onDragging?: (dragging: boolean) => void;
  onDragMove: (e: MouseEvent | TouchEvent | PointerEvent, dot: Point) => void;
  onDrop: (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo, dot: Point) => boolean;
}> = ({ card, role, area, selected, working, flip, onDragging, onSelect, onOpen, onDragMove, onDrop }) => {
  const dotRef = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [dragging, setDragging] = useState(false);
  // The circle's spot is where it was when you pressed, plus how far the pointer has moved since
  const startDot = useRef<Point>({ x: -1, y: -1 });
  const startPointer = useRef<Point>({ x: 0, y: 0 });
  const moved = (e: MouseEvent | TouchEvent | PointerEvent): Point => {
    const pt = 'changedTouches' in e ? e.changedTouches[0] : (e as MouseEvent);
    return { x: startDot.current.x + pt.clientX - startPointer.current.x, y: startDot.current.y + pt.clientY - startPointer.current.y };
  };
  const dotCentre = (): Point => {
    const r = dotRef.current?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: -1, y: -1 };
  };
  const blocked = role === 'blocked';
  const active = role === 'active';
  const done = role === 'done';
  return (
    <motion.button
      drag
      dragMomentum={false}
      dragElastic={0}
      whileDrag={{ zIndex: 50, cursor: 'grabbing', opacity: 0.7, boxShadow: '0 8px 18px rgba(15,23,42,0.18)' }}
      style={{ x, y }}
      onDragStart={() => {
        setDragging(true);
        onDragging?.(true);
      }}
      onPointerDown={(e) => {
        startDot.current = dotCentre();
        startPointer.current = { x: e.clientX, y: e.clientY };
      }}
      onDrag={(e) => onDragMove(e, moved(e))}
      onDragEnd={(e, info) => {
        setDragging(false);
        onDragging?.(false);
        // A moved card stays exactly where it was dropped until it re-appears at its saved spot (no hop back);
        // a card that wasn't moved slides home.
        if (!onDrop(e, info, moved(e))) {
          animate(x, 0, { duration: 0.18 });
          animate(y, 0, { duration: 0.18 });
        }
      }}
      onTap={onSelect}
      onDoubleClick={onOpen}
      title={`${card.title}${blocked ? ' (blocked)' : active ? ' (in progress)' : done ? ' (done)' : ''}`}
      className={`relative flex items-center gap-1.5 h-7 max-w-[190px] ${flip ? 'flex-row-reverse pr-1.5 pl-2.5' : 'pl-1.5 pr-2.5'} rounded-full border text-xs font-medium shadow-xs cursor-grab touch-none select-none whitespace-nowrap ${
        done
          ? 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400'
          : blocked
          ? 'border-dashed border-red-300 bg-red-50 text-slate-500 dark:border-red-800 dark:bg-red-950/40 dark:text-slate-400'
          : active
          ? 'border-emerald-300 bg-white text-slate-800 dark:border-emerald-700 dark:bg-slate-800 dark:text-slate-100'
          : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
      } ${selected ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
    >
      <span ref={dotRef} className={`flex w-4 h-4 shrink-0 transition-opacity ${dragging ? 'opacity-40' : ''}`}>
        {done ? (
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
        ) : blocked ? (
          <Ban className="w-4 h-4 text-red-500 shrink-0" />
        ) : active ? (
          <span className="relative flex w-4 h-4 shrink-0 items-center justify-center rounded-full bg-emerald-500">
            {working && <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping motion-reduce:animate-none" />}
            <Play className="relative w-2.5 h-2.5 text-white fill-white" />
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0 rounded-full border-2" style={{ borderColor: area?.color || '#94a3b8' }} />
        )}
      </span>
      {(active || blocked) && area && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: area.color }} />}
      <span className={`truncate ${blocked ? 'line-through decoration-red-300/70' : done ? 'line-through decoration-slate-300 dark:decoration-slate-600' : ''}`}>{card.title}</span>
      {card.starred && <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-500" />}
    </motion.button>
  );
};

// ---- Selected card details ----

const Details: React.FC<{
  card: CardItem;
  role?: ColumnRole;
  area?: Area;
  working: boolean;
  onStart: () => void;
  onEdit: () => void;
  onNotDone: () => void;
}> = ({ card, role, area, working, onStart, onEdit, onNotDone }) => {
  const isDone = role === 'done';
  const due = formatDueDateLabel(card.dueDate);
  const q = card.matrix ? QUADRANTS[quadrantOf(card.matrix)] : null;
  const urls = extractUrls(card.description);
  const text = card.description.replace(/https?:\/\/\S+/g, '').trim();
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: area?.color || '#94a3b8' }} />
        <span>{area?.name || 'No project'}</span>
        <span className="ml-auto flex items-center gap-1.5">
          {role === 'blocked' && <span className="text-red-600 dark:text-red-400 font-medium">Blocked</span>}
          {role === 'active' && <span className="text-emerald-600 dark:text-emerald-400 font-medium">In progress</span>}
          {isDone && (
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              Done{card.completedAt ? ` ${new Date(card.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
            </span>
          )}
          {isDone ? null : q ? <span className={`font-medium ${q.text}`}>{q.name}</span> : <span>Not placed</span>}
        </span>
      </div>
      <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-slate-100 break-words">{card.title}</h3>
      {text && <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line line-clamp-4 break-words">{text}</p>}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {urls.map((u) => (
            <a
              key={u}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              title={u}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <ExternalLink className="w-3 h-3" />
              {(() => {
                try {
                  return new URL(u).hostname.replace(/^www\./, '');
                } catch {
                  return 'link';
                }
              })()}
            </a>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
        <Clock className="w-3.5 h-3.5" />
        <span>
          {card.trackedSeconds ? `${formatTracked(card.trackedSeconds)} of ` : ''}
          {formatHours(card.estimateHours) || 'No estimate'}
          {due.label ? ` · ${due.label}` : ''}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={onEdit}
            title="Edit this card"
            aria-label="Edit"
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {isDone ? (
            <button
              onClick={onNotDone}
              title="Reopen it: it goes back to your To do column"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Undo2 className="w-3 h-3" />
              Not done
            </button>
          ) : working ? (
            <span className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold working-pulse">
              Working
            </span>
          ) : (
            <button
              onClick={onStart}
              disabled={role === 'blocked'}
              title={role === 'blocked' ? 'Unblock it first' : 'Start the timer on this card'}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium disabled:opacity-40"
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          )}
        </span>
      </div>
    </>
  );
};
