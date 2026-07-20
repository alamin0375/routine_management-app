import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Clock, type LucideIcon } from 'lucide-react';
import { formatTime12, parse24, to24, type Meridiem } from './time';

// Custom dark-themed 12-hour (AM/PM) time picker replacing the OS-native
// <input type="time">. The field API is unchanged (value is canonical 24-hour
// "HH:mm" | ""), but the UI works in 12-hour parts — hour, minute, meridiem.
//
// The dropdown renders in a portal with fixed positioning so it always paints
// above every other card; the sibling glass cards each create their own
// stacking context, so an in-flow absolute popup would otherwise be covered.

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // "1".."12"
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const MERIDIEMS: readonly Meridiem[] = ['AM', 'PM'];

// Sensible defaults when the user picks one part before the others are set.
const DEFAULT_HOUR = '8';
const DEFAULT_MINUTE = '00';
const DEFAULT_MERIDIEM: Meridiem = 'AM';

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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  const parts = parse24(value);
  const selectedHour = parts ? String(parts.hour12) : null;
  const selectedMinute = parts?.minute ?? null;
  const selectedMeridiem = parts?.meridiem ?? null;

  // Compose a change from whichever part the user touched, filling the rest
  // with the current selection or a sensible default.
  const pickHour = (hour: string) =>
    onChange(to24(Number(hour), selectedMinute ?? DEFAULT_MINUTE, selectedMeridiem ?? DEFAULT_MERIDIEM));
  const pickMinute = (minute: string) =>
    onChange(to24(Number(selectedHour ?? DEFAULT_HOUR), minute, selectedMeridiem ?? DEFAULT_MERIDIEM));
  const pickMeridiem = (meridiem: Meridiem) =>
    onChange(to24(Number(selectedHour ?? DEFAULT_HOUR), selectedMinute ?? DEFAULT_MINUTE, meridiem));

  // Position the portal popup under the trigger, and keep it there while the
  // page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const el = buttonRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 8, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  // Close on outside click (trigger and portal popup both count as "inside")
  // and on Escape. The popup is identified by attribute rather than ref —
  // AnimatePresence warns when its direct child carries a ref.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target && rootRef.current?.contains(target)) return;
      if (target?.closest('[data-timepicker-popup]')) return;
      setOpen(false);
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
        ref={buttonRef}
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
          {value ? formatTime12(value) : 'Select time'}
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

      {createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              data-timepicker-popup
              role="dialog"
              aria-label={`Choose ${label.toLowerCase()} time`}
              style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
              initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="z-[100] min-w-[15rem] overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d15]/95 shadow-2xl shadow-violet-950/40 backdrop-blur-xl"
            >
              <div className="grid grid-cols-2 divide-x divide-white/[0.06]">
                <TimeColumn
                  label="Hour"
                  options={HOURS}
                  selected={selectedHour}
                  onSelect={pickHour}
                />
                <TimeColumn
                  label="Min"
                  options={MINUTES}
                  selected={selectedMinute}
                  onSelect={pickMinute}
                />
              </div>

              {/* AM/PM segmented control + confirm */}
              <div className="flex items-center gap-2 border-t border-white/[0.06] p-2.5">
                <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
                  {MERIDIEMS.map((m) => {
                    const active = selectedMeridiem === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={active}
                        onClick={() => pickMeridiem(m)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
                          active
                            ? 'bg-gradient-to-b from-violet-500 to-indigo-600 text-white shadow-[0_0_16px_-6px_rgba(124,92,255,0.8)]'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                >
                  <Check className="size-4" strokeWidth={2} aria-hidden="true" /> Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
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

  // Keep the selected value in view when the popup opens (mount-only on
  // purpose). Scroll only the column — scrollIntoView would also scroll the
  // page under the fixed-position portal.
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('[data-selected="true"]');
    if (!list || !el) return;
    list.scrollTop = el.offsetTop - list.clientHeight / 2 + el.clientHeight / 2;
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
