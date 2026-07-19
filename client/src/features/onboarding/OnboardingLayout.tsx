import type { ReactNode } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Container } from '../../components/Container';
import { Logo } from '../../components/Logo';
import { useOnboardingStore } from './store';

// Shared shell for onboarding steps: dark backdrop, minimal header,
// and a step progress indicator. Back preserves all answers (they live in
// the onboarding store); "Start over" clears the store and returns to Step 1.
const TOTAL_STEPS = 3;

interface OnboardingLayoutProps {
  step: number; // 1-based
  backTo: string;
  backLabel: string;
  showStartOver?: boolean;
  children: ReactNode;
}

export function OnboardingLayout({
  step,
  backTo,
  backLabel,
  showStartOver = false,
  children,
}: OnboardingLayoutProps) {
  const navigate = useNavigate();
  const reset = useOnboardingStore((s) => s.reset);

  const handleStartOver = () => {
    reset();
    navigate('/onboarding');
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#08080d] text-slate-200 antialiased selection:bg-violet-500/30 selection:text-white">
      {/* Background glow, softer than the landing hero */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-25%] h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.2),transparent_70%)] blur-2xl" />
      </div>

      <header className="border-b border-white/[0.06]">
        <Container className="flex h-16 items-center justify-between">
          <Link to="/" aria-label="RoutineApp home">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-5">
            {showStartOver && (
              <button
                type="button"
                onClick={handleStartOver}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-white"
              >
                <RotateCcw className="size-3.5" /> Start over
              </button>
            )}
            <Link
              to={backTo}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="size-4" /> {backLabel}
            </Link>
          </div>
        </Container>
      </header>

      <main className="flex flex-1 items-center py-12 sm:py-16">
        <Container className="max-w-2xl">
          <div className="mb-8 flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span
                key={i}
                className={`h-1 w-8 rounded-full ${
                  i < step ? 'bg-gradient-to-r from-violet-500 to-indigo-500' : 'bg-white/10'
                }`}
              />
            ))}
            <span className="ml-2 text-xs font-medium text-slate-500">
              Step {step} of {TOTAL_STEPS}
            </span>
          </div>
          {children}
        </Container>
      </main>
    </div>
  );
}
