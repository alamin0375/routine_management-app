import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlarmClock,
  ArrowLeft,
  BedDouble,
  BookOpen,
  Briefcase,
  Coffee,
  Dumbbell,
  GraduationCap,
  Info,
  Lightbulb,
  Moon,
  RotateCcw,
  Sandwich,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Container } from '../../components/Container';
import { Logo } from '../../components/Logo';
import { Button } from '../../components/Button';
import { findGoal } from './goals';
import {
  arePreferencesComplete,
  isScheduleComplete,
  useOnboardingStore,
  type ScheduleTimes,
} from './store';
import { FOCUS_AREAS, INTENSITIES, STYLES } from './PreferencesPage';

// End of the onboarding flow: a schedule assembled deterministically from the
// user's actual answers. Placeholder for real AI generation (Phase 4) — the
// layout and card design carry over, only the data source changes.

interface RoutineItem {
  icon: LucideIcon;
  time: string; // display string: "07:30" or "Morning block"
  sortKey: number; // minutes since midnight, for ordering
  title: string;
  detail: string;
  kind: 'anchor' | 'focus';
}

const FOCUS_BLOCKS: Record<
  string,
  { icon: LucideIcon; title: string; detail: (goalLabel: string) => string }
> = {
  study: {
    icon: GraduationCap,
    title: 'Study session',
    detail: () => 'Deep focus on coursework',
  },
  work: {
    icon: Briefcase,
    title: 'Deep work block',
    detail: () => 'Your most important task first',
  },
  fitness: {
    icon: Dumbbell,
    title: 'Workout',
    detail: () => 'Movement to reset your energy',
  },
  reading: {
    icon: BookOpen,
    title: 'Reading time',
    detail: () => '20 pages or 25 minutes',
  },
  'skill-learning': {
    icon: Lightbulb,
    title: 'Skill practice',
    detail: () => 'Deliberate practice, small steps',
  },
  'better-sleep': {
    icon: BedDouble,
    title: 'Wind-down ritual',
    detail: () => 'Screens off, easy evening',
  },
};

// Per-intensity shape of the day: how long focus blocks run, and how many
// fit per gap between anchors.
const INTENSITY_CONFIG: Record<string, { blockMinutes: number; perGap: number; tone: string }> = {
  relaxed: { blockMinutes: 45, perGap: 1, tone: 'with plenty of breathing room' },
  balanced: { blockMinutes: 60, perGap: 2, tone: 'steady and sustainable' },
  ambitious: { blockMinutes: 90, perGap: 3, tone: 'packed for momentum' },
};

const toMinutes = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const toHHMM = (minutes: number): string => {
  const clamped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
};

interface BuildInput {
  times: ScheduleTimes;
  intensity: string;
  style: string;
  focusAreas: string[];
  goalLabel: string;
}

