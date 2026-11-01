import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, MotionValue, motion, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { ArrowLeft, ArrowRight, Ban, Check, Clock, Pencil, Info, LayoutGrid, Play, Square, Star, Undo2, X } from 'lucide-react';
import { Area, CardItem, Column } from '../types';
import { formatDueDateLabel, formatHours, getColumnRole, getDoneColumnId } from '../utils/helpers';
import { formatTracked } from '../utils/workTracking';

// "Deal" mode: the top cards of the Active and Pending columns are dealt one at a time.
// Right (or Done) moves the card to the Done column. Left (or Not now) sets it aside for this deal only.

const DECK_SIZE = 16;
const SWIPE_DISTANCE = 120; // px dragged before a release counts as a decision
const SWIPE_SPEED = 700; // px/s flick that counts even when the drag was short
const ESTIMATE_PRESETS = [0.25, 0.5, 1, 2, 4, 8];
const FOUR_UP = 4;
const LAYOUT_KEY = 'taskdeck_deal_layout'; // remembers single / four-up for this browser only
type Layout = 'single' | 'four';

const readLayout = (): Layout => {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'four' ? 'four' : 'single';
  } catch {
    return 'single';
  }
};
const saveLayout = (layout: Layout) => {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Storage blocked (private window etc.): the choice just isn't remembered
  }
};

type Result = 'done' | 'later';
interface Play {
  id: string;
  result: Result;
  before?: CardItem; // the card as it was before Done, for Undo
}

interface DealViewProps {
  cards: CardItem[]; // board cards after the current search/project filter
  columns: Column[];
  areas: Area[];
  filterLabel: string | null; // e.g. "Work" when the project filter is on
  onDone: (cardId: string) => void;
  onUndoDone: (before: CardItem) => void;
  onSetEstimate: (cardId: string, hours: number) => void;
  onClose: () => void;
  workIndicator?: React.ReactNode; // what you're working on right now
  workingCardId?: string | null;
  onStartWork?: (cardId: string) => void;
  onMakeActive?: (cardId: string) => void; // move a blocked card to the Active column
  onEditCard?: (card: CardItem) => void; // open the full card editor
  paused?: boolean; // another dialog (e.g. the card editor) is open on top: ignore Deal's keys
}

// Active cards first, then Pending, each in rank order
function buildDeck(cards: CardItem[], columns: Column[], skip: Set<string>): string[] {
  const roleOf = new Map(columns.map((c) => [c.id, getColumnRole(c)]));
  const pick = (role: 'active' | 'pending') =>
    cards
      .filter((c) => roleOf.get(c.columnId) === role && !skip.has(c.id))
      .sort((a, b) => a.priority - b.priority);
  return [...pick('active'), ...pick('pending')].slice(0, DECK_SIZE).map((c) => c.id);
}

const sumHours = (cards: (CardItem | undefined)[]) =>
  cards.reduce((t, c) => t + (c?.estimateHours || 0), 0);

