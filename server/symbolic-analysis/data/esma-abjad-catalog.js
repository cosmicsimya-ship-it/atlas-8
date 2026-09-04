/**
 * Verified Esma abjad values for classical kebîr matching.
 * Bare (without ال) and definite (with ال) forms are stored separately.
 * Values are computed via calculateAbjad at module load — never hardcoded,
 * never LLM totals. If a seed's Arabic spelling can't be tokenized, module
 * load throws (fail loud, not silent).
 *
 * Theme-motif catalog (esma-catalog.js) remains separate; this file is for
 * numeric exact/near/reduced match only.
 *
 * SEED PROVENANCE (Faz: Ebced Engine v1, 2026-09-04): expanded from a 6-entry
 * hand-curated seed to the full 99-name set reverse-engineered from
 * EBCED HESAPLAMA TABLOSU.xlsx ('Esma Ebced' sheet, literal data, no
 * formulas). Per ADR-004 (Esma Catalog Count Policy) this is the
 * "atlas-esma-99-curated-tr-v1" list variant: names-only count, lafẓatullāh
 * not included, curationStatus is DRAFT (source-review / product approval
 * per ADR-004 has not happened — this is the reverse-engineered starting
 * point, not a claim that the 99 is final or theologically definitive).
 *
 * Every value below is Atlas's own calculateAbjad() output, NOT the
 * workbook's claimed value — see docs/ebced/PHASE15-WORKBOOK-COMPARISON.md
 * for the full comparison. 91 of 99 matched the workbook exactly; the 8
 * that didn't were traced to workbook data-entry errors (typos, a
 * transposed pair, spelling-vs-value mismatches), not engine bugs — Atlas
 * does not silently adopt a workbook value its own calculation disagrees
 * with (this is the explicit product requirement, not an incidental
 * choice).
 */

import { calculateAbjad, ABJAD_KABIR_CLASSICAL_V1 } from '../calculate-abjad.js';

/**
 * @typedef {{
 *   letter: string,
 *   value: number,
 * }} EsmaLetterBreakdown
 *
 * @typedef {{
 *   id: string,
 *   canonicalArabic: string,
 *   definiteArabic: string,
 *   displayNameTr: string,
 *   meaningTr: string|null,
 *   bareValue: number,
 *   definiteValue: number,
 *   calculationMethod: string,
 *   letterBreakdown: EsmaLetterBreakdown[],
 *   definiteLetterBreakdown: EsmaLetterBreakdown[],
 *   latinAliases: string[],
 * }} VerifiedEsmaAbjadEntry
 */

export const ESMA_CATALOG_LIST_VARIANT_ID = 'atlas-esma-99-curated-tr-v1';
export const ESMA_CATALOG_COUNT_POLICY = 'names-only-99';
export const ESMA_CATALOG_INCLUDES_ALLAH_LAFZA = false;
export const ESMA_CATALOG_CURATION_STATUS = 'draft';

/**
 * Seed orthographies — totals filled by buildVerifiedEsmaEntry.
 * @type {readonly { id: string, canonicalArabic: string, definiteArabic: string, displayNameTr: string, meaningTr: string|null, latinAliases: string[] }[]}
 */