function buildRoutine({ times, intensity, style, focusAreas, goalLabel }: BuildInput): RoutineItem[] {
  const wake = toMinutes(times.wakeTime);
  const breakfast = toMinutes(times.breakfastTime);
  const lunch = toMinutes(times.lunchTime);
  const dinner = toMinutes(times.dinnerTime);
  // A sleep time "before" wake (e.g. 00:30) belongs to the next day.
  const rawSleep = toMinutes(times.sleepTime);
  const sleep = rawSleep <= wake ? rawSleep + 1440 : rawSleep;

  const anchors: RoutineItem[] = [
    {
      icon: AlarmClock,
      time: times.wakeTime,
      sortKey: wake,
      title: 'Wake up & morning reset',
      detail: 'Water, light, a calm start',
      kind: 'anchor',
    },
    {
      icon: Coffee,
      time: times.breakfastTime,
      sortKey: breakfast,
      title: 'Breakfast',
      detail: 'Fuel up before the day begins',
      kind: 'anchor',
    },
    {
      icon: Sandwich,
      time: times.lunchTime,
      sortKey: lunch,
      title: 'Lunch break',
      detail: 'Step away from the desk',
      kind: 'anchor',
    },
    {
      icon: UtensilsCrossed,
      time: times.dinnerTime,
      sortKey: dinner,
      title: 'Dinner',
      detail: 'Unplug and recharge',
      kind: 'anchor',
    },
    {
      icon: Moon,
      time: times.sleepTime,
      sortKey: sleep,
      title: 'Lights out',
      detail: `Protecting tomorrow's energy`,
      kind: 'anchor',
    },
  ];

  const config = INTENSITY_CONFIG[intensity] ?? INTENSITY_CONFIG.balanced!;

  // Gaps between consecutive anchors where focus blocks can live. Meals
  // block out ~45 min; mornings start 30 min after waking up.
  const sortedAnchors = [...anchors].sort((a, b) => a.sortKey - b.sortKey);
  const gaps: { start: number; end: number; label: string }[] = [];
  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    const current = sortedAnchors[i]!;
    const next = sortedAnchors[i + 1]!;
    const isWake = current.sortKey === wake;
    const start = current.sortKey + (isWake ? 30 : 45);
    const end = next.sortKey - 15;
    if (end - start >= config.blockMinutes) {
      const mid = (start + end) / 2;
      const label = mid < 12 * 60 ? 'Morning' : mid < 17 * 60 ? 'Afternoon' : 'Evening';
      gaps.push({ start, end, label });
    }
  }

  // Wind-down always belongs at the end of the day, so schedule it last.
  const orderedAreas = [...focusAreas].sort((a, b) =>
    a === 'better-sleep' ? 1 : b === 'better-sleep' ? -1 : 0,
  );

  const focusItems: RoutineItem[] = [];
  let gapIndex = 0;
  let usedInGap = 0;
  for (const area of orderedAreas) {
    const block = FOCUS_BLOCKS[area];
    if (!block) continue;

    if (area === 'better-sleep') {
      // Pin the wind-down ritual to the hour before lights out.
      focusItems.push({
        icon: block.icon,
        time: style === 'fixed' ? toHHMM(sleep - 60) : 'Evening block',
        sortKey: sleep - 60,
        title: block.title,
        detail: block.detail(goalLabel),
        kind: 'focus',
      });
      continue;
    }

    // Walk gaps round-robin, packing up to `perGap` blocks in each.
    while (gapIndex < gaps.length && usedInGap >= config.perGap) {
      gapIndex++;
      usedInGap = 0;
    }
    const gap = gaps[gapIndex] ?? gaps[gaps.length - 1];
    if (!gap) continue;
    const startAt = Math.min(gap.start + usedInGap * (config.blockMinutes + 15), gap.end - config.blockMinutes);

    focusItems.push({
      icon: block.icon,
      time:
        style === 'fixed'
          ? toHHMM(startAt)
          : `${gap.label} block · ${config.blockMinutes} min`,
      sortKey: startAt,
      title: block.title,
      detail: block.detail(goalLabel),
      kind: 'focus',
    });
    usedInGap++;
  }

  return [...anchors, ...focusItems].sort((a, b) => a.sortKey - b.sortKey);
}

const labelOf = (options: readonly { value: string; label: string }[], value: string | null) =>
  options.find((o) => o.value === value)?.label ?? '';

