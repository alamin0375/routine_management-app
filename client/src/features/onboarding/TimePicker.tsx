import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Clock, type LucideIcon } from 'lucide-react';

// Custom dark-themed time picker replacing the OS-native <input type="time">
// dropdown. Same field API as before (value: "HH:mm" | ""), styled to match
// the app's glass/violet design language.

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

interface TimePickerProps {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string; // "HH:mm" or "" when unset
  onChange: (value: string) => void;
  error?: string;
}

export function TimePicker({ id, label, icon: Icon, value, onChange, error }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const [selectedHour, selectedMinute] = value ? value.split(':') : [null, null];

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const pick = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`);
  };

  return (
    <div ref={rootRef} className="relative">
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-300"
      >
        <Icon className="size-4 text-slate-500" strokeWidth={1.8} aria-hidden="true" />
        {label}
      </label>

      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`flex w-full items-center justify-between rounded-xl border bg-white/[0.04] px-3.5 py-2.5 text-[15px] backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
          error ? 'border-rose-400/60' : 'border-white/10 hover:border-white/25'
        } ${open ? 'border-violet-400/60' : ''}`}
      >
        <span
          className={`inline-flex items-center gap-2 tabular-nums ${value ? 'text-white' : 'text-slate-500'}`}
        >
          <Clock className="size-4 text-slate-500" strokeWidth={1.8} aria-hidden="true" />
          {value || 'Select time'}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-400">
          {error}
        </p>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={`Choose ${label.toLowerCase()} time`}
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d15]/95 shadow-2xl shadow-violet-950/40 backdrop-blur-xl"
          >
            <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
              {/* Hours */}
              <TimeColumn
                label="Hour"
                options={HOURS}
                selected={selectedHour}
                onSelect={(hour) => pick(hour, selectedMinute ?? '00')}
              />
              {/* Minutes */}
              <TimeColumn
                label="Min"
                options={MINUTES}
                selected={selectedMinute}
                onSelect={(minute) => {
                  pick(selectedHour ?? '08', minute);
                  setOpen(false);
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TimeColumnProps {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}

function TimeColumn({ label, options, selected, onSelect }: TimeColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the selected value in view when the popup opens (mount-only on purpose).
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    el?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <div>
      <p className="border-b border-white/[0.06] px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <div
        ref={listRef}
        className="max-h-52 overflow-y-auto overscroll-contain p-1.5 [scrollbar-color:rgba(255,255,255,0.15)_transparent] [scrollbar-width:thin]"
      >
        {options.map((option) => {
          const isSelected = option === selected;
          return (
            <button
              key={option}
              type="button"
              data-selected={isSelected || undefined}
              onClick={() => onSelect(option)}
              className={`w-full rounded-lg px-3 py-1.5 text-center text-sm tabular-nums transition-colors ${
                isSelected
                  ? 'bg-gradient-to-b from-violet-500 to-indigo-600 font-semibold text-white shadow-[0_0_16px_-6px_rgba(124,92,255,0.8)]'
                  : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
