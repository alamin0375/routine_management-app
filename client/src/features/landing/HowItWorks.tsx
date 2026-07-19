import { MessageSquareText, Wand2, Repeat } from 'lucide-react';
import { Container } from '../../components/Container';
import { Reveal } from '../../components/Reveal';

const STEPS = [
  {
    icon: MessageSquareText,
    step: '01',
    title: 'Tell the AI your goals',
    description: 'A two-minute chat about what you want and what your days look like.',
  },
  {
    icon: Wand2,
    step: '02',
    title: 'Get a realistic routine',
    description: 'Review the proposal, tweak anything — you stay in control.',
  },
  {
    icon: Repeat,
    step: '03',
    title: 'Follow, track, adapt',
    description: 'Check off tasks daily; weekly insights help the routine evolve with you.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32">
      <Container>
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-violet-400">
            How it works
          </p>
          <h2 className="text-balance bg-gradient-to-b from-white to-slate-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
            Up and running in three steps
          </h2>
        </Reveal>
        <ol className="relative grid gap-10 sm:grid-cols-3 sm:gap-6">
          {/* Connecting line (desktop) */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent sm:block"
          />
          {STEPS.map(({ icon: Icon, step, title, description }, i) => (
            <Reveal key={step} delay={i * 0.15}>
              <li className="relative flex flex-col items-center text-center">
                <span className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0d0d15] text-violet-300 shadow-[0_0_24px_-8px_rgba(124,92,255,0.6)]">
                  <Icon className="size-6" strokeWidth={1.8} />
                </span>
                <span className="mb-2 text-xs font-semibold tracking-widest text-slate-600">
                  {step}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
                <p className="max-w-xs text-sm leading-relaxed text-slate-400">{description}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
