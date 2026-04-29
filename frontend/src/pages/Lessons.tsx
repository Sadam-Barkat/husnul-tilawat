import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { Volume2, Play, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { checkRecitation } from "@/utils/checkRecitation";

type LessonStatus = "completed" | "current" | "locked";

interface LessonDoc {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  level?: string;
  category?: string;
  ruleSummary?: string;
  arabicText?: string;
  arabicTextForComparison?: string;
  translation?: string;
  audioUrl?: string;
  order?: number;
}

/** Latin name from title e.g. "Lesson 1: Alif (ا)" → "Alif" — always audible on Windows TTS */
function getLatinLessonName(lesson: LessonDoc): string {
  const t = lesson.title || "";
  const afterColon = t.includes(":") ? t.split(":").slice(1).join(":").trim() : t;
  const noParen = afterColon.replace(/\s*\([^)]*\)\s*/g, "").trim();
  if (noParen) return noParen;
  const fromSlug = (lesson.slug || "")
    .replace(/^lesson-\d+-/i, "")
    .replace(/-/g, " ");
  return fromSlug || "lesson";
}

function lessonComparisonStrings(lesson: LessonDoc): { display: string; compare: string } {
  const display = (lesson.arabicText || lesson.title || "").trim();
  const compare = display;
  return { display, compare };
}

function getLessonStatus(lesson: LessonDoc, sorted: LessonDoc[], passed: Set<string>): LessonStatus {
  if (passed.has(lesson._id)) return "completed";
  const prev = sorted.filter((l) => (l.order ?? 0) < (lesson.order ?? 0));
  const allPrevPassed = prev.every((l) => passed.has(l._id));
  return allPrevPassed ? "current" : "locked";
}