const ESMA_ABJAD_SEEDS = Object.freeze([
  {
    id: "ehad",
    canonicalArabic: "احد",
    definiteArabic: "الاحد",
    displayNameTr: "Ehad",
    meaningTr: "Zâtında şeriki olmayan, tek olan, kendinden başka ilah olmayan, eşi ve benzeri bulunmayan, her şeyde birliğini ve ehadiyetini gösteren.",
    latinAliases: ["ehad"],
  },
  {
    id: "vehhab",
    canonicalArabic: "وهاب",
    definiteArabic: "الوهاب",
    displayNameTr: "Vehhab",
    meaningTr: "Yarattıklarına bolca veren, karşılıksız nimetler sunan. İhsanı bol ve sonsuz olan anlamlarına gelmektedir.",
    latinAliases: ["vehhab"],
  },
  {
    id: "vacid",
    canonicalArabic: "واجد",
    definiteArabic: "الواجد",
    displayNameTr: "Vacid",
    meaningTr: "Her şeyi bilen, hiçbir şeye muhtaç olmayan, emrini ve isteğini daima gerçekleştiren",
    latinAliases: ["vacid"],
  },
  {
    id: "hayy",
    canonicalArabic: "حي",
    definiteArabic: "الحي",
    displayNameTr: "Hayy",
    meaningTr: "Daima diri olan, her şeye hayat ve can veren, sonsuz, sınırsız bir hayatın sahibi olan, her şeyi bilen ve her şeye gücü yeten, gerçek hayat sahibi olan demektir.",
    latinAliases: ["hayy"],
  },
  {
    id: "vahid",
    canonicalArabic: "واحد",
    definiteArabic: "الواحد",
    displayNameTr: "Vahid",
    meaningTr: "Allahu Tealanın eşi ve benzeri olmayan tek olması anlamına gelmektedir.",
    latinAliases: ["vahid"],
  },
  {
    id: "vedud",
    canonicalArabic: "ودود",
    definiteArabic: "الودود",
    displayNameTr: "Vedud",
    meaningTr: "Sevilen gerçek ve tek varlık. Sevilmeyi, dostluğu kazanılmayı en fazla layık olan ve kendisi de itaatkar kullarını çok sevendir.",
    latinAliases: ["vedud"],
  },
  {
    id: "hadi",
    canonicalArabic: "هادي",
    definiteArabic: "الهادي",
    displayNameTr: "Hadi",
    meaningTr: "Dilediği kullarını hidayete erdiren, doğru yola ulaştıran, dilediği kulunu hayırlı yollara yönelten",
    latinAliases: ["hadi"],
  },
  {
    id: "evvel",
    canonicalArabic: "اول",
    definiteArabic: "الاول",
    displayNameTr: "Evvel",
    meaningTr: "Başlangıcı olmayan, ilk olan, varlığı kendi zatı ile olan, yaratmayı başlatan",
    latinAliases: ["evvel"],
  },
  {
    id: "veli",
    canonicalArabic: "ولى",
    definiteArabic: "الولى",
    displayNameTr: "Veli",
    meaningTr: "Allah, sevdiği kullarının dostudur. Allah, sevdiği kullarına yardım eder onların kalbine ferahlık ve genişlik verir.",
    latinAliases: ["veli"],
  },
  {
    id: "vali",
    canonicalArabic: "والي",
    definiteArabic: "الوالي",
    displayNameTr: "Vali",
    meaningTr: "Kainatın tek hakimi, yöneticisi ve kainatı kusursuz ve eksiksiz bir şekilde yöneten",
    latinAliases: ["vali"],
  },
  {
    id: "macid",
    canonicalArabic: "ماجد",
    definiteArabic: "الماجد",
    displayNameTr: "Macid",
    meaningTr: "Sonsuz şan-şeref ve yücelik sahibi, ihsanı, cömertliği bol olan",
    latinAliases: ["macid"],
  },
  {
    id: "mucib",
    canonicalArabic: "مجيب",
    definiteArabic: "المجيب",
    displayNameTr: "Mucib",
    meaningTr: "Kullarının hacetlerine ve dualarına karşılık verendir.",
    latinAliases: ["mucib"],
  },
  {
    id: "mubdi",
    canonicalArabic: "مبدى",
    definiteArabic: "المبدى",
    displayNameTr: "Mubdi",
    meaningTr: "Modeli ve örneği olmaksızın ibtidâen yaratan",
    latinAliases: ["mubdi"],
  },
  {
    id: "mecid",
    canonicalArabic: "مجيد",
    definiteArabic: "المجيد",
    displayNameTr: "Mecid",
    meaningTr: "Şeref sahibi. Azameti, kadri, şanı büyük, vermesi bol, zati şerefli, işleri güzel olan",
    latinAliases: ["mecid"],
  },
  {
    id: "hamid",
    canonicalArabic: "حميد",
    definiteArabic: "الحميد",
    displayNameTr: "Hamid",
    meaningTr: "Her lisanla, her varlığın diliyle övülen. Övülmüş ve her senaya layık olan, ancak kendisine hamd ve sena olunan, bütün varlıkların diliyle övülen yegane zat en çok övülen ve en çok övgüye layık olan",
    latinAliases: ["hamid"],
  },
  {
    id: "batin",
    canonicalArabic: "باطن",
    definiteArabic: "الباطن",
    displayNameTr: "Batın",
    meaningTr: "Allah'ın (cc) varlığının sınırsız olması nedeniyle kulların sınırlı halleri ile anlaşılmaması ve görülememesi ",
    latinAliases: ["batın", "batin"],
  },
  {
    id: "vekil",
    canonicalArabic: "وكيل",
    definiteArabic: "الوكيل",
    displayNameTr: "Vekil",
    meaningTr: "Kendisine tevekkül edenlerin işlerini en iyi neticeye ulaştıran",
    latinAliases: ["vekil"],
  },
  {
    id: "hakem",
    canonicalArabic: "حكم",
    definiteArabic: "الحكم",
    displayNameTr: "Hakem",
    meaningTr: "Mutlak hakim olan ve tek hüküm sahibi olan",
    latinAliases: ["hakem"],
  },
  {
    id: "muhyi",
    canonicalArabic: "محيي",
    definiteArabic: "المحيي",
    displayNameTr: "Muhyi",
    meaningTr: "Mahlukatı yoktan var edip hayat veren, can bağışlayan, sağlık veren, yaşatan",
    latinAliases: ["muhyi"],
  },
  {
    id: "basit",
    canonicalArabic: "باسط",
    definiteArabic: "الباسط",
    displayNameTr: "Basıt",
    meaningTr: "Maddi ve manevi rızkını vererek genişleten, ferahlık veren, rahatlık ve neşe veren",
    latinAliases: ["basıt", "basit"],
  },
  {
    id: "celil",
    canonicalArabic: "جليل",
    definiteArabic: "الجليل",
    displayNameTr: "Celil",
    meaningTr: "Hiçbir kayıt ve kıyas kabul etmeksizin azamet sahibi, kadri kıymeti ve mertebesi en yüce olan",
    latinAliases: ["celil"],
  },
  {
    id: "hakim",
    canonicalArabic: "حكيم",
    definiteArabic: "الحكيم",
    displayNameTr: "El-Hakîm",
    meaningTr: "Her iş emrinde hüküm ve hikmet sahibi gerekeni en güzel biçimde yapan",
    latinAliases: ["hakim", "hakîm", "el-hakim", "el-hakîm"],
  },
  {
    id: "hasib",
    canonicalArabic: "حسيب",
    definiteArabic: "الحسيب",
    displayNameTr: "Hasib",
    meaningTr: "O, Allah ki; parçaları bütünüyle bilendir, hesap etmeden bilen, üstün niteliklere sahip olandır.",
    latinAliases: ["hasib"],
  },
  {
    id: "bedi",
    canonicalArabic: "بديع",
    definiteArabic: "البديع",
    displayNameTr: "Bedi",
    meaningTr: "Eşsiz bir sanatla, önceden var olan bir malzemeye ihtiyaç duymadan, yoktan var eden",
    latinAliases: ["bedi"],
  },
  {
    id: "halim",
    canonicalArabic: "حليم",
    definiteArabic: "الحليم",
    displayNameTr: "Halim",
    meaningTr: "Tüm kullarına gücü yeten Allah yine de kullarına ceza verme konusunda yavaş olandır",
    latinAliases: ["halim"],
  },
  {
    id: "melik",
    canonicalArabic: "ملك",
    definiteArabic: "الملك",
    displayNameTr: "El-Melik",
    meaningTr: "Görülen ve görülmeyen bütün âlemlerin, bütün kâinatın tek sahibi ve mutlak surette tek hükümdârı",
    latinAliases: ["melik", "malik", "el-melik", "el-malik", "el melik", "الملك", "ملك"],
  },
  {
    id: "aziz",
    canonicalArabic: "عزيز",
    definiteArabic: "العزيز",
    displayNameTr: "Aziz",
    meaningTr: "Mağlup edilemeyen mağlup edilmesi mümkün olmayan, sonsuz İzzet sahibi, azamet ve şeref sahibi",
    latinAliases: ["aziz"],
  },
  {
    id: "adl",
    canonicalArabic: "عدل",
    definiteArabic: "العدل",
    displayNameTr: "Adl",
    meaningTr: "Mutlak adil olan ve çok adaletli olan",
    latinAliases: ["adl"],
  },
  {
    id: "hakk",
    canonicalArabic: "حق",
    definiteArabic: "الحق",
    displayNameTr: "Hakk",
    meaningTr: "Ahiret gününde hak ile batılı birbirinden ayıran ve hakkı olanı sahiplerine zalimlerden alıp veren",
    latinAliases: ["hakk"],
  },
  {
    id: "aliy",
    canonicalArabic: "علي",
    definiteArabic: "العلي",
    displayNameTr: "Aliy",
    meaningTr: "Şanı, şerefi, izzeti ve kudreti yüce olan O, her şeyin ötesinde ve her yönüyle yüce olandır.",
    latinAliases: ["aliy"],
  },
  {
    id: "baki",
    canonicalArabic: "با قي",
    definiteArabic: "البا قي",
    displayNameTr: "Baki",
    meaningTr: "Ebedî olan; varlığının sonu olmayan",
    latinAliases: ["baki"],
  },
  {
    id: "cami",
    canonicalArabic: "جامع",
    definiteArabic: "الجامع",
    displayNameTr: "Cami",
    meaningTr: "Huzurunda toplayan, bir araya getiren, tertip eden",
    latinAliases: ["cami"],
  },
  {
    id: "kaviy",
    canonicalArabic: "قوي",
    definiteArabic: "القوي",
    displayNameTr: "Kaviy",
    meaningTr: "Her şeye gücü yeten, kudret sahibi, yorgunluğa ve zaafa uğramayan, gücü ve kuvveti sonsuz olan",
    latinAliases: ["kaviy"],
  },
  {
    id: "muizz",
    canonicalArabic: "معز",
    definiteArabic: "المعز",
    displayNameTr: "Muizz",
    meaningTr: "Aziz kılan yani yükselten güçlendiren yücelten",
    latinAliases: ["muizz"],
  },
  {
    id: "muid",
    canonicalArabic: "معيد",
    definiteArabic: "المعيد",
    displayNameTr: "Muid",
    meaningTr: "Allahın can veren verdiği canı tekrar alabilen ve ölen canlıları tekrar canlandıran tek yaratıcı",
    latinAliases: ["muid"],
  },
  {
    id: "latif",
    canonicalArabic: "لطيف",
    definiteArabic: "اللطيف",
    displayNameTr: "El-Latîf",
    meaningTr: "Sonsuz lütuf ve ikram sahibi, her şeyi doğrusuyla ve ayrıntılarıyla bilen",
    latinAliases: ["latif", "latîf", "el-latif", "el-latîf", "el latif", "اللطيف", "لطيف"],
  },
  {
    id: "selam",
    canonicalArabic: "سلام",
    definiteArabic: "السلام",
    displayNameTr: "Es-Selâm",
    meaningTr: "Esenlik, ferahlık veren, her türlü kötü durumdan selamete erdiren ve gözetip koruyan",
    latinAliases: ["selam", "salam", "es-selam", "es-selâm"],
  },
  {
    id: "samed",
    canonicalArabic: "صمد",
    definiteArabic: "الصمد",
    displayNameTr: "Samed",
    meaningTr: "Hiçbir şeye ihtiyaç duymayan hiçbir şeye muhtaç olmayan",
    latinAliases: ["samed"],
  },
  {
    id: "mumin",
    canonicalArabic: "مومن",
    definiteArabic: "المومن",
    displayNameTr: "Mümin",
    meaningTr: "Gönüllere iman ruhu vererek kendisine sığınan kişilere emniyet ve güvenlik veren, Mü'minleri azaplarından ve yarattıklarının hepsini zulmünden emin kılan kullarına huzur ve güven veren. Emniyet sahibi ve sadık sözünden vaadinden dönmeyen.",
    latinAliases: ["mümin", "mumin"],
  },
  {
    id: "vasi",
    canonicalArabic: "واسع",
    definiteArabic: "الواسع",
    displayNameTr: "Vasi",
    meaningTr: "Her türlü isteğe karşı ihsan ve lutufkârlığı yeterli olan, ilmi her şeyi kuşatan, rızkı bütün yaratılmışlara yayılan ve rahmeti her şeyi kapsayan",
    latinAliases: ["vasi"],
  },
  {
    id: "muheymin",
    canonicalArabic: "مهيمن",
    definiteArabic: "المهيمن",
    displayNameTr: "Müheymin",
    meaningTr: "Her şeyi görüp gözeten, her mahlukun yaptığından ve durumundan haberdar olan",
    latinAliases: ["müheymin", "muheymin"],
  },
  {
    id: "muhsi",
    canonicalArabic: "محسي",
    definiteArabic: "المحسي",
    displayNameTr: "Muhsi",
    meaningTr: "İlmiyle her şeyi sayan,büyük veya küçük hiçbir şey gözünden kaçmayan.Cenabı Allah'ın İlmi ve ihatası sonsuzdur.",
    latinAliases: ["muhsi"],
  },
  {
    id: "alim",
    canonicalArabic: "عالم",
    definiteArabic: "العالم",
    displayNameTr: "Alim",
    meaningTr: "Gizli ve açık geçmiş gelecek her şeyi en ince detaylarına kadar bilen",
    latinAliases: ["alim"],
  },
  {
    id: "kayyum",
    canonicalArabic: "قيوم",
    definiteArabic: "القيوم",
    displayNameTr: "Kayyum",
    meaningTr: "Varlığı ve bekası kendi zâtından olan.” “Zeval bulmayıp devamlı kaim olan.” “Her şeyi ayakta tutan, varlıklarını devam ettiren",
    latinAliases: ["kayyum"],
  },
  {
    id: "afuv",
    canonicalArabic: "عفو",
    definiteArabic: "العفو",
    displayNameTr: "Afuv",
    meaningTr: "Hiçbir günah ve kabahatten eser bırakmayan, silip süpüren, kolaylıkla affeden, kullarının günahlarını silen, cezaları kaldıran, çok affedici",
    latinAliases: ["afuv"],
  },
  {
    id: "mani",
    canonicalArabic: "مانع",
    definiteArabic: "المانع",
    displayNameTr: "Mani",
    meaningTr: "Allah'ın hem dünyada hem de ahirette kullarını koruyup gözetmesi, haksızlığa ve fitneye engel olması",
    latinAliases: ["mani"],
  },
  {
    id: "kuddus",
    canonicalArabic: "قدوس",
    definiteArabic: "القدوس",
    displayNameTr: "Kuddus",
    meaningTr: "Tertemiz, pak, kusurdan arınmış, her türlü çirkinlik, noksanlık ve ayıplardan uzak, tertemiz, bütün kemal sıfatları kendisinde toplayan, güzellik, iyilik ve faziletler le övülen",
    latinAliases: ["kuddus"],
  },
  {
    id: "semi",
    canonicalArabic: "سميع",
    definiteArabic: "السميع",
    displayNameTr: "Semi",
    meaningTr: "Gizli açık her şeyi hakkıyla işiten, her şeyi en iyi işiten, duaları kabul işiten ve duyan",
    latinAliases: ["semi"],
  },
  {
    id: "mukaddim",
    canonicalArabic: "مقدم",
    definiteArabic: "المقدم",
    displayNameTr: "Mukaddim",
    meaningTr: "Allah'ın (cc) istediğini öne aldığı, istediği kimseyi önde bulundurduğu, ileri getiren, öne çıkaran, üstün kılan",
    latinAliases: ["mukaddim"],
  },
  {
    id: "nafi",
    canonicalArabic: "نافع",
    definiteArabic: "النافع",
    displayNameTr: "Nafi",
    meaningTr: "Devamlı olarak fayda ve yarar sağlayan, mahlukata hayır ve faydalı şeyler yaratan",
    latinAliases: ["nafi"],
  },
  {
    id: "berr",
    canonicalArabic: "بر",
    definiteArabic: "البر",
    displayNameTr: "Berr",
    meaningTr: "İbadet eden ve kendisine yönelen kullarına rahmet eyleyen, onları ödüllendiren, kötülüklerden vazgeçen kullarını mükafatlandıran",
    latinAliases: ["berr"],
  },
  {
    id: "cebbar",
    canonicalArabic: "جبار",
    definiteArabic: "الجبار",
    displayNameTr: "Cebbar",
    meaningTr: "Dileğini yapan ve yaptıran, kırılanları onaran, noksanlıkları tamamlayan, dilediklerini yaptırmak için muktedir olan",
    latinAliases: ["cebbar"],
  },
  {
    id: "muksit",
    canonicalArabic: "مقسط",
    definiteArabic: "المقسط",
    displayNameTr: "Muksit",
    meaningTr: "Adalet sahibi; bütün işlerini denk, yerli yerinde ve birbirine uygun biçimde yapan",
    latinAliases: ["muksit"],
  },
  {
    id: "malikul-mulk",
    canonicalArabic: "مالك الملك",
    definiteArabic: "المالك الملك",
    displayNameTr: "Malikul Mülk",
    meaningTr: "Mülkün gerçek sahibi; bütün varlık aleminin tek hakimi",
    latinAliases: ["malikul mülk", "malikul-mulk"],
  },
  {
    id: "bari",
    canonicalArabic: "باری",
    definiteArabic: "الباری",
    displayNameTr: "Bari",
    meaningTr: "Her şeyi kusursuz ve uyumlu yaratan, bir örneği ve maddesi olmaksızın yaratan; evrenin bütün parçalarını âhenkli ve düzenli olarak meydana getiren",
    latinAliases: ["bari"],
  },
  {
    id: "kebir",
    canonicalArabic: "كبير",
    definiteArabic: "الكبير",
    displayNameTr: "Kebir",
    meaningTr: "ilmiyle her şeyi sayan,büyük veya küçük hiçbir şey gözünden kaçmayan.Cenabı Allah'ın İlmi ve ihatası sonsuzdur.",
    latinAliases: ["kebir"],
  },
  {
    id: "nur",
    canonicalArabic: "نور",
    definiteArabic: "النور",
    displayNameTr: "Nur",
    meaningTr: "Gönüllere iman ve nur veren, kullarını doğru yola ileten, hidayete erdiren",
    latinAliases: ["nur"],
  },
  {
    id: "rahim",
    canonicalArabic: "رحيم",
    definiteArabic: "الرحيم",
    displayNameTr: "Er-Rahîm",
    meaningTr: "Kullarının hatalarını kusurlarını günahlarını esirgeyip bağışlayan, merhamet sahibi olan",
    latinAliases: ["rahim", "rahîm", "er-rahim", "er-rahîm"],
  },
  {
    id: "kerim",
    canonicalArabic: "كریم",
    definiteArabic: "الكریم",
    displayNameTr: "Kerim",
    meaningTr: "Lütuf ve ihsânı bol. Allah vaad ettiği zaman sözünü yerine getirir, verdiği zaman son derece bol verir, karşılıksız verir",
    latinAliases: ["kerim"],
  },
  {
    id: "rauf",
    canonicalArabic: "راوف",
    definiteArabic: "الراوف",
    displayNameTr: "Rauf",
    meaningTr: "Kullarına acıyan çok esirgeyen, çok şefkat ve merhamet gösteren",
    latinAliases: ["rauf"],
  },
  {
    id: "rahman",
    canonicalArabic: "رحمن",
    definiteArabic: "الرحمن",
    displayNameTr: "Er-Rahmân",
    meaningTr: "Tüm canlıları affeden ve tüm canlılara merhamet eden",
    latinAliases: ["rahman", "rahmân", "er-rahman", "er-rahmân"],
  },
  {
    id: "sabur",
    canonicalArabic: "صبور",
    definiteArabic: "الصبور",
    displayNameTr: "Sabur",
    meaningTr: "Allah Teâlâ, günahkârları cezalandırma konusunda acele etmeyip lütfuyla bağışlayan ve erteleyendir.",
    latinAliases: ["sabur"],
  },
  {
    id: "basir",
    canonicalArabic: "بصير",
    definiteArabic: "البصير",
    displayNameTr: "Basir",
    meaningTr: "Tüm evrendeki saklanmış veya gizlenmiş olan her şeyi gören",
    latinAliases: ["basir"],
  },
  {
    id: "kadir",
    canonicalArabic: "قادر",
    definiteArabic: "القادر",
    displayNameTr: "Kadir",
    meaningTr: "Her şeye gücü yeten, her istediğini, istediği gibi sonsuz bir güç ve kudretle yapan, sonsuz kudret sahibi olan demektir.",
    latinAliases: ["kadir"],
  },
  {
    id: "kahhar",
    canonicalArabic: "قهار",
    definiteArabic: "القهار",
    displayNameTr: "Kahhar",
    meaningTr: "Düşmanları şiddetli bir şekilde kahrederek, zalimleri yerle bir eden, mutlak galip gelen, her zaman mağlup etmeye ve galip gelmeye hazır olan",
    latinAliases: ["kahhar"],
  },
  {
    id: "rezzak",
    canonicalArabic: "رزاق",
    definiteArabic: "الرزاق",
    displayNameTr: "Rezzak",
    meaningTr: "Tüm varlıkların ihtiyacını karşılayan, dilediğine bol bol rızk veren; rızka muhtaç olan bütün mahlûkata rızkını veren",
    latinAliases: ["rezzak"],
  },
  {
    id: "rakib",
    canonicalArabic: "رقيب",
    definiteArabic: "الرقيب",
    displayNameTr: "Rakib",
    meaningTr: "Her varlığı ve her işi her an görüp, gözeten ve kontrolü altında tutan",
    latinAliases: ["rakib"],
  },
  {
    id: "sehid",
    canonicalArabic: "شهيد",
    definiteArabic: "الشهيد",
    displayNameTr: "Şehid",
    meaningTr: "Her zaman, her yerde hazır olan; her şeye şâhit olan; kendisine hiçbir şey gizli olmayan",
    latinAliases: ["şehid", "sehid"],
  },
  {
    id: "musavvir",
    canonicalArabic: "مصور",
    definiteArabic: "المصور",
    displayNameTr: "Musavvir",
    meaningTr: "Her şeye şekli veren, ayrı bir şekil vererek tasvir eden ve yarattığı varlıklara suret veren",
    latinAliases: ["musavvir"],
  },
  {
    id: "rafi",
    canonicalArabic: "رافع",
    definiteArabic: "الرافع",
    displayNameTr: "Rafi",
    meaningTr: "Dilediğini yücelten, yukarı kaldıran, zilletten izzete çıkaran, makam ve mertebelerini yükselten, dereceleri artıran",
    latinAliases: ["rafi"],
  },
  {
    id: "tevvab",
    canonicalArabic: "تواب",
    definiteArabic: "التواب",
    displayNameTr: "Tevvab",
    meaningTr: "Kulların dönüşlerini kabul eden, tövbeleri kabul eden, günahları bağışlayan ve cezadan vaz geçen",
    latinAliases: ["tevvab"],
  },
  {
    id: "fettah",
    canonicalArabic: "فتاح",
    definiteArabic: "الفتاح",
    displayNameTr: "Fettah",
    meaningTr: "Fetheden ve dilediği her kapıyı açan yaratıcı olan, kolaylaştıran",
    latinAliases: ["fettah"],
  },
  {
    id: "mumit",
    canonicalArabic: "مميت",
    definiteArabic: "المميت",
    displayNameTr: "Mumit",
    meaningTr: "Öldüren, can alan, ölümü yaratan. Ölümü tattıran, dönüştüren ",
    latinAliases: ["mumit"],
  },
  {
    id: "metin",
    canonicalArabic: "متين",
    definiteArabic: "المتين",
    displayNameTr: "Metin",
    meaningTr: "Sonsuz kudrete sahip; son derece güçlü, kuvvetli; dayanıklı, sağlam",
    latinAliases: ["metin"],
  },
  {
    id: "resid",
    canonicalArabic: "رشيد",
    definiteArabic: "الرشيد",
    displayNameTr: "Reşid",
    meaningTr: "Allahu Tealanın kullarını mutluluğa ve huzura ulaştıran onların iyilikle kötülüğü ayırt etmelerini sağlayan olduğu anlamına gelmektedir.",
    latinAliases: ["reşid", "resid"],
  },
  {
    id: "sekur",
    canonicalArabic: "شكور",
    definiteArabic: "الشكور",
    displayNameTr: "Şekur",
    meaningTr: "Az da olsa kulun iyi bir ameline fazlasıyla karşılık veren. O, az iyiliğe çok ödül veren, verdiği ödülü de katbekat arttırandır.",
    latinAliases: ["şekur", "sekur"],
  },
  {
    id: "mukit",
    canonicalArabic: "مقيت",
    definiteArabic: "المقيت",
    displayNameTr: "mukit",
    meaningTr: "Her yaratılmışın rızkını gıdasını veren, tayin eden",
    latinAliases: ["mukit"],
  },
  {
    id: "mutaali",
    canonicalArabic: "متعالی",
    definiteArabic: "المتعالی",
    displayNameTr: "Mütaali",
    meaningTr: "En yüce olan, izzet, şeref ve hükümranlık bakımından en yüce ve bilinenlerin en üstünü; sonsuz ve sınırsız",
    latinAliases: ["mütaali", "mutaali"],
  },
  {
    id: "bais",
    canonicalArabic: "باعث",
    definiteArabic: "الباعث",
    displayNameTr: "Bais",
    meaningTr: "Kıyametten sonra ölüleri tekrar dirilten, peygamber gönderen; ölü kalpleri hidayetle dirilten O'dur",
    latinAliases: ["bais"],
  },
  {
    id: "muntakim",
    canonicalArabic: "منتقم",
    definiteArabic: "المنتقم",
    displayNameTr: "Müntakim",
    meaningTr: "Dilediğine ceza vermede şiddetli davranan,suçlulara müstehak oldukları cezaya çarptıran",
    latinAliases: ["müntakim", "muntakim"],
  },
  {
    id: "mutekebbir",
    canonicalArabic: "متكبر",
    definiteArabic: "المتكبر",
    displayNameTr: "Mütekebbir",
    meaningTr: "Zâtının ve sıfatlarının mahiyeti bilinemeyecek kadar ulu",
    latinAliases: ["mütekebbir", "mutekebbir"],
  },
  {
    id: "varis",
    canonicalArabic: "لوارث",
    definiteArabic: "اللوارث",
    displayNameTr: "Varis",
    meaningTr: "Mülkün gerçek sahibi olan, mevcut olan her şeyin mutlak sahibi ve hakiki maliki, ölümsüz, daim ve kalıcı olan",
    latinAliases: ["varis"],
  },
  {
    id: "halik",
    canonicalArabic: "خالق",
    definiteArabic: "الخالق",
    displayNameTr: "Halik",
    meaningTr: "Her şeyi yoktan var eden,yaratan. Her şeyin varlığını ve yaşadığı sürece geçireceği halleri,olayları önceden tesbit edip ona göre ortaya çıkaran",
    latinAliases: ["halik"],
  },
  {
    id: "muktedir",
    canonicalArabic: "مقتدر",
    definiteArabic: "المقتدر",
    displayNameTr: "Muktedir",
    meaningTr: "Tam bir kudret sahibi; her şeye gücü yeten",
    latinAliases: ["muktedir"],
  },
  {
    id: "muzill",
    canonicalArabic: "مذل",
    definiteArabic: "المذل",
    displayNameTr: "Muzill",
    meaningTr: "İstediğini zillete düşürme gücüne sahip yaratıcı",
    latinAliases: ["muzill"],
  },
  {
    id: "ahir",
    canonicalArabic: "اخر",
    definiteArabic: "الاخر",
    displayNameTr: "Ahir",
    meaningTr: "Ezelî ve ebedi olan, varlığının başı ya da sonu olmayan, baki olan",
    latinAliases: ["ahir"],
  },
  {
    id: "habir",
    canonicalArabic: "خبير",
    definiteArabic: "الخبير",
    displayNameTr: "Habir",
    meaningTr: "Herkesten haberdar olan ve her şeyin iç yüzünü bilen",
    latinAliases: ["habir"],
  },
  {
    id: "muahhir",
    canonicalArabic: "موخر",
    definiteArabic: "الموخر",
    displayNameTr: "Muahhir",
    meaningTr: "İstediğini geride bırakan, unutturan, gözden düşüren",
    latinAliases: ["muahhir"],
  },
  {
    id: "kabid",
    canonicalArabic: "قابض",
    definiteArabic: "القابض",
    displayNameTr: "Kabıd",
    meaningTr: "Kabzeden, tutan, daraltan, sıkan, zorlaştıran, rızkı kesen, kullarını yoklukla ve fakirlikle sınayan",
    latinAliases: ["kabıd", "kabid"],
  },
  {
    id: "hafid",
    canonicalArabic: "خافض",
    definiteArabic: "الخافض",
    displayNameTr: "Hafid",
    meaningTr: "Kafirleri, zülüm edenleri, münafıkları alçaltıp zillete düşüren",
    latinAliases: ["hafid"],
  },
  {
    id: "darr",
    canonicalArabic: "ضار",
    definiteArabic: "الضار",
    displayNameTr: "Darr",
    meaningTr: "Darlığa uğratanlara darlık veren, musibetler veren ve kötülükleri cezalandıran",
    latinAliases: ["darr"],
  },
  {
    id: "azim",
    canonicalArabic: "عظيم",
    definiteArabic: "العظيم",
    displayNameTr: "Azim",
    meaningTr: "Büyük olan, yüce olan, azametli",
    latinAliases: ["azim"],
  },
  {
    id: "gani",
    canonicalArabic: "غني",
    definiteArabic: "الغني",
    displayNameTr: "Gani",
    meaningTr: "Zatı ile zengin olan, hiçbir şeye ihtiyacı olmayan, zatı ile zengin olan, gerçek manada zengin olan",
    latinAliases: ["gani"],
  },
  {
    id: "zul-celali-vel-i-kram",
    canonicalArabic: "ذو  الجلال و الإكرام",
    definiteArabic: "الذو  الجلال و الإكرام",
    displayNameTr: "Zul Celali vel İkram",
    meaningTr: "Azamet sahibi, büyük, yüce ve her türlü noksandan münezzeh olan",
    latinAliases: ["zul celali vel i̇kram", "zul-celali-vel-i-kram"],
  },
  {
    id: "mugni",
    canonicalArabic: "مغني",
    definiteArabic: "المغني",
    displayNameTr: "Muğni",
    meaningTr: "Zenginlik veren gerçek zenginlik sahibi olan, ilediği kulunun tüm ihtiyaçlarını karşılayan",
    latinAliases: ["muğni", "mugni"],
  },
  {
    id: "zahir",
    canonicalArabic: "ظاهر",
    definiteArabic: "الظاهر",
    displayNameTr: "Zahir",
    meaningTr: "Varlığının apaçık delilleri ile aşikar olduğu",
    latinAliases: ["zahir"],
  },
  {
    id: "gaffar",
    canonicalArabic: "غفار",
    definiteArabic: "الغفار",
    displayNameTr: "Gaffar",
    meaningTr: "Çok merhamet eden, af dileyenleri affeden, suçluları bağışlayan, çirkinlikleri örten ve ayıpları gizli tutan",
    latinAliases: ["gaffar"],
  },
  {
    id: "gafur",
    canonicalArabic: "غفور",
    definiteArabic: "الغفور",
    displayNameTr: "Gafur",
    meaningTr: "Kulların günahlarını örten ve onları cezalandırmayan ve bağışı bol",
    latinAliases: ["gafur"],
  },
  {
    id: "hafiz",
    canonicalArabic: "حفيظ",
    definiteArabic: "الحفيظ",
    displayNameTr: "Hafiz",
    meaningTr: "Kâinatta zerre kadar bir şey bile gözetiminden uzak olmayan, koruyup kollayan ve gözeten ve tabiatı dengede tutan",
    latinAliases: ["hafiz"],
  },
]);

