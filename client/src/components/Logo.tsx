import { Sparkles } from 'lucide-react';

// Logo placeholder — swap the mark/wordmark here once branding exists.
interface LogoProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const markSize = size === 'sm' ? 'size-7' : 'size-9';
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4.5';
  const wordSize = size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        aria-hidden="true"
        className={`${markSize} inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 text-white shadow-[0_0_20px_-4px_rgba(124,92,255,0.7)]`}
      >
        <Sparkles className={iconSize} strokeWidth={2.2} />
      </span>
      <span className={`${wordSize} font-semibold tracking-tight text-white`}>
        Routine
        <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          App
        </span>
      </span>
    </span>
  );
}
