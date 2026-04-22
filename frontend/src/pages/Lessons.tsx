import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Volume2, Play, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";

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

type UtterItem = { text: string; lang: string; voice?: SpeechSynthesisVoice | null };

/** Bumps on each new Listen click so cancelled chains don't keep running or block UI */
let ttsSession = 0;

/**
 * TTS: Chrome/Edge need resume() in the same user gesture; many PCs have no Arabic voice (silent).
 * We always speak Latin name in en-US first, then Arabic in ar-SA if text exists. Repeat = run chain twice.
 * onDone runs when this session finishes (or immediately if nothing to speak).
 */
function speakLessonWord(lesson: LessonDoc, repeat = true, onDone?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone?.();
    return;
  }

  const mySession = ++ttsSession;
  const synth = window.speechSynthesis;
  synth.cancel();
  try {
    synth.resume();
  } catch {
    /* ignore */
  }

  const latin = getLatinLessonName(lesson);
  const arabic = (lesson.arabicText || "").trim();

  const chain: UtterItem[] = [];
  if (latin) chain.push({ text: latin, lang: "en-US", voice: null });
  if (arabic) chain.push({ text: arabic, lang: "ar-SA", voice: null });

  if (chain.length === 0) {
    onDone?.();
    return;
  }

  const runPasses = repeat ? 2 : 1;
  let pass = 0;
  let index = 0;

  const finish = () => {
    if (mySession === ttsSession) onDone?.();
  };

  const speakNext = () => {
    if (mySession !== ttsSession) return;

    const voicesNow = synth.getVoices();
    const ar = voicesNow.find((v) => v.lang.toLowerCase().startsWith("ar"));
    if (index >= chain.length) {
      pass += 1;
      if (pass >= runPasses) {
        finish();
        return;
      }
      index = 0;
    }
    if (mySession !== ttsSession) return;

    const item = chain[index++];
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang;
    u.rate = item.lang.startsWith("ar") ? 0.85 : 0.95;
    u.volume = 1;
    const v = item.lang.startsWith("ar") && ar ? ar : item.voice;
    if (v) u.voice = v;
    u.onend = () => {
      if (mySession === ttsSession) speakNext();
    };
    u.onerror = () => {
      if (mySession === ttsSession) speakNext();
    };
    synth.speak(u);
  };

  setTimeout(speakNext, 0);
}

function getLessonStatus(lesson: LessonDoc, sorted: LessonDoc[], passed: Set<string>): LessonStatus {
  if (passed.has(lesson._id)) return "completed";
  const prev = sorted.filter((l) => (l.order ?? 0) < (lesson.order ?? 0));
  const allPrevPassed = prev.every((l) => passed.has(l._id));
  return allPrevPassed ? "current" : "locked";
}

export default function Lessons() {
  const navigate = useNavigate();
  const location = useLocation();
  const [lessons, setLessons] = useState<LessonDoc[]>([]);
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<LessonDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

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

  // Ensure voices load (needed on some browsers)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.getVoices();
    const onVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const handleListen = useCallback((e: React.MouseEvent, lesson: LessonDoc) => {
    e.stopPropagation();
    setSpeakingId(lesson._id);
    speakLessonWord(lesson, true, () => setSpeakingId(null));
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

        <Dialog open={!!selectedLesson} onOpenChange={() => setSelectedLesson(null)}>
          <DialogContent className="max-w-lg">
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
                onClick={() => selectedLesson && speakLessonWord(selectedLesson, true)}
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
                  onClick={() => {
                    const l = selectedLesson;
                    setSelectedLesson(null);
                    if (l) navigate(`/pronunciation?lessonId=${l._id}`);
                  }}
                >
                  Practice Now
                </Button>
                <Button variant="outline" onClick={() => setSelectedLesson(null)}>Close</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}
