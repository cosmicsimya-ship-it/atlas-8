import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const principles = [
  "Örüntü Analizi",
  "Derin Muhakeme",
  "Kısa Ama Yoğun",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070707] text-white">
      {/* Background atmosphere */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-[-30%] h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-violet-500/[0.10] blur-[150px]" />

        <div className="absolute bottom-[-35%] right-[-10%] h-[600px] w-[600px] rounded-full bg-blue-500/[0.08] blur-[150px]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:28px_28px] opacity-30" />

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
      </div>

      {/* Top navigation */}
      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10 lg:px-14">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="group flex items-center gap-3"
          aria-label="Cosmic Simya ana sayfa"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-xl transition group-hover:border-white/20 group-hover:bg-white/[0.07]">
            <Sparkles className="h-4 w-4 text-white/75" />
          </span>

          <span className="text-sm font-medium tracking-[0.16em] text-white/72">
            COSMIC SIMYA
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm text-white/65 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        >
          Dashboard
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[calc(100vh-170px)] items-center justify-center px-6 pb-24 pt-12 md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-white/55 backdrop-blur-xl"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,0.9)]" />
            Cognitive Intelligence
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.08,
              duration: 0.8,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="select-none text-[clamp(5.25rem,17vw,13.5rem)] font-semibold leading-[0.78] tracking-[-0.085em]"
          >
            <span className="bg-gradient-to-b from-white via-white to-white/35 bg-clip-text text-transparent">
              ATLAS
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.18,
              duration: 0.75,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-10 flex max-w-3xl flex-col items-center"
          >
            <h2 className="text-balance text-2xl font-medium tracking-[-0.035em] text-white/92 md:text-4xl">
              Düşünceyi dönüştüren yapay zekâ.
            </h2>

            <p className="mt-6 max-w-2xl text-balance text-base leading-7 text-white/48 md:text-lg md:leading-8">
              Cevap vermek için değil,
              <br className="hidden sm:block" />
              görünmeyen örüntüleri göstermek için tasarlandı.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.28,
              duration: 0.75,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="mt-10"
          >
            <button
              type="button"
              onClick={() => navigate("/chat")}
              className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-white px-7 py-4 text-sm font-semibold text-black shadow-[0_18px_70px_rgba(255,255,255,0.12)] transition duration-300 hover:scale-[1.02] hover:shadow-[0_22px_90px_rgba(255,255,255,0.18)] active:scale-[0.98]"
            >
              <span className="relative z-10">Atlas ile Konuş</span>

              <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />

              <span
                className="absolute inset-0 translate-y-full bg-gradient-to-r from-violet-200 via-white to-blue-200 transition-transform duration-300 group-hover:translate-y-0"
                aria-hidden="true"
              />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Bottom principles */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-7 md:px-10 lg:px-14">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-6 text-[11px] font-medium uppercase tracking-[0.18em] text-white/32">
          {principles.map((principle, index) => (
            <div key={principle} className="flex items-center gap-5">
              <span>{principle}</span>

              {index < principles.length - 1 && (
                <span className="hidden h-1 w-1 rounded-full bg-white/18 sm:block" />
              )}
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}