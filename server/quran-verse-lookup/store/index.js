/** Live verified Quran source adapter. No offline corpus is retained. */
import { isQuranVerseTextEnabled } from '../retrieve.js';

const DEFAULT_BASE_URL = 'https://api.acikkuran.com';
export const DEFAULT_TRANSLATION_SOURCE_LABEL = 'Açık Kur’an API';
export const FIXTURE_TRANSLATION_SOURCE_LABEL = 'test-fixture-canonical';

/**
 * Small, clearly-labeled dev/test-only dataset. Never used in production
 * (see createVerseStore's forceFixture guard below) and never presented as
 * a verified live source — translationSource always reads
 * FIXTURE_TRANSLATION_SOURCE_LABEL so callers can tell it apart from
 * DEFAULT_TRANSLATION_SOURCE_LABEL.
 */
const FIXTURE_VERSES = Object.freeze({
  '1:1': {
    arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    translation: 'Rahmân ve Rahîm olan Allah’ın adıyla.',
  },
  '2:255': {
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
    translation: 'Allah, O’ndan başka ilah yoktur; diridir, kayyumdur.',
  },
  '8:8': {
    arabic: 'لِيُحِقَّ الْحَقَّ وَيُبْطِلَ الْبَاطِلَ وَلَوْ كَرِهَ الْمُجْرِمُونَ',
    translation:
      'Hakkı gerçekleştirmek ve batılı ortadan kaldırmak için (böyle yaptı); suçlular istemese de.',
  },
  '36:1': { arabic: 'يس', translation: 'Yâsîn.' },
  '112:1': { arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ', translation: 'De ki: O Allah birdir.' },
  '114:6': { arabic: 'مِنَ الْجِنَّةِ وَالنَّاسِ', translation: 'cinlerden ve insanlardan.' },
});

/**
 * Synchronous dev/test-only store — reachable only through
 * createVerseStore({ forceFixture: true }), which itself refuses to hand
 * one out in production (throws instead of silently falling back).
 */
export function createFixtureVerseStore() {
  return {
    __fixture: true,
    getVerse(verseKey) {
      const row = FIXTURE_VERSES[String(verseKey || '')];
      if (!row) return null;
      return {
        arabic: row.arabic,
        translation: row.translation,
        translationSource: FIXTURE_TRANSLATION_SOURCE_LABEL,
      };
    },
  };
}

function baseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
}

function translationFrom(row) {
  const value = row?.translation ?? row?.meal;
  if (typeof value === 'string' && value.trim()) return { text: value.trim(), author: null };
  if (value && typeof value.text === 'string' && value.text.trim()) {
    return { text: value.text.trim(), author: value.author?.name || value.author_name || null };
  }
  return null;
}

/** Returns only Arabic text plus an attributed Turkish translation. */
export function createRemoteVerseStore(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;
  const apiBase = baseUrl(options.baseUrl);
  const request = (url) => fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ATLAS-Quran-Lookup/1.0' },
  });
  return {
    async getVerse(verseKey) {
      const ref = /^(\d{1,3}):(\d{1,3})$/.exec(String(verseKey || ''));
      if (!ref) return null;
      const endpoint = `${apiBase}/surah/${ref[1]}/verse/${ref[2]}`;
      const response = await request(endpoint);
      if (!response?.ok) return null;
      const row = (await response.json())?.data;
      const arabic = typeof row?.verse === 'string' ? row.verse.trim() : null;
      let translation = translationFrom(row);
      if (!translation) {
        const translations = await request(`${endpoint}/translations`);
        if (!translations?.ok) return null;
        const values = (await translations.json())?.data;
        const candidate = Array.isArray(values)
          ? values.find((item) => item?.author?.language === 'tr' && typeof item?.text === 'string')
          : null;
        if (candidate) translation = { text: candidate.text.trim(), author: candidate.author?.name || null };
      }
      if (!arabic || !translation?.text) return null;
      return {
        arabic,
        translation: translation.text,
        translationSource: translation.author
          ? `${DEFAULT_TRANSLATION_SOURCE_LABEL} — ${translation.author}`
          : DEFAULT_TRANSLATION_SOURCE_LABEL,
      };
    },
  };
}

/**
 * A fixture is dev/test-only; production always uses the live source (or
 * no source at all, fail-closed, until QURAN_VERSE_TEXT_ENABLED=true).
 */
export function createVerseStore(options = {}) {
  const env = options.env || process.env;
  const nodeEnv = options.nodeEnv || env.NODE_ENV || process.env.NODE_ENV || 'development';

  if (options.forceFixture) {
    if (nodeEnv === 'production') {
      throw new Error('createVerseStore: forceFixture is forbidden in production');
    }
    return createFixtureVerseStore();
  }

  // Fail-closed by default: verse text (and therefore the live network
  // adapter) stays off until an operator explicitly opts in.
  const textEnabled = options.textEnabled ?? isQuranVerseTextEnabled(env);
  if (!textEnabled) return null;
  if (options.storeMode === 'off' || env.QURAN_VERSE_STORE === 'off') return null;

  return createRemoteVerseStore({ baseUrl: options.baseUrl || env.QURAN_VERSE_API_BASE_URL, fetchImpl: options.fetchImpl });
}

export function composeVerseStore(primary, secondary) {
  if (!primary) return secondary || null;
  if (!secondary) return primary;
  return { async getVerse(key) { return (await primary.getVerse(key)) ?? secondary.getVerse(key); } };
}

export function loadQuranStoreConfig(env = process.env) {
  return {
    baseUrl: baseUrl(env.QURAN_VERSE_API_BASE_URL),
    storeMode: env.QURAN_VERSE_STORE || 'remote',
    textEnabled: isQuranVerseTextEnabled(env),
  };
}