export function RoutinePreviewPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const goalValue = useOnboardingStore((s) => s.goal);
  const times = useOnboardingStore((s) => s.times);
  const focusHours = useOnboardingStore((s) => s.focusHours);
  const intensity = useOnboardingStore((s) => s.intensity);
  const style = useOnboardingStore((s) => s.style);
  const focusAreas = useOnboardingStore((s) => s.focusAreas);
  const reset = useOnboardingStore((s) => s.reset);
  const goal = findGoal(goalValue ?? undefined);

  const isReady =
    goal && isScheduleComplete(times, focusHours) && arePreferencesComplete({ intensity, style, focusAreas });

  useEffect(() => {
    if (!isReady) navigate('/onboarding', { replace: true });
  }, [isReady, navigate]);

  if (!isReady || !goal) return null;

  const routine = buildRoutine({
    times,
    intensity: intensity!,
    style: style!,
    focusAreas,
    goalLabel: goal.label,
  });
  const GoalIcon = goal.icon;
  const intensityLabel = labelOf(INTENSITIES, intensity);
  const intensityTone = INTENSITY_CONFIG[intensity!]?.tone ?? '';
  const focusAreaLabels = focusAreas
    .map((v) => FOCUS_AREAS.find((a) => a.value === v)?.label)
    .filter(Boolean)
    .join(' · ');

  const handleStartOver = () => {
    reset();
    navigate('/onboarding');
  };

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08080d] text-slate-200 antialiased selection:bg-violet-500/30 selection:text-white">
      {/* Celebration glow */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-15%] h-[550px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.28),transparent_70%)] blur-2xl" />
      </div>

      <header className="border-b border-white/[0.06]">
        <Container className="flex h-16 items-center justify-between">
          <Link to="/" aria-label="RoutineApp home">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleStartOver}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-white"
            >
              <RotateCcw className="size-3.5" /> Start over
            </button>
            <Link
              to="/onboarding/preferences"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="size-4" /> Back to preferences
            </Link>
          </div>
        </Container>
      </header>

      <main className="py-12 sm:py-16">
        <Container className="max-w-3xl">
          <motion.div {...rise(0)} className="text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-1.5 text-sm font-medium text-violet-200">
              <Sparkles className="size-4" /> Your routine is ready ✨
            </span>
            <h1 className="text-balance bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              Here&apos;s your day — {intensityTone}
            </h1>
          </motion.div>

          {/* Summary of everything collected */}
          <motion.div
            {...rise(0.1)}
            className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
              <GoalIcon className="size-4 text-violet-300" strokeWidth={1.8} /> {goal.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
              {times.wakeTime} – {times.sleepTime}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
              {focusHours}h focus / day
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
              {intensityLabel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
              {labelOf(STYLES, style)}
            </span>
          </motion.div>

          {/* Focus areas echo */}
          <motion.p {...rise(0.15)} className="mt-3 text-center text-sm text-slate-500">
            Making time for: {focusAreaLabels}
          </motion.p>

          {/* Routine cards */}
          <div className="mt-10 space-y-2.5">
            {routine.map((item, i) => {
              const ItemIcon = item.icon;
              const isFocus = item.kind === 'focus';
              return (
                <motion.div
                  key={`${item.title}-${i}`}
                  initial={reduce ? false : { opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06, duration: 0.45, ease: 'easeOut' }}
                  className={`flex items-center gap-4 rounded-2xl border p-4 backdrop-blur-sm ${
                    isFocus
                      ? 'border-violet-400/25 bg-gradient-to-r from-violet-500/10 to-indigo-500/5'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl border ${
                      isFocus
                        ? 'border-violet-400/40 bg-violet-500/15 text-violet-200'
                        : 'border-white/10 bg-white/[0.04] text-slate-400'
                    }`}
                  >
                    <ItemIcon className="size-5" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[15px] font-semibold ${isFocus ? 'text-white' : 'text-slate-200'}`}
                    >
                      {item.title}
                    </p>
                    <p className="truncate text-sm text-slate-400">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-slate-400">
                    {item.time}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* AI-coming-later note */}
          <motion.div
            {...rise(0.5)}
            className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-400"
          >
            <Info className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden="true" />
            <p>
              This preview is assembled from your answers. Soon, our AI coach will generate it for
              you — personalized, adjustable in chat, and adaptive to how your weeks actually go.
            </p>
          </motion.div>

          <motion.div
            {...rise(0.6)}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            {/* Saving requires accounts + backend — arrives in a later phase. */}
            <Button size="lg" disabled title="Available once accounts launch">
              Save my routine
            </Button>
          </motion.div>
        </Container>
      </main>
    </div>
  );
}
