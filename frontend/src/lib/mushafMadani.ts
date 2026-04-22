/**
 * Madani mushaf paging (604 pages) — data from hamzakat/madani-muhsaf-json (MIT).
 * Loaded from jsDelivr; aligns with standard Madina mushaf page breaks (not Indo-Pak 15-line).
 * https://github.com/hamzakat/madani-muhsaf-json
 */

export const MUSHAF_MADANI_URL =
  "https://cdn.jsdelivr.net/gh/hamzakat/madani-muhsaf-json@main/madani-muhsaf.json";

export type MushafVerseLine = { verseNumber: string; text: string };
export type MushafSurahSection = {
  chapterNumber: string;
  titleEn: string;
  titleAr: string;
  verseCount: number;
  text: MushafVerseLine[];
};

export type MushafPageRaw = {
  juzNumber?: number;
  [chapterKey: string]: MushafSurahSection | number | undefined;
};

export type FlatVerseLine = {
  surah: number;
  verseNumber: string;
  text: string;
};

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function toArabicIndicNum(n: number): string {
  return String(n)
    .split("")
    .map((d) => AR_DIGITS[parseInt(d, 10)] ?? d)
    .join("");
}

let cache: MushafPageRaw[] | null = null;

export async function loadMadaniMushaf(): Promise<MushafPageRaw[]> {
  if (cache) return cache;
  const res = await fetch(MUSHAF_MADANI_URL);
  if (!res.ok) throw new Error("Failed to load mushaf data");
  const data = (await res.json()) as MushafPageRaw[];
  cache = data;
  return data;
}

export function flattenPage(page: MushafPageRaw | undefined): FlatVerseLine[] {
  if (!page) return [];
  const keys = Object.keys(page)
    .filter((k) => k !== "juzNumber")
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  const out: FlatVerseLine[] = [];
  for (const k of keys) {
    const sec = page[String(k)] as MushafSurahSection | undefined;
    if (!sec?.text) continue;
    for (const row of sec.text) {
      out.push({ surah: k, verseNumber: row.verseNumber, text: row.text });
    }
  }
  return out;
}

export function primarySurahOnPage(page: MushafPageRaw | undefined): MushafSurahSection | null {
  if (!page) return null;
  const keys = Object.keys(page)
    .filter((k) => k !== "juzNumber")
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (!keys.length) return null;
  return page[String(keys[0])] as MushafSurahSection;
}

/** First mushaf page (1–604) where surah:ayah appears. */
export function findPageForVerse(pages: MushafPageRaw[], surah: number, ayah: number): number {
  for (let p = 1; p <= 604; p++) {
    const page = pages[p];
    if (!page) continue;
    const sec = page[String(surah)] as MushafSurahSection | undefined;
    if (!sec?.text) continue;
    if (sec.text.some((v) => parseInt(v.verseNumber, 10) === ayah)) return p;
  }
  return 1;
}

export function catchwordFromPage(pages: MushafPageRaw[], pageNum: number): string {
  if (pageNum < 1 || pageNum >= 604) return "";
  const next = flattenPage(pages[pageNum + 1]);
  const t = next[0]?.text?.trim() ?? "";
  if (!t) return "";
  const first = t.split(/\s+/).filter(Boolean)[0] ?? t;
  return first.length > 18 ? first.slice(0, 16) + "…" : first;
}

export const mushafMadaniAttribution = {
  name: "madani-muhsaf-json",
  author: "Hamza (hamzakat)",
  license: "MIT",
  url: "https://github.com/hamzakat/madani-muhsaf-json",
};
