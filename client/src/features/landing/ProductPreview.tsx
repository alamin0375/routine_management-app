import { motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Check,
  Dumbbell,
  Flame,
  Moon,
  Sparkles,
  Sun,
  TrendingUp,
} from 'lucide-react';

// Static product mock: a glassy "today" dashboard standing in for a real
// screenshot until the app exists. Purely presentational.

const TASKS = [
  { icon: Sun, label: 'Morning review', time: '8:00', tag: 'Focus', done: true },
  { icon: Brain, label: 'Deep work block', time: '9:00', tag: 'Focus', done: true },
  { icon: Dumbbell, label: 'Workout', time: '17:30', tag: 'Health', done: false },
  { icon: BookOpen, label: 'Read 20 pages', time: '21:00', tag: 'Growth', done: false },
  { icon: Moon, label: 'Wind down', time: '22:30', tag: 'Health', done: false },
] as const;

const WEEK = [82, 65, 90, 74, 88, 40, 95]; // completion % bars, Mon–Sun

export function ProductPreview() {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      {/* Glow behind the panel */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-8 -top-10 bottom-0 -z-10 rounded-[40px] bg-gradient-to-b from-violet-600/25 via-indigo-600/10 to-transparent blur-2xl"
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d15]/90 shadow-2xl shadow-violet-950/40 backdrop-blur-xl">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="ml-3 text-xs font-medium text-slate-500">RoutineApp — Today</span>
        </div>

        <div className="grid gap-px bg-white/[0.06] md:grid-cols-[1.4fr_1fr]">
          {/* Checklist pane */}
          <div className="bg-[#0d0d15] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Tuesday, July 21</p>
                <p className="text-xs text-slate-500">2 of 5 complete</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-400/10 px-2.5 py-1 text-xs font-medium text-orange-300">
                <Flame className="size-3.5" /> 12-day streak
              </span>
            </div>

            <ul className="space-y-1.5">
              {TASKS.map(({ icon: Icon, label, time, tag, done }, i) => (
                <motion.li
                  key={label}
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    done
                      ? 'border-transparent bg-white/[0.02]'
                      : 'border-white/[0.06] bg-white/[0.04]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      done
                        ? 'border-violet-500 bg-violet-500 text-white'
                        : 'border-white/20 bg-transparent'
                    }`}
                  >
                    {done && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <Icon
                    aria-hidden="true"
                    className={`size-4 shrink-0 ${done ? 'text-slate-600' : 'text-slate-400'}`}
                    strokeWidth={1.8}
                  />
                  <span
                    className={`flex-1 truncate text-sm ${done ? 'text-slate-600 line-through' : 'text-slate-200'}`}
                  >
                    {label}
                  </span>
                  <span className="hidden rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
                    {tag}
                  </span>
                  <span className={`text-xs tabular-nums ${done ? 'text-slate-600' : 'text-slate-500'}`}>
                    {time}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Insights pane */}
          <div className="flex flex-col gap-4 bg-[#0d0d15] p-5 sm:p-6">
            <div className="rounded-xl border border-violet-400/20 bg-gradient-to-b from-violet-500/15 to-indigo-500/5 p-4">
              <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                <Sparkles className="size-3.5" /> AI Coach
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                You&apos;ve kept every morning block this week. Evening workouts slip on busy days —
                want to try 7:30 AM on Thursdays?
              </p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-200">
                  Apply change
                </span>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-slate-400">
                  Dismiss
                </span>
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <TrendingUp className="size-3.5" /> This week
              </p>
              <div className="flex h-20 items-end gap-1.5">
                {WEEK.map((value, i) => (
                  <motion.div
                    key={i}
                    initial={reduce ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
                    style={{ height: `${value}%` }}
                    className={`flex-1 origin-bottom rounded-t-md ${
                      i === 6
                        ? 'bg-gradient-to-t from-violet-600 to-indigo-400'
                        : 'bg-white/15'
                    }`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-600">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <span key={i} className="flex-1 text-center">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