export default function Lessons() {
  const location = useLocation();
  const [lessons, setLessons] = useState<LessonDoc[]>([]);
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<LessonDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;
  const [ttsVoices, setTtsVoices] = useState<SpeechSynthesisVoice[]>([]);

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceLesson, setPracticeLesson] = useState<LessonDoc | null>(null);

  const resetLesson = useCallback(() => {
    setCheckResult(null);
    setCheckError("");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    const loadVoices = () => {
      try {
        const v = synth.getVoices?.() || [];
        if (v.length) setTtsVoices(v);
      } catch {
        /* ignore */
      }
    };

    loadVoices();
    // Some browsers fire this later (Chrome/Edge).
    try {
      synth.addEventListener("voiceschanged", loadVoices);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        synth.removeEventListener("voiceschanged", loadVoices);
      } catch {
        /* ignore */
      }
    };
  }, []);

  const speakArabic = useCallback(
    (text: string, opts?: { onEnd?: () => void; rate?: number }) => {
    if (typeof window === "undefined") return;
    const t = String(text || "").trim();
    if (!t) return;
    const synth = window.speechSynthesis;
    if (!synth) {
      alert("Text-to-speech is not available in this browser.");
      return;
    }

    // Stop any previous speech immediately.
    try {
      synth.cancel();
      synth.resume?.();
    } catch {
      /* ignore */
    }

    const pickVoice = (): SpeechSynthesisVoice | null => {
      const voices = ttsVoices.length ? ttsVoices : (() => {
        try {
          return synth.getVoices?.() || [];
        } catch {
          return [];
        }
      })();
      const arabicCandidates = voices.filter(
        (v) => /^ar\b/i.test(v.lang) || /arab/i.test(v.lang) || /arab/i.test(v.name),
      );
      const urduCandidates = voices.filter((v) => /^ur\b/i.test(v.lang) || /urdu/i.test(v.lang) || /urdu/i.test(v.name));
      const localArabic = arabicCandidates.find((v) => (v as any).localService) || arabicCandidates[0];
      const localUrdu = urduCandidates.find((v) => (v as any).localService) || urduCandidates[0];
      const anyLocal = voices.find((v) => (v as any).localService) || null;
      return localArabic || localUrdu || anyLocal || (voices.length ? voices[0] : null);
    };

    const v = pickVoice();
    const isArabic = v ? /^ar\b/i.test(v.lang) || /arab/i.test(v.lang) || /arab/i.test(v.name) : false;
    const isUrdu = v ? /^ur\b/i.test(v.lang) || /urdu/i.test(v.lang) || /urdu/i.test(v.name) : false;
    const fallbackLatin = opts && (opts as any).fallbackLatin ? String((opts as any).fallbackLatin) : "";
    const textToSpeak = isArabic || isUrdu ? t : (fallbackLatin || t);

    const u = new SpeechSynthesisUtterance(textToSpeak);
    u.lang = v?.lang || (isUrdu ? "ur-PK" : "ar-SA");
    u.rate = opts?.rate ?? 0.95;
    u.volume = 1;
    u.pitch = 1;
    if (v) u.voice = v;
    u.onend = () => opts?.onEnd?.();
    u.onerror = (ev) => {
      console.error("[TTS] error", ev);
      opts?.onEnd?.();
    };
    u.onstart = () => {
      console.log("[TTS] start", {
        voices: ttsVoices.length,
        speaking: synth.speaking,
        paused: synth.paused,
        voice: v ? { name: v.name, lang: v.lang, localService: (v as any).localService } : null,
        textLen: textToSpeak.length,
      });
    };
    synth.speak(u);
    },
    [ttsVoices],
  );

  const speakLessonWord = useCallback(
    (lesson: LessonDoc, repeatOnce = false) => {
      const arabicText = (lesson.arabicText || "").trim();
      const latin = getLatinLessonName(lesson);
      const text = arabicText || latin;
      setSpeakingId(lesson._id);
      speakArabic(text, {
        onEnd: () => {
          if (repeatOnce) {
            speakArabic(text, {
              onEnd: () => setSpeakingId(null),
              rate: 0.95,
              fallbackLatin: latin,
            });
          } else {
            setSpeakingId(null);
          }
        },
        fallbackLatin: latin,
      });
    },
    [speakArabic],
  );

  const playAudioUrl = useCallback(
    (audioUrl: string, onDone?: () => void) => {
      if (!audioUrl) return false;
      const u = String(audioUrl).trim();
      if (!u) return false;
      const resolved =
        /^https?:\/\//i.test(u) ? u : u.startsWith("/") ? `http://127.0.0.1:5000${u}` : `http://127.0.0.1:5000/${u}`;
      const audio = new Audio(resolved);
      audio.onended = () => onDone?.();
      audio.onerror = () => onDone?.();
      audio.play().catch(() => onDone?.());
      return true;
    },
    [],
  );

  const playMolviAudio = useCallback((audioUrl: string) => {
    if (!audioUrl) return;
    const u = String(audioUrl).trim();
    const resolved =
      /^https?:\/\//i.test(u) ? u : u.startsWith("/") ? `http://127.0.0.1:5000${u}` : `http://127.0.0.1:5000/${u}`;
    const audio = new Audio(resolved);
    audio.play().catch(() => {
      alert("Could not play audio. Please check your connection.");
    });
  }, []);

  const resetPractice = useCallback(() => {
    resetLesson();
    setPracticeLesson(null);
  }, [resetLesson]);

  const sortedLessons = useMemo(
    () =>
      [...lessons].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a._id).localeCompare(String(b._id))
      ),
    [lessons]
  );

  const totalPages = Math.max(1, Math.ceil(sortedLessons.length / PAGE_SIZE));
  const pageLessons = useMemo(
    () => sortedLessons.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [sortedLessons, page]
  );

  useEffect(() => {
    setPage((p) => Math.min(Math.max(0, p), totalPages - 1));
  }, [totalPages, sortedLessons.length]);

  const handleListen = useCallback((e: React.MouseEvent, lesson: LessonDoc) => {
    e.stopPropagation();
    setSpeakingId(lesson._id);
    // Use Web Speech TTS for listening. If audioUrl exists, user can still use "🔊 Listen to correct pronunciation".
    speakLessonWord(lesson, false);
  }, [speakLessonWord]);

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) {
          setLoading(false);
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [lessonsRes, progressRes] = await Promise.all([
          axios.get<LessonDoc[]>("/api/lessons", { headers }),
          axios.get<{ passedLessonIds: string[] }>("/api/lessons/progress/me", { headers }),
        ]);
        setLessons(lessonsRes.data || []);
        setPassedIds(new Set(progressRes.data?.passedLessonIds || []));
        setError("");
      } catch (err: unknown) {
        const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
        setError(msg || "Failed to load lessons.");
      } finally {
        setLoading(false);
      }
    };
    if (location.pathname === "/lessons") load();
  }, [location.pathname]);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-bold mb-2">Tajweed Lessons</h1>
        <p className="text-muted-foreground mb-8">Master the art of Qur'anic recitation, one letter at a time</p>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-muted-foreground">Loading lessons...</div>
        ) : (
        <>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-sm text-muted-foreground">
            {sortedLessons.length} lessons — pass each in order to unlock the next
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <span className="text-sm tabular-nums px-2">
              Page {page + 1} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pageLessons.map((lesson, i) => {
            const order = lesson.order ?? page * PAGE_SIZE + i + 1;
            const status = getLessonStatus(lesson, sortedLessons, passedIds);

            const arabic = lesson.arabicText || "";
            const [lessonNumberLabel, lessonTitleLabel] = lesson.title.split(":").length === 2
              ? lesson.title.split(":")
              : [`Lesson ${order}`, lesson.title];

            return (
            <motion.div key={lesson._id ?? i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className={`group cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${status === "locked" ? "opacity-60" : ""}`}
                onClick={() => status !== "locked" && setSelectedLesson(lesson)}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-arabic text-3xl text-primary">{arabic}</span>
                    {status === "completed" && <CheckCircle className="w-5 h-5 text-primary" />}
                    {status === "current" && <Badge className="gold-gradient border-0 text-foreground">Current</Badge>}
                    {status === "locked" && <Badge variant="secondary">Locked</Badge>}
                  </div>
                  <h3 className="font-bold mb-1">
                    {lessonNumberLabel}: {lessonTitleLabel}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {lesson.description}
                  </p>
                  {status !== "locked" && (
                    <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={(e) => handleListen(e, lesson)}
                      >
                        <Volume2 className={`w-3 h-3 ${speakingId === lesson._id ? "animate-pulse" : ""}`} /> Listen
                      </Button>
                      <Button size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); setSelectedLesson(lesson); }}><Play className="w-3 h-3" /> Start</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ); })}
        </div>
        </>
        )}

        <Dialog
          open={!!selectedLesson}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedLesson(null);
              resetLesson();
            }
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="font-arabic text-4xl text-primary">{selectedLesson?.arabicText}</span>
                <span>{selectedLesson?.title}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-muted-foreground">{selectedLesson?.description}</p>
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold mb-2">Makhraj (Articulation Point)</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedLesson?.ruleSummary ||
                    "Place the tip of your tongue at the described position and produce the sound gently. Listen to the example audio below."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedLesson) return;
                  setSpeakingId(selectedLesson._id);
                  speakLessonWord(selectedLesson, true);
                }}
                className="w-full flex items-center gap-3 bg-primary/5 rounded-lg p-4 hover:bg-primary/10 transition-colors text-left"
              >
                <span className="w-12 h-12 rounded-full emerald-gradient flex items-center justify-center hover:scale-105 transition-transform shrink-0">
                  <Volume2 className="w-5 h-5 text-primary-foreground" />
                </span>
                <div>
                  <p className="font-semibold text-sm">Example Pronunciation</p>
                  <p className="text-xs text-muted-foreground">Tap to hear the word repeated</p>
                </div>
              </button>

              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  type="button"
                  onClick={() => {
                    if (!selectedLesson) return;
                    setPracticeLesson(selectedLesson);
                    setPracticeOpen(true);
                    resetLesson();
                  }}
                >
                  Practice
                </Button>
                <Button variant="outline" onClick={() => setSelectedLesson(null)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={practiceOpen}
          onOpenChange={(open) => {
            setPracticeOpen(open);
            if (!open) resetPractice();
          }}
        >
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <span className="font-bold">Practice</span>
                <span className="text-muted-foreground text-sm">Select a letter, then recite</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {sortedLessons
                  .filter((l) => getLessonStatus(l, sortedLessons, passedIds) !== "locked")
                  .map((l) => (
                    <button
                      key={l._id}
                      type="button"
                      onClick={() => {
                        setPracticeLesson(l);
                        resetLesson();
                      }}
                      className={`px-3 py-2 rounded-lg border text-sm flex items-center gap-2 ${
                        practiceLesson?._id === l._id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                      }`}
                    >
                      <span className="font-arabic text-xl">{l.arabicText}</span>
                      <span className="text-xs opacity-80">{getLatinLessonName(l)}</span>
                    </button>
                  ))}
              </div>

              {practiceLesson && (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Selected</p>
                  <p className="font-arabic text-3xl" dir="rtl">
                    {practiceLesson.arabicText}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Button
                  type="button"
                  disabled={checking || !practiceLesson}
                  variant={isRecording ? "destructive" : "default"}
                  onClick={async () => {
                    if (!practiceLesson) return;
                    if (!isRecording) {
                      resetLesson();
                      try {
                        await startRecording();
                      } catch {
                        setCheckError("Could not access microphone. Please allow mic permission and try again.");
                      }
                      return;
                    }

                    try {
                      setCheckError("");
                      setChecking(true);
                      const blob = await stopRecording();
                      const expectedText = lessonComparisonStrings(practiceLesson).compare;
                      const result = await checkRecitation(blob, "lesson", expectedText);
                      setCheckResult(result);
                    } catch {
                      setCheckError("Could not process audio, please try again");
                    } finally {
                      setChecking(false);
                    }
                  }}
                >
                  {checking ? "Checking…" : isRecording ? "Stop & Check" : "Practice"}
                </Button>

                {checkError && <p className="text-xs text-destructive">{checkError}</p>}

                {checkResult && (
                  <div className={checkResult.passed ? "text-green-600" : "text-red-600"}>
                    <p className="font-semibold">{checkResult.passed ? "You win" : "You loss"}</p>
                    <p>Score: {checkResult.score}</p>
                    <p>You said: {checkResult.spokenWord}</p>
                    <p>Expected: {checkResult.expectedWord}</p>
                    {!checkResult.passed && (
                      <button
                        onClick={() => playMolviAudio(String(practiceLesson?.audioUrl || ""))}
                        className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        🔊 Listen to correct pronunciation
                      </button>
                    )}
                    <button onClick={resetLesson} className="underline ml-3">
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}
