/** Plain Arabic + fuzzy word match (same rules as pronunciation practice). */

export type WordStatus = "correct" | "error";

export interface WordAnalysis {
  text: string;
  status: WordStatus;
  feedback?: string;
  heard?: string;
  missedIndices?: number[];
}

export interface AnalysisResult {
  verse: string;
  words: WordAnalysis[];
  overallScore: number;
}

export const toPlainArabic = (s: string) =>
  (s || "")
    .replace(/\u0671/g, "\u0627")
    .replace(/[\u064B-\u0652\u0640\u0670]/g, "")
    .trim();

/** Strip invisible / decorative marks that often differ between mushaf font and speech-to-text. */
function stripCompareNoise(s: string): string {
  return (s || "")
    .replace(/[\u200c\u200d\u200e\u200f\uFEFF]/g, "")
    .replace(/[\uFD3E\uFD3F]/g, "") // ornate parentheses (Quran typography)
    .replace(/\u06DD/g, ""); // end of ayah symbol in some editions
}

export function normalizeArabicForCompare(s: string): string {
  return toPlainArabic(stripCompareNoise(s))
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .trim();
}

/** Character-level similarity between two Arabic tokens (same threshold family as `analyzeRecitation`). */
export function wordSimilarityAr(a: string, b: string, opts?: { boostBelow?: number }): number {
  const s1 = normalizeArabicForCompare(a);
  const s2 = normalizeArabicForCompare(b);
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  const dp: number[][] = Array.from({ length: s1.length + 1 }, () => Array(s2.length + 1).fill(0));
  for (let i = 0; i <= s1.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= s2.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  const dist = dp[s1.length]![s2.length]!;
  const maxLen = Math.max(s1.length, s2.length);
  let score = maxLen === 0 ? 1 : 1 - dist / maxLen;
  const boostBelow = opts?.boostBelow ?? 0.85;
  if (score < boostBelow && s1.length && s2.length) {
    const big = s1.length >= s2.length ? s1 : s2;
    const small = s1.length >= s2.length ? s2 : s1;
    if (big.includes(small) && small.length >= 1) {
      const ratio = small.length / big.length;
      if (ratio >= 0.35 || small.length === 1) score = Math.max(score, 0.92);
    }
  }
  return score;
}

function tokenizeWordsForLive(s: string): string[] {
  const cleaned = stripCompareNoise(toPlainArabic(s));
  return cleaned
    .split(/[\s\u00a0\u2009]+/)
    .filter(Boolean)
    .map((w) => normalizeArabicForCompare(w));
}

export type LiveWordStatus = "pending" | "correct" | "error";

/** Looser than lesson scoring: STT splits words differently than the mushaf. */
const LIVE_WORD_MATCH = 0.78;
const LIVE_WORD_SOFT = 0.52;
const LIVE_BOOST = 0.76;

/**
 * Maps each reference word (in order) to green / red / pending while the learner is speaking.
 * Uses greedy alignment with lookahead so browser STT can merge/split words vs the mushaf without everything turning red.
 */
export function liveOrderedWordStatuses(referencePlain: string, recognizedRaw: string): LiveWordStatus[] {
  const refWords = tokenizeWordsForLive(referencePlain);
  const recWords = tokenizeWordsForLive(recognizedRaw);
  const nRef = refWords.length;
  const out: LiveWordStatus[] = Array.from({ length: nRef }, () => "pending");
  if (nRef === 0) return out;

  let i = 0;
  let j = 0;
  while (i < nRef) {
    if (j >= recWords.length) {
      out[i] = "pending";
      i += 1;
      continue;
    }
    const rw = refWords[i]!;

    // Two mushaf words sometimes returned as one STT token
    if (i + 1 < nRef) {
      const pair = rw + refWords[i + 1]!;
      const scPair = wordSimilarityAr(pair, recWords[j]!, { boostBelow: LIVE_BOOST });
      if (scPair >= LIVE_WORD_MATCH) {
        out[i] = "correct";
        out[i + 1] = "correct";
        i += 2;
        j += 1;
        continue;
      }
    }

    let bestScore = -1;
    let bestDj = 1;
    for (let k = 0; k <= 2 && j + k < recWords.length; k++) {
      const sc = wordSimilarityAr(rw, recWords[j + k]!, { boostBelow: LIVE_BOOST });
      if (sc > bestScore) {
        bestScore = sc;
        bestDj = k + 1;
      }
    }
    if (j + 1 < recWords.length) {
      const scM = wordSimilarityAr(rw, recWords[j]! + recWords[j + 1]!, { boostBelow: LIVE_BOOST });
      if (scM > bestScore) {
        bestScore = scM;
        bestDj = 2;
      }
    }

    if (bestScore >= LIVE_WORD_MATCH) {
      out[i] = "correct";
      j += bestDj;
    } else if (bestScore >= LIVE_WORD_SOFT) {
      out[i] = "pending";
      j += 1;
    } else {
      out[i] = "error";
      j += 1;
    }
    i += 1;
  }

  return out;
}

export function analyzeRecitation(referenceNormalized: string, recognized: string): AnalysisResult {
  const refWords = referenceNormalized.split(" ").filter(Boolean).map((w) => normalizeArabicForCompare(w));
  const recWords = recognized.split(" ").filter(Boolean);

  const refFullNorm = refWords.join("");
  const recFullNorm = recWords.map(normalizeArabicForCompare).join("");

  const similarity = (a: string, b: string): number => {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const s1 = a;
    const s2 = b;
    const dp: number[][] = Array.from({ length: s1.length + 1 }, () => Array(s2.length + 1).fill(0));
    for (let i = 0; i <= s1.length; i++) dp[i]![0] = i;
    for (let j = 0; j <= s2.length; j++) dp[0]![j] = j;
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
      }
    }
    const dist = dp[s1.length]![s2.length]!;
    const maxLen = Math.max(s1.length, s2.length);
    return maxLen === 0 ? 1 : 1 - dist / maxLen;
  };

  const getMissedIndices = (refNorm: string, heardNorm: string): number[] => {
    const missed: number[] = [];
    const r = refNorm.split("");
    const h = heardNorm.split("");
    let ri = 0;
    let hi = 0;
    while (ri < r.length) {
      if (hi < h.length && r[ri] === h[hi]) {
        ri++;
        hi++;
      } else {
        missed.push(ri);
        ri++;
      }
    }
    return missed;
  };

  let correctCount = 0;

  const words: WordAnalysis[] = refWords.map((refWord) => {
    const normalizedRef = refWord.trim();
    if (!normalizedRef) {
      correctCount += 1;
      return { text: refWord, status: "correct" as WordStatus };
    }

    let bestScore = 0;
    let bestStart = -1;
    let bestLen = 0;
    const minLen = Math.max(1, normalizedRef.length - 2);
    const maxLen = Math.min(recFullNorm.length || 1, normalizedRef.length + 2);
    for (let start = 0; start < recFullNorm.length; start++) {
      for (let len = minLen; len <= maxLen && start + len <= recFullNorm.length; len++) {
        const sub = recFullNorm.slice(start, start + len);
        const score = similarity(normalizedRef, sub);
        if (score > bestScore) {
          bestScore = score;
          bestStart = start;
          bestLen = len;
        }
      }
    }

    if (bestScore < 0.85 && recFullNorm.length && normalizedRef.length) {
      const a = normalizedRef.length >= recFullNorm.length ? normalizedRef : recFullNorm;
      const b = normalizedRef.length >= recFullNorm.length ? recFullNorm : normalizedRef;
      if (a.includes(b) && b.length >= 1) {
        const ratio = b.length / a.length;
        if (ratio >= 0.35 || b.length === 1) bestScore = Math.max(bestScore, 0.92);
      }
    }

    const isCorrect = bestScore >= 0.85;

    if (isCorrect) {
      correctCount += 1;
      return { text: refWord, status: "correct" };
    }

    const heardNorm = bestStart >= 0 ? recFullNorm.slice(bestStart, bestStart + bestLen) : "";
    const missedIndices = heardNorm
      ? getMissedIndices(normalizedRef, heardNorm)
      : Array.from({ length: normalizedRef.length }, (_, i) => i);

    return {
      text: refWord,
      status: "error",
      heard: heardNorm || undefined,
      missedIndices: missedIndices.length > 0 ? missedIndices : undefined,
      feedback: heardNorm
        ? "Compare the letters above: expected vs what was heard. Practice this word slowly."
        : "This word was not clearly matched in your recitation. Repeat it slowly and focus on each letter.",
    };
  });

  const overallScore = refWords.length ? Math.round((correctCount / refWords.length) * 100) : 0;

  return {
    verse: referenceNormalized,
    words,
    overallScore,
  };
}
