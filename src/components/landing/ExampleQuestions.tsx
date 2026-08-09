import { Link } from 'react-router-dom';

import { landingExampleQuestions } from '../../data/landing-content';
import ObservatoryField from './ObservatoryField';

/** Concrete prompt examples — not testimonials. */
export default function ExampleQuestions() {
  const { id, eyebrow, title, body, questions, cta } = landingExampleQuestions;

  return (
    <section id={id} className="atlas-section relative scroll-mt-24" aria-labelledby="examples-title">
      <ObservatoryField density="subtle" className="opacity-30" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <p className="text-[0.7rem] font-medium tracking-[0.28em] text-[#c9b37a]/65">
          {eyebrow}
        </p>
        <h2
          id="examples-title"
          className="mt-4 max-w-2xl font-display text-[clamp(1.85rem,4vw,2.75rem)] font-medium tracking-[-0.02em] text-[#f5f0e6]"
        >
          {title}
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-7 text-[#9a9488]">{body}</p>

        <ul className="mt-12 max-w-2xl space-y-0 border-t border-white/[0.07]">
          {questions.map((q, i) => (
            <li
              key={q}
              className="border-b border-white/[0.06] py-5 text-[15px] leading-7 text-[#e8e2d6] sm:text-base"
            >
              <span className="mr-3 font-mono text-[0.7rem] tracking-[0.18em] text-[#c9b37a]/45">
                {String(i + 1).padStart(2, '0')}
              </span>
              {q}
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link to={cta.to} className="atlas-btn-primary min-h-12 touch-manipulation">
            {cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
