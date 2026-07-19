import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { OnboardingLayout } from './OnboardingLayout';
import { findGoal } from './goals';

// Step 2 of onboarding. Receives the chosen goal from Step 1 via router
// state; visiting directly without one redirects back to Step 1. The actual
// details questions (schedule, free time) land here next — they feed the AI
// routine suggestion in Phase 4.
export function DetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();

  const goalValue = (location.state as { goal?: string } | null)?.goal;
  const goal = findGoal(goalValue);

  useEffect(() => {
    if (!goal) navigate('/onboarding', { replace: true });
  }, [goal, navigate]);

  if (!goal) return null;

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
  });

  const Icon = goal.icon;

  return (
    <OnboardingLayout step={2} backTo="/onboarding" backLabel="Back to goals">
      {/* Selected-goal chip carried over from Step 1 */}
      <motion.span
        {...rise(0)}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-200"
      >
        <Icon className="size-4" strokeWidth={1.8} /> {goal.label}
      </motion.span>

      <motion.h1
        {...rise(0.08)}
        className="text-balance bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl"
      >
        Tell us about your days
      </motion.h1>
      <motion.p {...rise(0.16)} className="mt-3 text-lg leading-relaxed text-slate-400">
        Next we&apos;ll ask a couple of quick questions about your schedule, so your{' '}
        {goal.label.toLowerCase()} routine fits the time you actually have.
      </motion.p>

      {/* Placeholder panel — the schedule questions are built in the next iteration */}
      <motion.div
        {...rise(0.24)}
        className="mt-9 rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center backdrop-blur-sm"
      >
        <p className="text-sm leading-relaxed text-slate-400">
          This step is under construction — schedule questions arrive in the next iteration of the
          onboarding flow.
        </p>
      </motion.div>
    </OnboardingLayout>
  );
}
