// Pill-style single-choice selector for daily focus hours.
const OPTIONS = ['1', '2', '3', '4', '5', '6+'] as const;

interface FocusHoursFieldProps {
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
}

export function FocusHoursField({ value, onChange, error }: FocusHoursFieldProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-300">
        Available focus hours per day
      </legend>
      <p className="mb-3 text-xs text-slate-500">
        Time you can realistically dedicate to your routine — be honest, not ambitious.
      </p>
      <div
        role="radiogroup"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'focus-hours-error' : undefined}
        className="flex flex-wrap gap-2"
      >
        {OPTIONS.map((option) => {
          const checked = value === option;
          return (
            <label
              key={option}
              className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-sm transition-all duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet-400 ${
                checked
                  ? 'border-violet-400/60 bg-violet-500/15 text-white shadow-[0_0_20px_-8px_rgba(124,92,255,0.6)]'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/25 hover:text-white'
              }`}
            >
              <input
                type="radio"
                name="focus-hours"
                value={option}
                checked={checked}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              {option} {option === '1' ? 'hour' : 'hours'}
            </label>
          );
        })}
      </div>
      {error && (
        <p id="focus-hours-error" className="mt-1.5 text-xs font-medium text-rose-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}
