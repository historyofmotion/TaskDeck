import React, { useEffect, useState } from 'react';
import { Coffee, Play, Square } from 'lucide-react';
import { CardItem } from '../types';
import { WorkState, formatClock, formatTracked } from '../utils/workTracking';

interface WorkIndicatorProps {
  work: WorkState | null;
  card: CardItem | undefined; // the card in work.cardId, if it still exists
  onOffTask: () => void;
  onResume: () => void;
  onStop: () => void;
  onOpenCard?: (cardId: string) => void;
  tone?: 'light' | 'felt'; // board colours, or the Deal table's green
}

// Re-render every second while a timer is running
function useNow(running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);
  return now;
}

// Shows what you're doing right now: working on a card (green), off task (amber), or nothing.
export const WorkIndicator: React.FC<WorkIndicatorProps> = ({
  work,
  card,
  onOffTask,
  onResume,
  onStop,
  onOpenCard,
  tone = 'light',
}) => {
  const now = useNow(!!work);
  const felt = tone === 'felt';
  const btn = felt
    ? 'px-2 py-0.5 rounded-md text-xs font-medium hover:bg-white/10 flex items-center gap-1'
    : 'px-2 py-0.5 rounded-md text-xs font-medium hover:bg-slate-200/80 dark:hover:bg-slate-700 flex items-center gap-1';

  if (!work) {
    return (
      <div className={`flex items-center gap-2 text-xs ${felt ? 'text-[#f3efe4]/60' : 'text-slate-500 dark:text-slate-400'}`}>
        <span className={`w-2 h-2 rounded-full ${felt ? 'bg-[#f3efe4]/30' : 'bg-slate-300 dark:bg-slate-600'}`} />
        <span>Not tracking{felt ? ' · press ▶ Start on a card' : ''}</span>
        <button onClick={onOffTask} className={btn} title="Start an off-task timer (time off task isn't recorded on any card)">
          <Coffee className="w-3.5 h-3.5" />
          Off task
        </button>
      </div>
    );
  }

  const elapsed = now - work.since;

  if (work.mode === 'working') {
    const total = (card?.trackedSeconds || 0) + Math.floor(elapsed / 1000);
    return (
      <div
        role="status"
        className={`flex items-center gap-2 text-xs rounded-md px-2 py-0.5 ${
          felt ? 'bg-[#7ed491]/15 text-[#c9f0d1]' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/50'
        }`}
      >
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
          <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-semibold">Working on</span>
        <button
          onClick={() => card && onOpenCard?.(card.id)}
          disabled={!onOpenCard}
          className="max-w-[16rem] truncate underline-offset-2 enabled:hover:underline"
          title={card?.title}
        >
          {card?.title || 'a card'}
        </button>
        <span className="tabular-nums font-semibold">{formatClock(elapsed)}</span>
        {total > 60 && <span className="opacity-70 hidden sm:inline">· {formatTracked(total)} total</span>}
        <button onClick={onOffTask} className={btn} title="Pause: you're doing something that isn't on the cards">
          <Coffee className="w-3.5 h-3.5" />
          Off task
        </button>
        <button onClick={onStop} className={btn} title="Stop the timer and record the time on the card">
          <Square className="w-3 h-3" />
          Stop
        </button>
      </div>
    );
  }

  // Off task
  return (
    <div
      role="status"
      className={`flex items-center gap-2 text-xs rounded-md px-2 py-0.5 ${
        felt ? 'bg-[#e9c46a]/15 text-[#f3dc9f]' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-200/70 dark:border-amber-800/50'
      }`}
    >
      <Coffee className="w-3.5 h-3.5" />
      <span className="font-semibold">Off task</span>
      <span className="tabular-nums font-semibold">{formatClock(elapsed)}</span>
      {card && (
        <button onClick={onResume} className={btn} title={`Go back to "${card.title}" and restart its timer`}>
          <Play className="w-3 h-3" />
          <span className="max-w-[12rem] truncate">Back to {card.title}</span>
        </button>
      )}
      <button onClick={onStop} className={btn} title="End the off-task timer">
        <Square className="w-3 h-3" />
        {card ? 'Stop' : 'End'}
      </button>
    </div>
  );
};
