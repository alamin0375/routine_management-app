import type { LucideIcon } from 'lucide-react';

// Selectable glass card for single-choice steps (goal now, more steps later).
// Rendered as a real radio input for keyboard and screen-reader support.
interface OptionCardProps {
  icon: LucideIcon;
  label: string;
  description: string;
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
}

export function OptionCard({
  icon: Icon,
  label,
  description,
  name,
  value,
  checked,
  onSelect,
}: OptionCardProps) {
  return (
    <label
      className={`group relative flex cursor-pointer items-start gap-4 rounded-2xl border p-5 backdrop-blur-sm transition-all duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-400 ${
        checked
          ? 'border-violet-400/60 bg-violet-500/10 shadow-[0_0_28px_-8px_rgba(124,92,255,0.55)]'
          : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.06]'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          checked
            ? 'border-violet-400/40 bg-gradient-to-b from-violet-500/30 to-indigo-500/10 text-violet-200'
            : 'border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] text-slate-400 group-hover:text-violet-300'
        }`}
      >
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className={`block text-[15px] font-semibold ${checked ? 'text-white' : 'text-slate-200'}`}>
          {label}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-slate-400">{description}</span>
      </span>
      {/* Selection dot */}
      <span
        aria-hidden="true"
        className={`ml-auto mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          checked ? 'border-violet-400 bg-violet-500' : 'border-white/20'
        }`}
      >
        {checked && <span className="size-1.5 rounded-full bg-white" />}
      </span>
    </label>
  );
}
