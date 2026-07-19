import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Container } from '../../components/Container';
import { ButtonLink, ButtonRouterLink } from '../../components/Button';
import { ProductPreview } from './ProductPreview';

export function Hero() {
  const reduce = useReducedMotion();

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] as const },
  });

  return (
    <section className="relative overflow-hidden pb-24 pt-20 sm:pb-32 sm:pt-28">
      {/* Background: radial violet glow + faint grid, Linear-style */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-20%] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.28),rgba(80,60,220,0.08)_55%,transparent_75%)] blur-2xl" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 75%)',
          }}
        />
      </div>

      <Container className="flex flex-col items-center text-center">
        <motion.span
          {...rise(0)}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-1.5 pr-4 text-sm text-slate-300 backdrop-blur"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500/30 to-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold text-violet-200">
            <Sparkles className="size-3" /> New
          </span>
          AI-powered routine coaching
        </motion.span>

        <motion.h1
          {...rise(0.1)}
          className="max-w-4xl bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-balance text-5xl font-bold leading-[1.05] tracking-tight text-transparent sm:text-6xl lg:text-7xl"
        >
          Routines that adapt to your life
        </motion.h1>

        <motion.p
          {...rise(0.2)}
          className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-slate-400"
        >
          Tell the AI coach your goals and your real schedule. Get a routine you&apos;ll actually
          keep — one tap to track, smart adjustments when life gets in the way.
        </motion.p>

        <motion.div
          {...rise(0.3)}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <ButtonRouterLink to="/onboarding" size="lg">
            Start free <ArrowRight className="size-4" />
          </ButtonRouterLink>
          <ButtonLink href="#how-it-works" variant="secondary" size="lg">
            See how it works
          </ButtonLink>
        </motion.div>

        <motion.p {...rise(0.4)} className="mt-4 text-sm text-slate-500">
          Free to start · No credit card required
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mt-16 w-full sm:mt-20"
        >
          <ProductPreview />
        </motion.div>
      </Container>
    </section>
  );
}