export const DealView: React.FC<DealViewProps> = ({
  cards,
  columns,
  areas,
  filterLabel,
  onDone,
  onUndoDone,
  onSetEstimate,
  onClose,
  workIndicator,
  workingCardId,
  onStartWork,
  onMakeActive,
  onEditCard,
  paused,
}) => {
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const canFinish = getDoneColumnId(columns) !== null;
  const dragX = useMotionValue(0); // how far the card in play is dragged, for the side labels

  const [deck, setDeck] = useState<string[]>(() => buildDeck(cards, columns, new Set()));
  const [dealSize, setDealSize] = useState(deck.length);
  const [plays, setPlays] = useState<Play[]>([]);
  // Which way the current card leaves (or, after Undo, comes back from): 1 = right, -1 = left
  const [motionDir, setMotionDir] = useState<{ dir: number; undo: boolean; scrub?: boolean }>({ dir: 0, undo: false });

  const [layout, setLayoutState] = useState<Layout>(readLayout);
  const setLayout = (l: Layout) => {
    setLayoutState(l);
    saveLayout(l);
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pos, setPos] = useState(0); // index in the deck of the first face-up card (moved by the scrub bar)
  const [openBlockedId, setOpenBlockedId] = useState<string | null>(null);

  // Plays from earlier deals in this session, so "Deal again" doesn't repeat set-aside cards
  const seenRef = useRef<Set<string>>(new Set());

  // Live card objects, so estimates set here show straight away. Cards deleted elsewhere drop out.
  // Cards edited into Blocked or Done (or deleted) drop out of the deal
  const liveDeck = deck
    .map((id) => cardById.get(id))
    .filter((c): c is CardItem => {
      const col = c && columnById.get(c.columnId);
      const role = col && getColumnRole(col);
      return role === 'active' || role === 'pending';
    });
  const isFour = layout === 'four';
  const faceCount = isFour ? FOUR_UP : 1;
  const start = Math.max(0, Math.min(pos, liveDeck.length - faceCount));
  const faceUp = liveDeck.slice(start, start + faceCount);
  const current = faceUp[0];
  // The rest of the deck, continuing after the face-up cards and wrapping round
  const upNext = [...liveDeck.slice(start + faceCount), ...liveDeck.slice(0, start)];
  const blockedCards = cards
    .filter((c) => columnById.get(c.columnId) && getColumnRole(columnById.get(c.columnId)!) === 'blocked')
    .sort((a, b) => a.priority - b.priority);
  const openBlocked = blockedCards.find((c) => c.id === openBlockedId);
  const canMakeActive = !!onMakeActive && columns.some((c) => getColumnRole(c) === 'active');

  // Unblock: move it to the Active column and put it at the front of this deal
  const makeActive = (id: string) => {
    onMakeActive?.(id);
    setOpenBlockedId(null);
    setMotionDir({ dir: 0, undo: false });
    if (!deck.includes(id)) setDealSize((n) => n + 1);
    setDeck((d) => [id, ...d.filter((x) => x !== id)]);
    setPos(0);
    setSelectedId(id);
  };
  // In four-up, the arrow keys act on the selected card (the first one until you pick another)
  const target = faceUp.find((c) => c.id === selectedId) || faceUp[0];
  const doneCards = plays.filter((p) => p.result === 'done').map((p) => p.before);
  const laterCards = plays.filter((p) => p.result === 'later').map((p) => cardById.get(p.id));
  const hoursCleared = sumHours(doneCards);
  const unestimatedDone = doneCards.filter((c) => !c?.estimateHours).length;
  const hoursLeft = sumHours(liveDeck);

  // Play a card: the one passed in, or the target (top card, or the selected one in four-up)
  const play = useCallback(
    (result: Result, card: CardItem | undefined = target) => {
      if (!card) return;
      if (result === 'done' && !canFinish) return;
      setMotionDir({ dir: result === 'done' ? 1 : -1, undo: false });
      setPlays((p) => [...p, { id: card.id, result, before: result === 'done' ? card : undefined }]);
      setDeck((d) => d.filter((id) => id !== card.id));
      if (result === 'done') onDone(card.id);
    },
    [target, canFinish, onDone]
  );

  const undo = useCallback(() => {
    const last = plays[plays.length - 1];
    if (!last) return;
    setMotionDir({ dir: last.result === 'done' ? 1 : -1, undo: true });
    setPlays((p) => p.slice(0, -1));
    setDeck((d) => [last.id, ...d]);
    setPos(0); // show the card that came back
    if (last.result === 'done' && last.before) onUndoDone(last.before);
  }, [plays, onUndoDone]);

  // Scrub bar: look through the deck without changing its order
  const scrubTo = (index: number) => {
    if (index === start) return;
    setMotionDir({ dir: index > start ? 1 : -1, undo: false, scrub: true });
    setPos(index);
  };

  // 4 up: double-click a card to see it alone
  const openSingle = (id: string) => {
    const i = liveDeck.findIndex((c) => c.id === id);
    setMotionDir({ dir: 0, undo: false });
    setLayout('single');
    if (i >= 0) setPos(i);
    setSelectedId(id);
  };

  const dealAgain = () => {
    plays.forEach((p) => seenRef.current.add(p.id));
    const next = buildDeck(cards, columns, seenRef.current);
    setMotionDir({ dir: 0, undo: false });
    setPlays([]);
    setPos(0);
    setDeck(next);
    setDealSize(next.length);
  };

  // Keyboard: → done, ← not now, Z / Backspace / Cmd+Z undo, Esc back to the board
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      // A blocked card's details are open: Esc closes them (it stays blocked), other keys do nothing
      if (openBlockedId) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setOpenBlockedId(null);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        play('done');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        play('later');
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        undo();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setLayout(isFour ? 'single' : 'four');
      } else if (isFour && /^[1-4]$/.test(e.key) && faceUp[Number(e.key) - 1]) {
        e.preventDefault();
        setSelectedId(faceUp[Number(e.key) - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play, undo, onClose, isFour, faceUp, openBlockedId, paused]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const moreCardsLeft = buildDeck(cards, columns, new Set([...seenRef.current, ...plays.map((p) => p.id)])).length > 0;

  const endPanel = (
                  <motion.div
                    key="end"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`${isFour ? 'relative min-h-[300px] w-[min(92vw,680px)]' : 'absolute inset-0'} rounded-2xl border border-dashed border-white/25 flex flex-col items-center justify-center text-center p-8 gap-4`}
                  >
                    {dealSize === 0 ? (
                      <>
                        <p className="font-serif text-2xl">Nothing to deal</p>
                        <p className="text-sm text-[#f3efe4]/70">
                          There are no cards in your Active or Pending columns{filterLabel ? ' for this project' : ''}.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-serif text-3xl">Deck played</p>
                        <p className="text-sm text-[#f3efe4]/80">
                          {doneCards.length} done{hoursCleared ? ` (${formatHours(hoursCleared)})` : ''} · {laterCards.length} set aside
                        </p>
                      </>
                    )}
                    <div className="flex gap-2 mt-2">
                      {moreCardsLeft && (
                        <button onClick={dealAgain} className="px-4 py-2 rounded-full bg-[#f3efe4] text-[#1f3a32] text-sm font-semibold hover:bg-white">
                          Deal again
                        </button>
                      )}
                      <button onClick={onClose} className="px-4 py-2 rounded-full border border-white/30 text-sm font-medium hover:bg-white/10">
                        Back to board
                      </button>
                    </div>
                  </motion.div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Deal: play through your top tasks"
        className="fixed inset-0 z-40 flex flex-col overflow-y-auto overflow-x-hidden bg-[#1f3a32] text-[#f3efe4] font-sans"
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-4 sm:px-8 py-4 border-b border-white/10 shrink-0">
          <span className="font-serif text-xl font-bold tracking-tight">TaskDeck</span>
          <span className="text-sm text-[#f3efe4]/70 truncate">
            {weekday}'s deal{filterLabel ? ` · ${filterLabel}` : ''}
          </span>
          <HowItWorks filterLabel={filterLabel} />
          <div className="ml-auto flex items-center p-0.5 rounded-lg bg-black/20 border border-white/10" role="group" aria-label="Cards on the table">
            {([
              ['single', Square, '1 card', 'Show one card at a time (F)'],
              ['four', LayoutGrid, '4 up', 'Show four cards and pick one (F)'],
            ] as const).map(([value, Icon, text, title]) => (
              <button
                key={value}
                onClick={() => setLayout(value)}
                aria-pressed={layout === value}
                title={title}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  layout === value ? 'bg-[#f3efe4] text-[#1f3a32]' : 'text-[#f3efe4]/70 hover:text-[#f3efe4]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{text}</span>
              </button>
            ))}
          </div>
          <span className="text-sm text-[#f3efe4]/70 whitespace-nowrap">
            {plays.length} of {dealSize} played
          </span>
          <button
            onClick={undo}
            disabled={plays.length === 0}
            title="Undo last card (Z)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-transparent"
          >
            <Undo2 className="w-4 h-4" />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button
            onClick={onClose}
            title="Back to the board (Esc)"
            aria-label="Back to the board"
            className="p-1.5 rounded-md hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* What you're working on right now */}
        {workIndicator && (
          <div className="flex justify-center px-4 pt-3 shrink-0" aria-live="polite">
            {workIndicator}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 items-center px-4 sm:px-8 py-8">
          {/* Left: Not now pile + what's still in the deck */}
          <div className="order-2 lg:order-1 flex flex-col gap-8 lg:justify-self-start w-full max-w-sm">
            <Pile label="Not now" count={laterCards.length} topCard={laterCards[laterCards.length - 1]} areaById={areaById} tone="later" />
            {upNext.length > 0 && (
              <div>
                <p className="text-sm text-[#f3efe4]/70 mb-2">Still in the deck</p>
                <ul>
                  {upNext.slice(0, 3).map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5 py-2.5 border-b border-white/10 text-sm">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: areaById.get(c.areaId || '')?.color || '#8a9a94' }} />
                      <span className="truncate">{c.title}</span>
                      <span className="ml-auto text-xs text-[#f3efe4]/60 shrink-0">{formatHours(c.estimateHours) || '—'}</span>
                    </li>
                  ))}
                </ul>
                {upNext.length > 3 && (
                  <p className="text-xs text-[#f3efe4]/60 mt-2">+ {upNext.length - 3} more face down</p>
                )}
              </div>
            )}
            {blockedCards.length > 0 && (
              <div>
                <p className="text-sm text-[#f3efe4]/70 mb-1.5 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-[#e07a5f]" />
                  Blocked <span className="text-[#f3efe4]/50">{blockedCards.length}</span>
                </p>
                <ul className="flex flex-col gap-1">
                  {blockedCards.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setOpenBlockedId(c.id)}
                        title="Show details"
                        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-left bg-white/5 hover:bg-white/10 border border-white/10"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: areaById.get(c.areaId || '')?.color || '#8a9a94' }} />
                        <span className="truncate">{c.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {blockedCards.length > 6 && (
                  <p className="text-xs text-[#f3efe4]/60 mt-1.5">+ {blockedCards.length - 6} more on the board</p>
                )}
              </div>
            )}
          </div>

          {/* Center: the card(s) in play */}
          <div className="order-1 lg:order-2 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 xl:gap-8">
            {current && (
              <SideLabel side="left" label="Not now" sub="skip for this deal" dragX={dragX} className={isFour ? 'hidden xl:flex' : undefined} />
            )}
            {isFour ? (
              current ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-[min(92vw,600px)]">
                  <AnimatePresence initial={false} custom={motionDir} mode="popLayout">
                    {faceUp.map((c, i) => (
                      <DealCard
                        key={c.id}
                        compact
                        slot={i + 1}
                        selected={c.id === target?.id}
                        onSelect={() => setSelectedId(c.id)}
                        card={c}
                        area={areaById.get(c.areaId || '')}
                        columnName={columnById.get(c.columnId)?.name || ''}
                        canFinish={canFinish}
                        motionDir={motionDir}
                        dragX={dragX}
                        onPlay={(r) => play(r, c)}
                        onSetEstimate={(h) => onSetEstimate(c.id, h)}
                        working={c.id === workingCardId}
                        onStartWork={onStartWork && (() => onStartWork(c.id))}
                        onEdit={onEditCard && (() => onEditCard(c))}
                        onOpenSingle={() => openSingle(c.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                endPanel
              )
            ) : (
            <div className="relative w-[min(88vw,420px)] h-[min(70vh,520px)]">
              <AnimatePresence initial={false} custom={motionDir} mode="popLayout">
                {current ? (
                  <DealCard
                    key={current.id}
                    card={current}
                    area={areaById.get(current.areaId || '')}
                    columnName={columnById.get(current.columnId)?.name || ''}
                    canFinish={canFinish}
                    motionDir={motionDir}
                    dragX={dragX}
                    onPlay={(r) => play(r, current)}
                    onSetEstimate={(h) => onSetEstimate(current.id, h)}
                    working={current.id === workingCardId}
                    onStartWork={onStartWork && (() => onStartWork(current.id))}
                    onEdit={onEditCard && (() => onEditCard(current))}
                  />
                ) : (
                  endPanel
                )}
              </AnimatePresence>
            </div>
            )}
            {current && (
              <SideLabel
                side="right"
                label="Done"
                sub={canFinish ? 'moves to Done' : 'no Done column'}
                dragX={dragX}
                disabled={!canFinish}
                className={isFour ? 'hidden xl:flex' : undefined}
              />
            )}
            </div>

            {current && (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={() => play('later')}
                    title="Set aside for this deal (← key)"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#e9c46a]/60 text-[#e9c46a] font-medium hover:bg-[#e9c46a]/10"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Not now
                  </button>
                  <button
                    onClick={() => play('done')}
                    disabled={!canFinish}
                    title={canFinish ? 'Move to Done (→ key)' : 'Add a column with type Done in Options to finish cards here'}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#7ed491] text-[#14301f] font-semibold hover:bg-[#93dea3] disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                    Done
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-[#f3efe4]/60 text-center max-w-xl">
                  Drag or flick {isFour ? 'a' : 'the'} card: <span className="text-[#e9c46a]">← left = Not now</span> ·{' '}
                  <span className="text-[#7ed491]">right = Done →</span> · arrow keys work too
                  {isFour && (
                    <>
                      <br />
                      These buttons and the arrow keys act on the outlined card. Click a card or press 1–4 to pick it;
                      double-click to see it alone.
                    </>
                  )}
                </p>
              </>
            )}
            {liveDeck.length > faceCount && (
              <ScrubBar
                cards={liveDeck}
                start={start}
                visible={faceCount}
                areaById={areaById}
                onScrub={scrubTo}
                className={isFour ? 'w-[min(92vw,600px)]' : 'w-[min(88vw,420px)]'}
              />
            )}
          </div>

          {/* Right: Done pile + hours */}
          <div className="order-3 flex flex-col gap-6 lg:justify-self-end w-full max-w-sm lg:items-end lg:text-right">
            <Pile label="Done" count={doneCards.length} topCard={doneCards[doneCards.length - 1]} areaById={areaById} tone="done" />
            <div>
              <p className="text-5xl font-light tracking-tight leading-none tabular-nums">{formatHours(hoursCleared) || '0h'}</p>
              <p className="text-sm text-[#f3efe4]/70 mt-1">cleared so far</p>
              {unestimatedDone > 0 && (
                <p className="text-xs text-[#f3efe4]/50 mt-1">
                  + {unestimatedDone} card{unestimatedDone === 1 ? '' : 's'} with no estimate
                </p>
              )}
              {hoursLeft > 0 && <p className="text-xs text-[#f3efe4]/50 mt-3">{formatHours(hoursLeft)} still in the deck</p>}
            </div>
          </div>
        </div>

        {/* A blocked card's details */}
        <AnimatePresence>
          {openBlocked && (
            <BlockedDetails
              key={openBlocked.id}
              card={openBlocked}
              area={areaById.get(openBlocked.areaId || '')}
              canMakeActive={canMakeActive}
              onMakeActive={() => makeActive(openBlocked.id)}
              onClose={() => setOpenBlockedId(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};

// ---- Details of a blocked card: make it active again, or close (it stays blocked) ----

const BlockedDetails: React.FC<{
  card: CardItem;
  area?: Area;
  canMakeActive: boolean;
  onMakeActive: () => void;
  onClose: () => void;
}> = ({ card, area, canMakeActive, onMakeActive, onClose }) => {
  const due = formatDueDateLabel(card.dueDate);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocked-card-title"
        initial={{ y: 20, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 20, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[min(92vw,440px)] max-h-[85vh] overflow-y-auto rounded-2xl bg-[#faf7ef] text-[#1d1d1b] shadow-2xl p-7 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 text-sm text-[#55524a]">
          {area && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />}
          <span>{area?.name || 'No project'}</span>
          <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e07a5f]/15 text-[#b24a30] text-xs font-semibold">
            <Ban className="w-3 h-3" />
            Blocked · #{card.priority}
          </span>
        </div>
        <h2 id="blocked-card-title" className="font-serif text-2xl font-bold leading-tight break-words">
          {card.title}
        </h2>
        {card.description.trim() ? (
          <p className="text-[15px] text-[#4a4840] whitespace-pre-line break-words">{card.description.trim()}</p>
        ) : (
          <p className="text-sm text-[#8a867b] italic">No description.</p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-[#4a4840] border-t border-[#e3ddcf] pt-3">
          {due.label && (<><dt className="text-[#8a867b]">Due</dt><dd className={due.isOverdue ? 'text-red-700 font-medium' : ''}>{due.label}</dd></>)}
          {card.estimateHours ? (<><dt className="text-[#8a867b]">Estimate</dt><dd>{formatHours(card.estimateHours)}</dd></>) : null}
          {card.trackedSeconds ? (<><dt className="text-[#8a867b]">Tracked</dt><dd>{formatTracked(card.trackedSeconds)}</dd></>) : null}
          {card.progress > 0 && (<><dt className="text-[#8a867b]">Progress</dt><dd>{card.progress}%</dd></>)}
          <dt className="text-[#8a867b]">Created</dt>
          <dd>{new Date(card.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</dd>
        </dl>
        <div className="flex gap-2 pt-1">
          <button
            ref={closeRef}
            onClick={onClose}
            className="flex-1 py-2 rounded-full border border-[#d8d1c0] text-sm font-medium hover:bg-[#efe9da]"
          >
            Keep blocked
          </button>
          <button
            onClick={onMakeActive}
            disabled={!canMakeActive}
            title={canMakeActive ? 'Move to your Active column and deal it now' : 'No column has type Active'}
            className="flex-1 py-2 rounded-full bg-[#7ed491] text-[#14301f] text-sm font-semibold hover:bg-[#6cc981] disabled:opacity-40"
          >
            Make active
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---- The draggable card ----

const cardVariants = {
  // Scrubbing: the new card tilts in on top from the side you're scrubbing toward (no see-through fade)
  enter: (m: { dir: number; undo: boolean; scrub?: boolean }) =>
    m.scrub ? { x: m.dir * 70, rotateZ: m.dir * 6, scale: 0.97, opacity: 1, zIndex: 2 } : m.undo ? { x: m.dir * 600, rotate: m.dir * 20, opacity: 0 } : { y: 30, scale: 0.94, opacity: 0 },
  center: { x: 0, y: 0, rotate: 0, rotateZ: 0, scale: 1, opacity: 1, zIndex: 1 },
  // dir 0 = swapped out from the deck strip: drop back quickly instead of flying off
  exit: (m: { dir: number; undo: boolean; scrub?: boolean }) =>
    m.scrub
      ? { x: m.dir * -70, rotateZ: m.dir * -6, scale: 0.94, opacity: 0, zIndex: 0, transition: { duration: 0.2 } }
      : m.dir === 0
      ? { y: 24, scale: 0.94, opacity: 0, transition: { duration: 0.16 } }
      : { x: m.dir * 700, rotate: m.dir * 24, opacity: 0 },
};

interface DealCardProps {
  card: CardItem;
  area?: Area;
  columnName: string;
  canFinish: boolean;
  motionDir: { dir: number; undo: boolean; scrub?: boolean };
  dragX: MotionValue<number>;
  onPlay: (r: Result) => void;
  onSetEstimate: (hours: number) => void;
  compact?: boolean; // four-up: smaller card with its own buttons
  slot?: number; // four-up position, 1–4
  selected?: boolean;
  onSelect?: () => void;
  working?: boolean; // this card's timer is running
  onStartWork?: () => void;
  onEdit?: () => void; // open the full editor
  onOpenSingle?: () => void; // 4 up: double-click to see this card alone
}

const DealCard: React.FC<DealCardProps> = ({
  card,
  area,
  columnName,
  canFinish,
  motionDir,
  dragX,
  onPlay,
  onSetEstimate,
  compact,
  slot,
  selected,
  onSelect,
  working,
  onStartWork,
  onEdit,
  onOpenSingle,
}) => {
  const x = useMotionValue(0);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const tilt = useTransform(x, [-300, 300], [-14, 14]);
  const doneHint = useTransform(x, [20, SWIPE_DISTANCE], [0, 1]);
  const laterHint = useTransform(x, [-SWIPE_DISTANCE, -20], [1, 0]);
  const due = formatDueDateLabel(card.dueDate);

  // Buttons and chips inside the card shouldn't start a drag
  const noDrag = { onPointerDownCapture: (e: React.PointerEvent) => e.stopPropagation() };

  const startControl = working ? (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#23824a]" title="The timer is running on this card">
      <span className="w-2 h-2 rounded-full bg-[#2f9e57] animate-pulse motion-reduce:animate-none" />
      Working
    </span>
  ) : onStartWork ? (
    <button
      {...noDrag}
      onClick={onStartWork}
      title="Start the timer: you're working on this card now"
      className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#d8d1c0] text-xs font-medium text-[#4a4840] hover:bg-[#efe9da]"
    >
      <Play className="w-3 h-3" />
      Start
    </button>
  ) : null;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    dragX.set(0);
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_SPEED) {
      if (canFinish) onPlay('done');
    } else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_SPEED) {
      onPlay('later');
    }
  };

  return (
    <motion.div
      custom={motionDir}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      layout={compact ? 'position' : undefined}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.9}
      onDrag={(_, info) => dragX.set(info.offset.x)}
      onDragEnd={handleDragEnd}
      onTap={onSelect}
      onDoubleClick={onOpenSingle}
      style={{ x, rotate: tilt }}
      whileDrag={{ scale: 1.02, cursor: 'grabbing', zIndex: 20 }}
      aria-label={compact ? `Card ${slot}: ${card.title}${selected ? ' (selected)' : ''}` : undefined}
      className={`${
        compact ? 'relative h-[min(36vh,290px)] p-5' : 'absolute inset-0 p-7 sm:p-9'
      } rounded-2xl bg-[#faf7ef] text-[#1d1d1b] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] flex flex-col cursor-grab select-none touch-none ${
        compact && selected ? 'ring-2 ring-[#f3efe4] ring-offset-4 ring-offset-[#1f3a32]' : ''
      }`}
    >
      {/* Swipe stamps */}
      <motion.span
        style={{ opacity: doneHint }}
        className="pointer-events-none absolute top-6 right-6 rotate-12 px-3 py-1 rounded-md border-2 border-[#2f9e57] text-[#2f9e57] font-bold tracking-widest text-sm"
      >
        DONE
      </motion.span>
      <motion.span
        style={{ opacity: laterHint }}
        className="pointer-events-none absolute top-6 left-6 -rotate-12 px-3 py-1 rounded-md border-2 border-[#c98f12] text-[#c98f12] font-bold tracking-widest text-sm"
      >
        NOT NOW
      </motion.span>

      <div className="flex items-center gap-2 text-sm text-[#55524a]">
        {area && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />}
        <span>{area?.name || 'No project'}</span>
        {card.starred && <Star className="w-4 h-4 fill-amber-400 text-amber-500" aria-label="Starred" />}
        {startControl && (
          <span className="ml-1" onDoubleClick={(e) => e.stopPropagation()}>
            {startControl}
          </span>
        )}
        <span className="ml-auto text-xs uppercase tracking-wide text-[#8a867b] truncate">
          {compact && slot ? <span className="mr-1.5 normal-case text-[#b0aa9b]">{slot}</span> : null}#{card.priority} · {columnName}
        </span>
        {onEdit && (
          <button
            {...noDrag}
            onClick={onEdit}
            onDoubleClick={(e) => e.stopPropagation()}
            title="Edit this card"
            aria-label={`Edit ${card.title}`}
            className="-mr-1 p-1 rounded-md text-[#8a867b] hover:text-[#1d1d1b] hover:bg-[#efe9da] shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className={`flex-1 flex flex-col justify-center min-h-0 ${compact ? 'py-2' : 'py-4'}`}>
        <h2
          className={`font-serif font-bold leading-tight break-words ${
            compact ? 'text-xl line-clamp-3' : 'text-3xl sm:text-4xl'
          }`}
        >
          {card.title}
        </h2>
        {card.description.trim() && (
          <p
            className={`text-[#4a4840] whitespace-pre-line ${
              compact ? 'mt-2 text-[13px] line-clamp-2' : 'mt-4 text-[15px] line-clamp-5'
            }`}
          >
            {card.description.trim()}
          </p>
        )}
        {card.progress > 0 && (
          <div className={`${compact ? 'mt-3' : 'mt-5'} flex items-center gap-2 text-xs text-[#6b675d]`}>
            <div className="flex-1 h-1.5 rounded-full bg-[#e8e3d6] overflow-hidden">
              <div className="h-full bg-[#2f9e57]" style={{ width: `${card.progress}%` }} />
            </div>
            {card.progress}%
          </div>
        )}
      </div>

      <div className={`border-t border-[#e3ddcf] flex items-center gap-3 text-sm text-[#4a4840] ${compact ? 'pt-2.5 min-h-[36px]' : 'pt-4 min-h-[44px]'}`}>
        {card.estimateHours && !editingEstimate ? (
          // Click the time to change it
          <button
            {...noDrag}
            onClick={() => setEditingEstimate(true)}
            onDoubleClick={(e) => e.stopPropagation()}
            title="Change the estimate"
            className="flex items-center gap-1.5 -mx-1.5 px-1.5 py-0.5 rounded-md hover:bg-[#efe9da]"
          >
            <Clock className="w-4 h-4" />
            {card.trackedSeconds ? `${formatTracked(card.trackedSeconds)} of ` : ''}
            {formatHours(card.estimateHours)}
          </button>
        ) : (
          // Quick picks. Stop pointer events so tapping a chip doesn't start a drag.
          <div className="flex flex-wrap items-center gap-1" {...noDrag} onDoubleClick={(e) => e.stopPropagation()}>
            <span className="text-xs text-[#8a867b] mr-1">How long?</span>
            {(compact ? ESTIMATE_PRESETS.slice(1, 5) : ESTIMATE_PRESETS).map((h) => (
              <button
                key={h}
                onClick={() => {
                  onSetEstimate(h);
                  setEditingEstimate(false);
                }}
                aria-pressed={card.estimateHours === h}
                className={`px-2 py-0.5 rounded-md border text-xs ${
                  card.estimateHours === h
                    ? 'border-[#1d1d1b] bg-[#1d1d1b] text-[#faf7ef]'
                    : 'border-[#d8d1c0] hover:bg-[#efe9da]'
                }`}
              >
                {formatHours(h)}
              </button>
            ))}
            {editingEstimate && (
              <button
                onClick={() => setEditingEstimate(false)}
                title="Keep the current estimate"
                aria-label="Cancel"
                className="p-0.5 rounded-md text-[#8a867b] hover:bg-[#efe9da]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {due.label && (
          <span className={`ml-auto font-medium ${due.isOverdue ? 'text-red-700' : due.isToday ? 'text-amber-700' : ''}`}>
            {due.label}
          </span>
        )}
      </div>

      {/* Four-up: each card has its own buttons */}
      {compact && (
        <div className="flex gap-2 pt-3" {...noDrag} onDoubleClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onPlay('later')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full border border-[#c98f12]/50 text-[#a8730a] text-sm font-medium hover:bg-[#c98f12]/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Not now
          </button>
          <button
            onClick={() => onPlay('done')}
            disabled={!canFinish}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full bg-[#7ed491] text-[#14301f] text-sm font-semibold hover:bg-[#6cc981] disabled:opacity-40"
          >
            Done
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

// ---- A pile of played cards ----

const Pile: React.FC<{
  label: string;
  count: number;
  topCard?: CardItem;
  areaById: Map<string, Area>;
  tone: 'done' | 'later';
}> = ({ label, count, topCard, areaById, tone }) => {
  const color = tone === 'done' ? 'text-[#7ed491]' : 'text-[#e9c46a]';
  const layers = Math.min(count, 3);
  const dot = topCard ? areaById.get(topCard.areaId || '')?.color : undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-24 h-32">
        {count === 0 ? (
          <div className="absolute inset-0 rounded-lg border border-dashed border-white/20" />
        ) : (
          Array.from({ length: layers }).map((_, i) => (
            <motion.div
              key={`${count}-${i}`}
              initial={i === layers - 1 ? { scale: 1.15, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 rounded-lg bg-[#faf7ef] shadow-md border border-black/5"
              style={{ rotate: (i - layers + 1) * (tone === 'done' ? 3 : -3) }}
            >
              {i === layers - 1 && dot && <span className="absolute top-2.5 left-2.5 w-2 h-2 rounded-full" style={{ backgroundColor: dot }} />}
            </motion.div>
          ))
        )}
      </div>
      <p className={`text-sm font-medium ${color}`}>
        {label} <span className="text-[#f3efe4]/70 ml-1">{count}</span>
      </p>
    </div>
  );
};

// ---- Direction labels either side of the card ----
// Always visible, and light up as the card is dragged toward them.

const SideLabel: React.FC<{
  side: 'left' | 'right';
  label: string;
  sub: string;
  dragX: MotionValue<number>;
  disabled?: boolean;
  className?: string; // replaces the default visibility (shown from small screens up)
}> = ({ side, label, sub, dragX, disabled, className }) => {
  const isLeft = side === 'left';
  const range = isLeft ? [-SWIPE_DISTANCE, -10] : [10, SWIPE_DISTANCE];
  const opacity = useTransform(dragX, range, isLeft ? [1, 0.55] : [0.55, 1]);
  const scale = useTransform(dragX, range, isLeft ? [1.12, 1] : [1, 1.12]);
  const shift = useTransform(dragX, range, isLeft ? [-8, 0] : [0, 8]);
  const color = isLeft ? 'text-[#e9c46a]' : 'text-[#7ed491]';
  const Arrow = isLeft ? ArrowLeft : ArrowRight;
  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity: disabled ? 0.25 : opacity, scale, x: shift }}
      className={`${className ?? 'hidden sm:flex'} flex-col items-center gap-2 w-24 text-center select-none ${color}`}
    >
      <span className={`w-14 h-14 rounded-full border-2 border-current flex items-center justify-center`}>
        <Arrow className="w-7 h-7" />
      </span>
      <span className="text-base font-semibold">{label}</span>
      <span className="text-[11px] leading-tight text-[#f3efe4]/55">{sub}</span>
    </motion.div>
  );
};

// ---- "How the deal works" tooltip ----
// Opens on hover, keyboard focus or tap; closes when the mouse leaves or focus moves away.

const HowItWorks: React.FC<{ filterLabel: string | null }> = ({ filterLabel }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="How the deal works"
        aria-expanded={open}
        aria-describedby="deal-how-it-works"
        className="p-1 rounded-full text-[#f3efe4]/60 hover:text-[#f3efe4] hover:bg-white/10"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div
          id="deal-how-it-works"
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-2 z-10 w-[min(88vw,340px)] rounded-xl bg-[#faf7ef] text-[#2a2924] shadow-2xl p-4 text-[13px] leading-relaxed space-y-2.5"
        >
          <p className="font-serif text-base font-bold">How the deal works</p>
          <p>
            <strong>Which cards:</strong> up to {DECK_SIZE} cards, first from your In Progress (Active) columns, then
            from To Do (Pending). Blocked and Done cards are left out.
            {filterLabel ? ` Only cards in ${filterLabel} are dealt, because that project filter is on.` : ' Your search and project filter apply.'}
          </p>
          <p>
            <strong>Order:</strong> within each group, cards come in your board's priority rank (#1 is dealt first).
            Starred cards always hold the top ranks, so they come early. Change the order by dragging cards on the board.
          </p>
          <p>
            <strong>Playing:</strong> <span className="text-[#a8730a] font-semibold">← left / Not now</span> skips the card for this deal only, and nothing on
            your board changes. <span className="text-[#23824a] font-semibold">Right → / Done</span> moves it to your Done column. Undo (Z) takes back the last card.
          </p>
          <p>
            <strong>Hours:</strong> each card's estimate is added to "cleared so far" when you finish it. Cards without one ask "How long?".
          </p>
        </div>
      )}
    </span>
  );
};

// ---- Scrub bar: press and drag along it to look through the deck ----
// Outline-only so it stays quiet. One outlined dot per card in its project colour; the outlined window
// marks the face-up card(s). Dragging swaps the card(s) in view; it doesn't change the deck's order.

const ScrubBar: React.FC<{
  cards: CardItem[];
  start: number;
  visible: number; // face-up cards: 1 or 4
  areaById: Map<string, Area>;
  onScrub: (index: number) => void;
  className?: string;
}> = ({ cards, start, visible, areaById, onScrub, className = '' }) => {
  const dragging = useRef(false);
  const n = cards.length;
  const maxStart = Math.max(0, n - visible);

  const indexAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    return Math.max(0, Math.min(maxStart, Math.round(fraction * n - visible / 2)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation(); // move through the deck instead of playing the card
    onScrub(Math.max(0, Math.min(maxStart, start + step)));
  };

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <div
        role="slider"
        aria-label="Look through the deck"
        aria-valuemin={1}
        aria-valuemax={maxStart + 1}
        aria-valuenow={start + 1}
        aria-valuetext={`${cards[start]?.title || ''}, card ${start + 1} of ${n}`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onScrub(indexAt(e));
        }}
        onPointerMove={(e) => dragging.current && onScrub(indexAt(e))}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        title="Drag left or right to look through the deck"
        className="relative w-full h-4 rounded-full border border-[#f3efe4]/20 hover:border-[#f3efe4]/35 cursor-ew-resize touch-none select-none focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#f3efe4]/30"
      >
        {cards.map((c, i) => {
          const up = i >= start && i < start + visible;
          return (
            <span
              key={c.id}
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border"
              style={{
                left: `calc(${((i + 0.5) / n) * 100}% - 3px)`,
                borderColor: areaById.get(c.areaId || '')?.color || '#8a9a94',
                opacity: up ? 1 : 0.55,
              }}
            />
          );
        })}
        {/* the face-up window */}
        <span
          className="absolute inset-y-[2px] rounded-full border border-[#f3efe4]/55 pointer-events-none transition-[left] duration-100"
          style={{ left: `calc(${(start / n) * 100}% + 2px)`, width: `calc(${(visible / n) * 100}% - 4px)` }}
        />
      </div>
      <p className="text-[11px] text-[#f3efe4]/45 tabular-nums">
        {visible > 1 ? `${start + 1}–${Math.min(n, start + visible)}` : start + 1} of {n} · drag to look through the deck
      </p>
    </div>
  );
};
