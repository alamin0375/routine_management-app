import {
  Bot,
  CalendarClock,
  CheckCheck,
  HeartHandshake,
  LineChart,
  ShieldCheck,
} from 'lucide-react';
import { Container } from '../../components/Container';
import { FeatureCard } from '../../components/FeatureCard';
import { Reveal } from '../../components/Reveal';

// Feature copy mirrors PRODUCT_REQUIREMENTS.md: create / follow / track,
// with AI as the differentiator and forgiving mechanics as a selling point.
const FEATURES = [
  {
    icon: Bot,
    title: 'AI builds it with you',
    description:
      'Describe your goals and your real week — get a realistic routine in minutes, not an unsustainable 5am fantasy schedule.',
  },
  {
    icon: CheckCheck,
    title: 'One-tap tracking',
    description:
      'A clean daily checklist. Check things off in a second and get on with your day — no fiddly logging.',
  },
  {
    icon: LineChart,
    title: 'Insights, not just data',
    description:
      'Weekly summaries show what worked and what didn’t, with concrete suggestions like moving a task to a time you actually keep.',
  },
  {
    icon: HeartHandshake,
    title: 'Forgiving by design',
    description:
      'Missed a day? No guilt trips. Your routine adapts and helps you restart lighter instead of breaking your momentum.',
  },
  {
    icon: CalendarClock,
    title: 'Made for busy schedules',
    description:
      'Exam week or a packed sprint at work — routines flex around your commitments instead of fighting them.',
  },
  {
    icon: ShieldCheck,
    title: 'Your data stays yours',
    description:
      'Routines are personal. Export everything anytime, delete your account in one click — no lock-in, no surprises.',
  },
] as const;

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      {/* Faint divider glow at the section top */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 mx-auto h-px max-w-4xl bg-gradient-to-r from-transparent via-violet-400/40 to-transparent"
      />
      <Container>
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-400">
            Features
          </p>
          <h2 className="text-balance bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Everything you need to stay consistent
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Create, follow, and track daily routines — with an AI coach that adapts to how your
            week actually goes.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={(i % 3) * 0.1}>
              <FeatureCard {...feature} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
