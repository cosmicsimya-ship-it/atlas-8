import CosmicShell from '../components/cosmic/CosmicShell';

export default function AboutPage() {
  return (
    <CosmicShell>
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8">
        <p className="text-xs uppercase tracking-[0.22em] text-[#c9b37a]/65">Hakkında</p>
        <h1 className="mt-2 font-display text-4xl text-[#f5f0e8]">Atlas nedir?</h1>

        <div className="mt-10 space-y-6 text-sm leading-8 text-[#f5f0e8]/68 md:text-base">
          <p className="font-display text-xl text-[#f5f0e8]/88">
            Atlas yalnızca cevap üretmez.
          </p>
          <p>
            Astroloji, numeroloji ve kişisel veriler arasındaki tekrar eden yapıları karşılaştırır.
            Amacı geleceği kesin biçimde söylemek değil; daha önce görünmeyen örüntüyü görünür
            kılmaktır.
          </p>
          <p>
            Cosmicsimya.com! arayüzü, Atlas zekâ katmanına erişim sağlar: kişisel analiz, arşiv,
            sembolik sentez ve hafıza destekli sohbet — hepsi aynı backend mimarisine bağlıdır.
          </p>
          <p className="text-[#f5f0e8]/45">
            Atlas kesin kehanet sunmaz; sembolik sistemleri olasılık ve farkındalık diliyle ele
            alır.
          </p>
        </div>
      </main>
    </CosmicShell>
  );
}
