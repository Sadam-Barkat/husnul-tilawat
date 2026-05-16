import { normalizeArabicForCompare, toPlainArabic, wordSimilarityAr } from "@/lib/arabicRecitationCompare";

export type LessonPracticeResult = {
  passed: boolean;
  score: string;
  similarity: number;
  spokenWord: string;
  expectedWord: string;
};

/** Pass threshold for lesson letter/word match (no AI — plain Arabic string compare). */
const PASS_SIMILARITY = 0.6;

/** Roman / Urdu-ish names Windows STT often returns instead of Arabic script. */
const ROMAN_ALIASES: Record<string, string[]> = {
  alif: ["alif", "alef", "alf", "aliph", "elif", "ali", "alaf"],
  ba: ["ba", "baa", "bay", "bey", "be", "bee"],
  ta: ["ta", "taa", "tay", "te", "tee"],
  tha: ["tha", "thaa", "sa", "saa", "thah"],
  jeem: ["jeem", "jim", "geem", "zeem", "jeem"],
  ha: ["ha", "haa", "heh", "he", "hah"],
  kha: ["kha", "khaa", "khe", "khah"],
  dal: ["dal", "daal", "dhal", "dul", "doll"],
  dhal: ["dhal", "dhaal", "zaal", "zal", "dhul"],
  ra: ["ra", "raa", "re", "rah"],
  zay: ["zay", "zain", "ze", "zee", "zey"],
  seen: ["seen", "sin", "sean", "seen"],
  sheen: ["sheen", "shin", "shein"],
  sad: ["sad", "saad", "swad", "sod"],
  dad: ["dad", "daad", "dod"],
  taa: ["taa", "tah", "to", "taw"],
  zah: ["zah", "zaa", "za", "dhah"],
  ain: ["ain", "ayin", "ein", "ayn", "in"],
  ghain: ["ghain", "ghayn", "ghain"],
  fa: ["fa", "faa", "fey", "fe"],
  qaf: ["qaf", "qaaf", "kaf", "qof"],
  kaf: ["kaf", "kaaf", "caf"],
  lam: ["lam", "laam", "lum", "lem"],
  meem: ["meem", "mim", "mem", "meem"],
  noon: ["noon", "nun", "noon", "non"],
  waw: ["waw", "wao", "vav", "wow"],
  ya: ["ya", "yaa", "yay", "ye", "yeh"],
};

function latinKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function blobHasAlias(blob: string, aliases: string[]): boolean {
  const b = blob.toLowerCase();
  return aliases.some((a) => {
    if (a.length <= 2) return new RegExp(`\\b${a}\\b`, "i").test(b) || b === a;
    return b.includes(a);
  });
}

/**
 * When the mic returns Latin ("ba", "jeem") map to the lesson's plain Arabic for comparison.
 */
function mapRomanSpokenToArabic(spoken: string, latinName: string, expectedPlain: string): string {
  if (/[\u0600-\u06FF]/.test(spoken)) return spoken;

  const blob = spoken.toLowerCase().replace(/[^\w\s\u0600-\u06FF]/g, " ");
  const key = latinKey(latinName);
  const aliases = ROMAN_ALIASES[key] || [key];

  if (key && blobHasAlias(blob, aliases)) {
    return expectedPlain;
  }

  // Any token in transcript that matches a known letter alias → use expected plain.
  const tokens = blob.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const tk = t.replace(/[^a-z]/g, "");
    for (const [letter, list] of Object.entries(ROMAN_ALIASES)) {
      if (list.some((a) => a === tk || tk.includes(a) || a.includes(tk))) {
        if (letter === key) return expectedPlain;
      }
    }
  }

  return spoken;
}

export function getLessonExpectedPlain(lesson: {
  arabicTextForComparison?: string;
  arabicText?: string;
  title?: string;
}): string {
  const stored = (lesson.arabicTextForComparison || "").trim();
  if (stored) return stored;
  return toPlainArabic((lesson.arabicText || lesson.title || "").trim());
}

/** Compare browser speech transcript to lesson plain Arabic (both normalized, no harakat). */
export function compareLessonPractice(
  spoken: string,
  expectedPlain: string,
  latinLessonName?: string,
): LessonPracticeResult {
  const mapped = latinLessonName
    ? mapRomanSpokenToArabic(spoken, latinLessonName, expectedPlain)
    : spoken;

  const spokenNorm = normalizeArabicForCompare(mapped);
  const expectedNorm = normalizeArabicForCompare(expectedPlain);
  const similarity = wordSimilarityAr(spokenNorm, expectedNorm);
  const passed = similarity >= PASS_SIMILARITY;
  return {
    passed,
    score: passed ? "1/1" : "0/1",
    similarity: Math.round(similarity * 100),
    spokenWord: spokenNorm || spoken.trim(),
    expectedWord: expectedNorm || expectedPlain.trim(),
  };
}
