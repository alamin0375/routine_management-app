import { ArrowRight } from 'lucide-react';
import { Container } from '../../components/Container';
import { ButtonLink } from '../../components/Button';
import { Reveal } from '../../components/Reveal';

export function CallToAction() {
  return (
    <section id="get-started" className="pb-24 sm:pb-32">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d15] px-6 py-16 text-center sm:px-12 sm:py-20">
            {/* Aurora backdrop inside the panel */}
            <div aria-hidden="true" className="absolute inset-0 -z-0">
              <div className="absolute left-1/2 top-0 h-72 w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(124,92,255,0.35),transparent_70%)] blur-2xl" />
              <div className="absolute bottom-[-40%] left-[15%] h-56 w-80 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.18),transparent_70%)] blur-3xl" />
            </div>

            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-balance bg-gradient-to-b from-white to-slate-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
                Ready to build a routine that fits your life?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
                Join students and professionals turning good intentions into daily habits.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {/* Becomes the signup route once auth ships (Phase 1 backend). */}
                <ButtonLink href="#" size="lg">
                  Start free today <ArrowRight className="size-4" />
                </ButtonLink>
              </div>
              <p className="mt-5 text-sm text-slate-500">
                Free plan · 3 routines · AI starter suggestion
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
