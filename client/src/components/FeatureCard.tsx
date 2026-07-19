import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

// Glassmorphism card with a gradient hover ring.
export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors duration-300 hover:border-violet-400/30 hover:bg-white/[0.06]">
      {/* Soft glow that follows the card on hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-violet-500/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div
        aria-hidden="true"
        className="mb-4 inline-flex size-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] text-violet-300 shadow-inner"
      >
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-400">{description}</p>
    </div>
  );
}
