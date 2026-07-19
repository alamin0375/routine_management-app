import type { LucideIcon } from 'lucide-react';

// Multi-select pill built on a real checkbox — the checkbox counterpart to
// the radio-based pills/cards used elsewhere in onboarding.
interface SelectChipProps {
  icon: LucideIcon;
  label: string;
  value: string;
  checked: boolean;
  onToggle: (value: string) => void;
}

export function SelectChip({ icon: Icon, label, value, checked, onToggle }: SelectChipProps) {
  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-400 ${
        checked
          ? 'border-violet-400/60 bg-violet-500/15 text-white shadow-[0_0_20px_-8px_rgba(124,92,255,0.6)]'
          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white'
      }`}
    >
      <input
        type="checkbox"
        value={value}
        checked={checked}
        onChange={() => onToggle(value)}
        className="sr-only"
      />
      <Icon
        aria-hidden="true"
        className={`size-4 ${checked ? 'text-violet-300' : 'text-slate-500'}`}
        strokeWidth={1.8}
      />
      {label}
    </label>
  );
}
