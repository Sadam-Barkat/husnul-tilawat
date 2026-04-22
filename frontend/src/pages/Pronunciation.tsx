import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams, Link } from "react-router-dom";
import { Mic, MicOff, Volume2, RefreshCw, CheckCircle, XCircle, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";

// Minimal browser type declarations for Web Speech API
// (avoids TS errors without adding external type packages)
type SpeechRecognition = any;
type SpeechRecognitionEvent = any;

// Reference verse used for practice & comparison (without dummy per-word data)
// This will be overridden by the selected practice phrase text.
const DEFAULT_REFERENCE_VERSE = "بسم الله الرحمن الرحيم";

// Plain letters only (match backend toPlainArabic): no zabar, zair, pesh, ٰ; ٱ → ا
const toPlainArabic = (s: string) =>
  (s || "")
    .replace(/\u0671/g, "\u0627")
    .replace(/[\u064B-\u0652\u0640\u0670]/g, "")
    .trim();

/** Unify alef/hamza so STT "الف" matches DB "ألف" (أ/إ/آ/ٱ → ا) */
function normalizeArabicForCompare(s: string): string {
  return toPlainArabic(s)
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064a")
    .trim();
}

type WordStatus = "correct" | "error";

// For error words: show what was expected vs what was heard (STT)
interface WordAnalysis {
  text: string;
  status: WordStatus;
  feedback?: string;
  /** For errors: best-matching word from STT (so we can show "Expected X, you said Y") */
  heard?: string;
  /** For errors: which reference characters were missing/wrong (indices in reference word) */
  missedIndices?: number[];
}

interface AnalysisResult {
  verse: string;
  words: WordAnalysis[];
  overallScore: number;
}

// Compare using reference already without harakat (textForComparison from DB) and recognized text.
// Recognized is stripped of harakat here (STT typically returns no harakat). No strip on reference.
// Match each reference word to the best substring in the full recognized text (no word-boundary limit).
function analyzeRecitation(referenceNormalized: string, recognized: string): AnalysisResult {
  const refWords = referenceNormalized.split(" ").filter(Boolean).map((w) => normalizeArabicForCompare(w));
  const recWords = recognized.split(" ").filter(Boolean);

  const refFullNorm = refWords.join("");
  const recFullNorm = recWords.map(normalizeArabicForCompare).join("");

  const similarity = (a: string, b: string): number => {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const s1 = a;
    const s2 = b;
    const dp: number[][] = Array.from({ length: s1.length + 1 }, () =>
      Array(s2.length + 1).fill(0)
    );
    for (let i = 0; i <= s1.length; i++) dp[i][0] = i;
    for (let j = 0; j <= s2.length; j++) dp[0][j] = j;
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    const dist = dp[s1.length][s2.length];
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

    // Find best matching substring in full recognized text (no word-boundary restriction)
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

    // STT often writes الف while lesson text is ألف — same 3 letters after hamza→alef.
    // Also: user may say only ا while target is ألف/الف — treat as match if one contains the other.
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
    const missedIndices = heardNorm ? getMissedIndices(normalizedRef, heardNorm) : Array.from({ length: normalizedRef.length }, (_, i) => i);

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

  const overallScore = refWords.length
    ? Math.round((correctCount / refWords.length) * 100)
    : 0;

  return {
    verse: referenceNormalized,
    words,
    overallScore,
  };
}

type LessonPractice = {
  _id: string;
  title: string;
  arabicText?: string;
  arabicTextForComparison?: string;
};

export default function Pronunciation() {
  const [searchParams] = useSearchParams();
  const lessonIdParam = searchParams.get("lessonId");

  const [isRecording, setIsRecording] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [phrases, setPhrases] = useState<{ _id: string; label: string; text: string; textForComparison?: string }[]>([]);
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>(null);
  const [lessonPractice, setLessonPractice] = useState<LessonPractice | null>(null);
  const [lessonPracticeError, setLessonPracticeError] = useState("");
  const [practicePassMessage, setPracticePassMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  /** Lesson mode: latest display line (finals + current interim) */
  const lessonSttBufferRef = useRef("");
  /** Finals survive recognizer restarts after Chrome "no-speech" (silence) */
  const lessonSttFinalsRef = useRef("");
  /** True while user wants recording; false right before stop() so onend won't auto-restart */
  const lessonRecordingActiveRef = useRef(false);
  /** Best non-empty transcript this session (fixes empty onresult + hasResult=true → no analysis UI) */
  const sttTranscriptRef = useRef("");
  const sttHardErrorRef = useRef(false);

  /** Optional OpenAI Whisper path (lessons & phrases): better Arabic text than browser STT for short letters. */
  const whisperStreamRef = useRef<MediaStream | null>(null);
  const whisperMrRef = useRef<MediaRecorder | null>(null);
  const whisperChunksRef = useRef<Blob[]>([]);
  const [isWhisperRecording, setIsWhisperRecording] = useState(false);
  const [whisperBusy, setWhisperBusy] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!lessonIdParam) {
      setLessonPractice(null);
      setLessonPracticeError("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get<LessonPractice>(`/api/lessons/${lessonIdParam}`, {
          headers: authHeaders,
        });
        if (!cancelled && data?._id) {
          setLessonPractice({
            _id: data._id,
            title: data.title,
            arabicText: data.arabicText || data.title,
            arabicTextForComparison: data.arabicTextForComparison,
          });
          setLessonPracticeError("");
        }
      } catch {
        if (!cancelled) {
          setLessonPractice(null);
          setLessonPracticeError("Could not load this lesson. Open it from Lessons → Practice Now.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonIdParam]);

  // Load practice phrases (once)
  useEffect(() => {
    const loadPhrases = async () => {
      try {
        const { data } = await axios.get<{ _id: string; label: string; text: string; textForComparison?: string }[]>("/api/practice-phrases");
        if (Array.isArray(data) && data.length > 0) {
          setPhrases(data);
          setSelectedPhraseId(data[0]._id);
        }
      } catch {
        /* ignore */
      }
    };
    loadPhrases();
  }, []);

  // STT: re-init when switching lesson practice vs phrases — short letters need continuous capture until stop
  useEffect(() => {
    const lessonMode = Boolean(lessonIdParam);
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      window.speechSynthesis?.resume?.();
    } catch {
      /* ignore */
    }

    const recognition: SpeechRecognition = new SpeechRecognitionCtor();
    recognition.lang = "ar-SA";

    if (lessonMode) {
      // Lessons: continuous capture + interim results, tuned for very short letters.
      // We treat the accumulated interim text as final when you stop.
      recognition.continuous = true;
      recognition.interimResults = true;
      lessonSttBufferRef.current = "";
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let line = "";
        const start = event.resultIndex ?? 0;
        for (let i = start; i < event.results.length; i++) {
          const res = event.results[i];
          line += res?.[0]?.transcript ?? "";
        }
        const transcript = (lessonSttBufferRef.current + line).trim();
        lessonSttBufferRef.current = transcript;
        if (transcript) {
          sttTranscriptRef.current = transcript;
          setRecognizedText(transcript);
          setHasResult(true);
          setError("");
        }
      };
      recognition.onend = () => {
        setIsRecording(false);
        lessonSttBufferRef.current = "";
        sttHardErrorRef.current = false;
      };
    } else {
      // Phrase practice: one-shot, auto-stop on silence.
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let line = "";
        const start = event.resultIndex ?? 0;
        for (let i = start; i < event.results.length; i++) {
          line += event.results[i]?.[0]?.transcript ?? "";
        }
        const transcript = line.trim();
        if (transcript) {
          sttTranscriptRef.current = transcript;
          setRecognizedText(transcript);
          setHasResult(true);
          setError("");
        }
      };
      recognition.onend = () => {
        setIsRecording(false);
        const t = sttTranscriptRef.current.trim();
        sttTranscriptRef.current = "";
        if (t) {
          setRecognizedText(t);
          setHasResult(true);
        } else if (!sttHardErrorRef.current) {
          setHasResult(false);
          setRecognizedText("");
          setError("No speech detected. Please try again and speak clearly.");
        }
        sttHardErrorRef.current = false;
      };
    }

    recognition.onerror = (ev: { error?: string }) => {
      const err = ev?.error;
      if (err === "no-speech") {
        sttTranscriptRef.current = "";
        if (lessonMode) {
          // In lesson practice, ignore this; we rely on the user tapping again to retry.
          return;
        }
        return;
      }
      if (err === "aborted") return;
      sttHardErrorRef.current = true;
      if (lessonMode && (err === "not-allowed" || err === "service-not-allowed")) {
        setError("Microphone access denied. Allow the mic for this site and try again.");
        lessonRecordingActiveRef.current = false;
        lessonSttBufferRef.current = "";
        lessonSttFinalsRef.current = "";
        setIsRecording(false);
        return;
      }
      setError("There was a problem capturing audio. Please try again.");
      if (lessonMode) {
        lessonRecordingActiveRef.current = false;
      }
      lessonSttBufferRef.current = "";
      lessonSttFinalsRef.current = "";
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      lessonRecordingActiveRef.current = false;
      try {
        recognition.abort?.();
      } catch {
        try {
          recognition.stop?.();
        } catch {
          /* ignore */
        }
      }
      recognitionRef.current = null;
    };
  }, [lessonIdParam]);

  const cleanupWhisperMedia = () => {
    whisperStreamRef.current?.getTracks().forEach((t) => t.stop());
    whisperStreamRef.current = null;
    whisperMrRef.current = null;
    whisperChunksRef.current = [];
  };

  useEffect(() => {
    return () => {
      cleanupWhisperMedia();
    };
  }, []);

  const toggleWhisperRecord = async () => {
    if (whisperBusy) return;
    if (!token) {
      setError("Log in to use Whisper transcription (server needs your account).");
      return;
    }
    if (isRecording) {
      setError("Stop the live browser mic first, then use Whisper.");
      return;
    }
    if (lessonIdParam) {
      if (lessonPracticeError) return;
      if (!lessonPractice) {
        setError("Wait for the lesson to load.");
        return;
      }
    }

    if (isWhisperRecording) {
      const mr = whisperMrRef.current;
      if (mr && mr.state === "recording") {
        try {
          mr.stop();
        } catch {
          setIsWhisperRecording(false);
          cleanupWhisperMedia();
        }
      }
      return;
    }

    setError("");
    setPracticePassMessage("");
    setHasResult(false);
    setRecognizedText("");
    setAnalysis(null);
    sttTranscriptRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      whisperStreamRef.current = stream;
      const mimePreferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
      );
      const mr = new MediaRecorder(stream, mimePreferred ? { mimeType: mimePreferred } : undefined);
      whisperMrRef.current = mr;
      whisperChunksRef.current = [];

      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) whisperChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const chunks = whisperChunksRef.current.slice();
        whisperChunksRef.current = [];
        cleanupWhisperMedia();
        setIsWhisperRecording(false);

        const blob = new Blob(chunks, { type: mr.mimeType || mimePreferred || "audio/webm" });
        if (blob.size < 300) {
          setError("Recording too short — speak the letter or word for about one second, then stop.");
          return;
        }

        setWhisperBusy(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "practice.webm");
          const { data } = await axios.post<{ text: string }>("/api/quran-whisper/transcribe", fd, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const text = (data.text || "").trim();
          if (!text) {
            setError("Whisper did not detect speech. Try again a bit louder or closer to the mic.");
            return;
          }
          sttTranscriptRef.current = text;
          setRecognizedText(text);
          setHasResult(true);
        } catch (e: unknown) {
          const msg =
            axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { message?: string }).message === "string"
              ? (e.response.data as { message: string }).message
              : axios.isAxiosError(e)
                ? e.message
                : "Whisper request failed";
          setError(msg);
        } finally {
          setWhisperBusy(false);
        }
      };

      mr.start(250);
      setIsWhisperRecording(true);
    } catch (e) {
      console.error(e);
      setError("Microphone permission denied or unavailable.");
      cleanupWhisperMedia();
      setIsWhisperRecording(false);
    }
  };

  const handleRecord = async () => {
    setError("");
    if (isWhisperRecording || whisperBusy) {
      setError("Finish or cancel the Whisper recording first.");
      return;
    }
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (lessonIdParam) {
      if (lessonPracticeError) return;
      if (!lessonPractice) {
        setError("Wait for the lesson to load, then tap the mic.");
        return;
      }
    }

    if (isRecording) {
      // Allow tapping again to manually stop in BOTH modes.
      try {
        recognition.stop();
      } catch {
        setIsRecording(false);
        lessonRecordingActiveRef.current = false;
      }
    } else {
      sttTranscriptRef.current = "";
      sttHardErrorRef.current = false;
      setRecognizedText("");
      setHasResult(false);
      setPracticePassMessage("");
      lessonSttBufferRef.current = "";
      lessonSttFinalsRef.current = "";
      if (lessonIdParam) {
        lessonRecordingActiveRef.current = true;
      }
      setIsRecording(true);
      try {
        recognition.start();
      } catch {
        setError("Could not start microphone. Try refreshing the page or check browser permissions.");
        setIsRecording(false);
        lessonRecordingActiveRef.current = false;
      }
    }
  };

  // Save recitation + optional lesson practice pass (≥70% unlocks next lesson)
  useEffect(() => {
    const saveRecitation = async () => {
      if (!hasResult || !recognizedText) return;

      let referenceDisplay: string;
      let referenceForComparison: string;
      let phraseId: string | null | undefined = selectedPhraseId;
      let lessonIdForRec: string | undefined;

      if (lessonPractice) {
        referenceDisplay = (lessonPractice.arabicText || lessonPractice.title || "").trim() || DEFAULT_REFERENCE_VERSE;
        referenceForComparison =
          (lessonPractice.arabicTextForComparison || "").trim() ||
          toPlainArabic(referenceDisplay);
        phraseId = undefined;
        lessonIdForRec = lessonPractice._id;
      } else {
        const selected = phrases.find((p) => p._id === selectedPhraseId);
        referenceDisplay = selected?.text || DEFAULT_REFERENCE_VERSE;
        referenceForComparison = selected?.textForComparison ?? toPlainArabic(referenceDisplay);
      }

      const result = analyzeRecitation(referenceForComparison, recognizedText);
      setAnalysis(result);

      try {
        const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!t) return;
        const h = { Authorization: `Bearer ${t}` };
        await axios.post(
          "/api/recitations",
          {
            recognizedText,
            referenceText: referenceDisplay,
            phraseId: phraseId || undefined,
            lessonId: lessonIdForRec,
          },
          { headers: h }
        );

        if (lessonPractice) {
          setPracticePassMessage("");
          if (result.overallScore >= 70) {
            try {
              const { data } = await axios.post<{
                newlyPassed?: boolean;
                alreadyPassed?: boolean;
              }>(
                "/api/lessons/practice-pass",
                { lessonId: lessonPractice._id, score: result.overallScore },
                { headers: h }
              );
              if (data?.newlyPassed) {
                setPracticePassMessage(
                  "You passed this lesson! The next lesson is now unlocked — go back to Lessons to continue."
                );
              } else if (data?.alreadyPassed) {
                setPracticePassMessage("You already passed this lesson. Open the next lesson from Lessons.");
              }
            } catch (e: unknown) {
              const status = axios.isAxiosError(e) ? e.response?.status : 0;
              if (status === 403) {
                setPracticePassMessage("Complete earlier lessons in order first (Lessons page).");
              }
            }
          } else {
            setPracticePassMessage(
              `Score ${result.overallScore}% — reach 70% or higher to unlock the next lesson. Try again!`
            );
          }
        }
      } catch {
        /* ignore */
      }
    };
    saveRecitation();
  }, [hasResult, recognizedText, lessonPractice, selectedPhraseId, phrases]);

  const statusIcon = { correct: CheckCircle, error: XCircle, warning: AlertCircle };
  const statusColor = { correct: "text-primary", error: "text-destructive", warning: "text-gold" };
  const statusBg = { correct: "bg-primary/10", error: "bg-destructive/10", warning: "bg-gold/10" };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-bold mb-2">AI Pronunciation Checker</h1>
        <p className="text-muted-foreground mb-8">Record your recitation and get instant AI-powered Tajweed feedback</p>

        {lessonPracticeError && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{lessonPracticeError}</div>
        )}

        {lessonPractice && !lessonPracticeError && (
          <div className="mb-6 p-4 rounded-lg border bg-primary/5">
            <p className="font-semibold">Lesson practice: {lessonPractice.title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Recite the letter or word below. <strong>70% or higher</strong> unlocks the next lesson on the Lessons page.
            </p>
            <p className="text-sm text-gold mt-2 font-medium">
              Mic: tap to start listening → say the letter → pause or tap again to stop. Then we compare it automatically.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              If single letters like alif are not picked up, use <strong>Record with Whisper</strong> below (needs{" "}
              <code className="text-xs">OPENAI_API_KEY</code> on the server and you must be logged in).
            </p>
            <Link to="/lessons" className="text-sm text-primary mt-2 inline-block hover:underline">
              ← Back to Lessons
            </Link>
            {practicePassMessage && (
              <p className="text-sm mt-3 p-2 rounded-md bg-muted">{practicePassMessage}</p>
            )}
          </div>
        )}

        {!lessonPractice && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">Select a phrase to practice:</p>
          <div className="flex flex-wrap gap-2">
            {phrases.length > 0 ? (
              phrases.map((phrase) => (
                <button
                  key={phrase._id}
                  type="button"
                  onClick={() => {
                    setSelectedPhraseId(phrase._id);
                    setHasResult(false);
                    setRecognizedText("");
                    setAnalysis(null);
                  }}
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    phrase._id === selectedPhraseId
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {phrase.label}
                </button>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                Using default phrase: {DEFAULT_REFERENCE_VERSE}
              </span>
            )}
          </div>
        </div>
        )}

        {/* Verse Display */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground mb-2">Reference phrase</p>
            <div className="flex flex-wrap gap-3 justify-center py-4" dir="rtl">
              {hasResult && analysis
                ? (() => {
                    const selected = phrases.find((p) => p._id === selectedPhraseId);
                    const displayWords = lessonPractice
                      ? (lessonPractice.arabicText || lessonPractice.title).split(" ").filter(Boolean)
                      : selected?.text?.split(" ").filter(Boolean) ?? [];
                    return analysis.words.map((w, i) => {
                      const Icon = statusIcon[w.status];
                      const displayWord = displayWords[i] ?? w.text;
                      const missedSet = new Set(w.missedIndices ?? []);
                      return (
                        <motion.div
                          key={i}
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.15 }}
                          className={`relative group ${statusBg[w.status]} rounded-lg px-4 py-2`}
                        >
                          {w.status === "error" && w.text.length > 0 ? (
                            <span className="font-arabic text-3xl text-destructive" dir="rtl">
                              {w.text.split("").map((char, ci) => (
                                <span
                                  key={ci}
                                  className={missedSet.has(ci) ? "underline decoration-2 decoration-destructive underline-offset-2" : ""}
                                >
                                  {char}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="font-arabic text-3xl">
                              {displayWord}
                            </span>
                          )}
                          <Icon className={`absolute -top-2 -right-2 w-5 h-5 ${statusColor[w.status]}`} />
                          {w.status === "error" && w.heard && (
                            <p className="text-xs text-muted-foreground mt-1 font-arabic" dir="rtl">
                              You said: {w.heard}
                            </p>
                          )}
                        {w.feedback && (
                          <div
                            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border rounded-lg p-3 shadow-lg w-64 opacity-0 group-hover:opacity-100 transition-opacity z-10 text-left"
                            dir="ltr"
                          >
                            <div className="flex items-start gap-2">
                              <Volume2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                              <p className="text-xs text-muted-foreground">{w.feedback}</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  });
                  })()
                : (
                  <p className="font-arabic text-3xl text-center">
                    {lessonPractice
                      ? lessonPractice.arabicText || lessonPractice.title
                      : phrases.find((p) => p._id === selectedPhraseId)?.text || DEFAULT_REFERENCE_VERSE}
                  </p>
                )}
            </div>
            {hasResult && recognizedText && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">What you said</p>
                <p className="font-arabic text-xl" dir="rtl">{recognizedText}</p>
              </div>
            )}
            {error && (
              <p className="mt-4 text-sm text-destructive text-center">{error}</p>
            )}
          </CardContent>
        </Card>

        {/* Record Button */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <motion.button
            onClick={handleRecord}
            disabled={isWhisperRecording || whisperBusy}
            animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
            transition={isRecording ? { repeat: Infinity, duration: 1 } : {}}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-destructive animate-pulse-glow" : "emerald-gradient hover:scale-105"} disabled:opacity-50 disabled:pointer-events-none`}
          >
            {isRecording ? <MicOff className="w-8 h-8 text-primary-foreground" /> : <Mic className="w-8 h-8 text-primary-foreground" />}
          </motion.button>
          <p className="text-sm text-muted-foreground">{isRecording ? "Recording... Tap to stop" : hasResult ? "Tap to record again" : "Tap to start recording"}</p>
          <div className="flex flex-col items-center gap-2 max-w-md text-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={isRecording || Boolean(lessonPracticeError) || (Boolean(lessonIdParam) && !lessonPractice)}
              onClick={() => void toggleWhisperRecord()}
            >
              <Sparkles className="w-4 h-4" />
              {isWhisperRecording ? "Stop & transcribe (Whisper)" : whisperBusy ? "Transcribing…" : "Record with Whisper (OpenAI)"}
            </Button>
            <p className="text-xs text-muted-foreground px-2">
              Records a short clip on the server with Arabic Whisper — often better than the browser for isolated letters and short words. Same scoring as the mic above.
            </p>
          </div>
          {hasResult && (
            <Button
              variant="outline"
              onClick={() => {
                setHasResult(false);
                setIsRecording(false);
                cleanupWhisperMedia();
                setIsWhisperRecording(false);
              }}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Retry Recitation
            </Button>
          )}
        </div>

        {/* Score & Feedback */}
        {hasResult && analysis && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>AI Feedback</CardTitle>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-primary" /> Correct
                  </span>
                  <span className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-destructive" /> Needs practice
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Word accuracy</span>
                    <span className="font-bold">{analysis.overallScore}%</span>
                  </div>
                  <Progress value={analysis.overallScore} className="h-3" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Focus on words marked in red above. Underlined letters are the ones that didn’t match what was heard.
                </p>
                {(() => {
                  const selected = phrases.find((p) => p._id === selectedPhraseId);
                  const displayWords = lessonPractice
                    ? (lessonPractice.arabicText || lessonPractice.title).split(" ").filter(Boolean)
                    : selected?.text?.split(" ").filter(Boolean) ?? [];
                  return analysis.words
                    .map((w, i) => (w.status === "error" ? { w, i } : null))
                    .filter((x): x is { w: typeof analysis.words[0]; i: number } => x != null)
                    .map(({ w, i }) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${statusBg[w.status]}`}>
                        <Volume2 className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-arabic text-lg">Expected: {displayWords[i] ?? w.text}</p>
                          {w.heard && (
                            <p className="font-arabic text-base text-muted-foreground mt-0.5">You said: {w.heard}</p>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">{w.feedback}</p>
                        </div>
                      </div>
                    ));
                })()}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