/**
 * @param {{ id: string, canonicalArabic: string, definiteArabic: string, displayNameTr: string, meaningTr: string|null, latinAliases: string[] }} seed
 * @returns {VerifiedEsmaAbjadEntry}
 */
function buildVerifiedEsmaEntry(seed) {
  const bare = calculateAbjad(seed.canonicalArabic, ABJAD_KABIR_CLASSICAL_V1);
  const definite = calculateAbjad(seed.definiteArabic, ABJAD_KABIR_CLASSICAL_V1);
  if (!bare.ok || !definite.ok) {
    throw new Error(
      `ESMA_ABJAD_SEED_INVALID:${seed.id}:bare=${bare.errorCode ?? 'ok'}:def=${definite.errorCode ?? 'ok'}`,
    );
  }
  return Object.freeze({
    id: seed.id,
    canonicalArabic: seed.canonicalArabic,
    definiteArabic: seed.definiteArabic,
    displayNameTr: seed.displayNameTr,
    meaningTr: seed.meaningTr ?? null,
    bareValue: bare.total,
    definiteValue: definite.total,
    calculationMethod: ABJAD_KABIR_CLASSICAL_V1,
    letterBreakdown: Object.freeze(bare.letters.map((l) => Object.freeze({ ...l }))),
    definiteLetterBreakdown: Object.freeze(definite.letters.map((l) => Object.freeze({ ...l }))),
    latinAliases: Object.freeze([...seed.latinAliases]),
  });
}

/** @type {readonly VerifiedEsmaAbjadEntry[]} */
export const ESMA_ABJAD_CATALOG = Object.freeze(ESMA_ABJAD_SEEDS.map(buildVerifiedEsmaEntry));

export const ESMA_ABJAD_CATALOG_VERSION = 'esma-abjad-verified-v2';
export const ESMA_ABJAD_CATALOG_SOURCE = 'server/symbolic-analysis/data/esma-abjad-catalog.js';

/**
 * @param {string} query
 * @returns {VerifiedEsmaAbjadEntry|null}
 */
export function lookupEsmaAbjadEntry(query) {
  const raw = String(query || '').trim();
  if (!raw) return null;
  const lower = raw.toLocaleLowerCase('tr-TR');
  for (const entry of ESMA_ABJAD_CATALOG) {
    if (entry.canonicalArabic === raw || entry.definiteArabic === raw) return entry;
    if (entry.id === lower) return entry;
    if (entry.displayNameTr.toLocaleLowerCase('tr-TR') === lower) return entry;
    if (entry.latinAliases.some((a) => a.toLocaleLowerCase('tr-TR') === lower)) return entry;
  }
  return null;
}
