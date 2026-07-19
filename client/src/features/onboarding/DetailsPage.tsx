import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlarmClock, ArrowRight, Coffee, Moon, Sandwich, UtensilsCrossed } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { OnboardingLayout } from './OnboardingLayout';
import { TimePicker } from './TimePicker';
import { FocusHoursField } from './FocusHoursField';
import { findGoal } from './goals';
import { isScheduleComplete, useOnboardingStore, type TimeKey } from './store';

// Step 2 of onboarding: daily schedule anchors. Answers live in the
// onboarding store (Back never loses them); together with the goal they feed
// the AI routine suggestion in Phase 4.

const TIME_FIELDS: readonly { key: TimeKey; label: string; icon: typeof AlarmClock }[] = [
  { key: 'wakeTime', label: 'Wake up', icon: AlarmClock },
  { key: 'sleepTime', label: 'Sleep', icon: Moon },
  { key: 'breakfastTime', label: 'Breakfast', icon: Coffee },
  { key: 'lunchTime', label: 'Lunch', icon: Sandwich },
  { key: 'dinnerTime', label: 'Dinner', icon: UtensilsCrossed },
];

export function DetailsPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const goalValue = useOnboardingStore((s) => s.goal);
  const times = useOnboardingStore((s) => s.times);
  const focusHours = useOnboardingStore((s) => s.focusHours);
  const setTime = useOnboardingStore((s) => s.setTime);
  const setFocusHours = useOnboardingStore((s) => s.setFocusHours);
  const goal = findGoal(goalValue ?? undefined);

  // Errors render only after a submit attempt — no red fields on first paint.
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!goal) navigate('/onboarding', { replace: true });
  }, [goal, navigate]);

  if (!goal) return null;

  const timeError = (key: TimeKey) =>
    submitted && times[key] === '' ? 'Please pick a time.' : undefined;
  const focusError = submitted && focusHours === null ? 'Please choose an option.' : undefined;
  const isComplete = isScheduleComplete(times, focusHours);

  const handleContinue = () => {
    setSubmitted(true);
    if (!isComplete) return;
    navigate('/onboarding/preferences');
  };

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
  });

  const Icon = goal.icon;

  return (
    <OnboardingLayout step={2} backTo="/onboarding" backLabel="Back to goals" showStartOver>
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
        These anchors help us fit your {goal.label.toLowerCase()} routine around the day you
        actually live.
      </motion.p>

      <motion.form
        {...rise(0.24)}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleContinue();
        }}
        className="mt-9 space-y-8"
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-7">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-violet-400">
            Daily schedule
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {TIME_FIELDS.map(({ key, label, icon }) => (
              <TimePicker
                key={key}
                id={key}
                label={label}
                icon={icon}
                value={times[key]}
                onChange={(value) => setTime(key, value)}
                error={timeError(key)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-7">
          <FocusHoursField value={focusHours} onChange={setFocusHours} error={focusError} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p
            className="text-sm text-slate-500"
            role={submitted && !isComplete ? 'alert' : undefined}
          >
            {submitted && !isComplete
              ? 'Please fill in the highlighted fields.'
              : 'All fields are required — rough times are fine.'}
          </p>
          <Button type="submit" size="lg">
            Continue <ArrowRight className="size-4" />
          </Button>
        </div>
      </motion.form>
    </OnboardingLayout>
  );
}
