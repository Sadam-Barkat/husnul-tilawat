import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  catchwordFromPage,
  findPageForVerse,
  flattenPage,
  loadMadaniMushaf,
  mushafMadaniAttribution,
  primarySurahOnPage,
  toArabicIndicNum,
  type MushafPageRaw,
  type FlatVerseLine,
} from "@/lib/mushafMadani";
import { ChevronLeft, ChevronRight, Play, Square, Mic } from "lucide-react";
import { toPlainArabic } from "@/lib/arabicRecitationCompare";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { checkRecitation } from "@/utils/checkRecitation";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: { length: number; [k: number]: { 0: { transcript: string }; isFinal: boolean } } }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

const TOTAL_PAGES = 604;

const RECITER_STORAGE_KEY = "husnQuranAudioReciter";

/** Al Quran Cloud audio editions (`GET /v1/ayah/{surah}:{ayah}/{identifier}`) — all verse-by-verse on api.alquran.cloud. */
const AUDIO_RECITERS: ReadonlyArray<{ id: string; name: string }> = [
  { id: "ar.alafasy", name: "Mishary Alafasy" },
  { id: "ar.abdurrahmaansudais", name: "Abdurrahman As-Sudais" },
  { id: "ar.mahermuaiqly", name: "Maher Al Muaiqly" },
  { id: "ar.husary", name: "Al-Husary" },
  { id: "ar.abdullahbasfar", name: "Abdullah Basfar" },
];

function readStoredReciterId(): string {
  if (typeof window === "undefined") return AUDIO_RECITERS[0].id;
  try {
    const v = localStorage.getItem(RECITER_STORAGE_KEY);
    if (v && AUDIO_RECITERS.some((r) => r.id === v)) return v;
  } catch {
    /* ignore */
  }
  return AUDIO_RECITERS[0].id;
}

/** Word highlight key: surah-ayah-wordIndex (1-based word within ayah). */
function wordHighlightKey(chapter: number, verse: number, word: number): string {
  return `${Number(chapter)}-${Number(verse)}-${Number(word)}`;
}

function ayahRowKey(surah: number, verseNumber: string): string {
  return `${surah}-${verseNumber}`;
}

function buildSurahTitleMap(pages: MushafPageRaw[]): Map<number, string> {
  const m = new Map<number, string>();
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    const page = pages[p];
    if (!page) continue;
    for (const k of Object.keys(page)) {
      if (k === "juzNumber") continue;
      const id = parseInt(k, 10);
      if (Number.isNaN(id) || m.has(id)) continue;
      const sec = page[k] as { titleAr?: string };
      if (sec?.titleAr) m.set(id, sec.titleAr);
    }
  }
  return m;
}

export default function Quran() {
  const [pages, setPages] = useState<MushafPageRaw[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pageNum, setPageNum] = useState(1);
  const [jumpPage, setJumpPage] = useState("1");
  const [jumpSurah, setJumpSurah] = useState("1");
  const [jumpAyah, setJumpAyah] = useState("1");
  const [pickSurah, setPickSurah] = useState("1");

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingAyahKey, setPlayingAyahKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioError, setAudioError] = useState("");
  const [audioReciterId, setAudioReciterId] = useState<string>(() => readStoredReciterId());

  /** Which mushaf line is the reference for live check: `${surah}-${verseNumber}` from data. */
  const [liveTargetAyahKey, setLiveTargetAyahKey] = useState<string | null>(null);
  const [wordMistakes, setWordMistakes] = useState<Set<string>>(new Set());
  const [wordCorrect, setWordCorrect] = useState<Set<string>>(new Set());

  const { isRecording: isTilawatRecording, startRecording, stopRecording } = useAudioRecorder();
  const [tilawatChecking, setTilawatChecking] = useState(false);
  const [tilawatError, setTilawatError] = useState("");
  const [tilawatResult, setTilawatResult] = useState<any>(null);
  const [tilawatAyah, setTilawatAyah] = useState<{ surah: number; ayah: string } | null>(null);

  /** True while "Listen Page" should chain ayat and advance to the next mushaf page automatically. */
  const continuousListenRef = useRef(false);
  /** When true, the next pageNum effect run should start page-1 audio instead of stopping (cross-page listen). */
  const autoListenAdvanceRef = useRef(false);
  const pageNumRef = useRef(pageNum);
  pageNumRef.current = pageNum;
  const isPlayingRef = useRef(isPlaying);
  const playingAyahKeyRef = useRef(playingAyahKey);
  isPlayingRef.current = isPlaying;
  playingAyahKeyRef.current = playingAyahKey;

  useEffect(() => {
    loadMadaniMushaf()
      .then(setPages)
      .catch(() => setLoadError("Could not load mushaf data. Check your connection."));
  }, []);

  const surahTitles = useMemo(() => (pages ? buildSurahTitleMap(pages) : new Map<number, string>()), [pages]);

  const currentPage = pages?.[pageNum];
  const lines = useMemo(() => flattenPage(currentPage), [currentPage]);
  const linesRef = useRef<FlatVerseLine[]>([]);
  linesRef.current = lines;

  useEffect(() => {
    if (lines.length === 0) {
      setLiveTargetAyahKey(null);
      return;
    }
    setLiveTargetAyahKey((prev) => {
      if (prev != null && lines.some((l) => ayahRowKey(l.surah, l.verseNumber) === prev)) return prev;
      const f = lines[0];
      return f ? ayahRowKey(f.surah, f.verseNumber) : null;
    });
  }, [lines]);

  const primary = primarySurahOnPage(currentPage);
  const juz = typeof currentPage?.juzNumber === "number" ? currentPage.juzNumber : undefined;
  const catchword = pages ? catchwordFromPage(pages, pageNum) : "";

  const goPage = useCallback((p: number) => {
    setPageNum(Math.min(TOTAL_PAGES, Math.max(1, p)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") goPage(pageNum - 1);
      if (e.key === "ArrowRight") goPage(pageNum + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPage, pageNum]);

  const applyJumpPage = () => {
    const p = Math.min(TOTAL_PAGES, Math.max(1, parseInt(jumpPage, 10) || 1));
    setJumpPage(String(p));
    goPage(p);
  };

  const applyJumpVerse = () => {
    if (!pages) return;
    const s = Math.min(114, Math.max(1, parseInt(jumpSurah, 10) || 1));
    const a = Math.max(1, parseInt(jumpAyah, 10) || 1);
    const p = findPageForVerse(pages, s, a);
    setJumpSurah(String(s));
    setJumpAyah(String(a));
    goPage(p);
  };

  const goFirstOfSurah = () => {
    if (!pages) return;
    const s = Math.min(114, Math.max(1, parseInt(pickSurah, 10) || 1));
    const p = findPageForVerse(pages, s, 1);
    setPickSurah(String(s));
    goPage(p);
  };

  // Audio Playback Logic
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlayingAyahKey(null);
    setAudioError("");
  }, []);

  const playAyahRef = useRef<((surah: number, ayah: string) => Promise<void>) | null>(null);
  const playAyah = useCallback(
    async (surah: number, ayah: string) => {
      stopAudio();
      setAudioError("");
      setPlayingAyahKey(`${surah}-${ayah}`);
      setIsPlaying(true);

      try {
        // Al Quran Cloud: per-ayah audio URL for the selected reciter edition
        // https://api.alquran.cloud/v1/ayah/{surah}:{ayah}/{edition}
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/${audioReciterId}`);
        if (!res.ok) throw new Error("Failed to fetch audio URL");
        const data = await res.json();
        const audioUrl = data.data.audio;

        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        audioRef.current.src = audioUrl;

        audioRef.current.onended = () => {
          // Auto-play next ayah on the same page if available
          const currentIndex = lines.findIndex((l) => l.surah === surah && l.verseNumber === ayah);
          if (currentIndex !== -1 && currentIndex + 1 < lines.length) {
            const nextAyah = lines[currentIndex + 1];
            void playAyahRef.current?.(nextAyah.surah, nextAyah.verseNumber);
          } else if (continuousListenRef.current && pageNumRef.current < TOTAL_PAGES) {
            autoListenAdvanceRef.current = true;
            setPageNum((p) => Math.min(TOTAL_PAGES, p + 1));
          } else {
            continuousListenRef.current = false;
            setIsPlaying(false);
            setPlayingAyahKey(null);
          }
        };

        audioRef.current.onerror = () => {
          setAudioError("Failed to load audio");
          continuousListenRef.current = false;
          setIsPlaying(false);
          setPlayingAyahKey(null);
        };

        await audioRef.current.play();
      } catch (err) {
        console.error("Audio error:", err);
        setAudioError("Audio unavailable");
        continuousListenRef.current = false;
        setIsPlaying(false);
        setPlayingAyahKey(null);
      }
    },
    [lines, stopAudio, audioReciterId],
  );
  playAyahRef.current = playAyah;

  // If the user switches reciter while audio is playing, reload the same ayah with the new voice.
  useEffect(() => {
    if (!isPlayingRef.current || !playingAyahKeyRef.current) return;
    const key = playingAyahKeyRef.current;
    const dashIdx = key.indexOf("-");
    if (dashIdx <= 0) return;
    const surahNum = parseInt(key.slice(0, dashIdx), 10);
    const ayahStr = key.slice(dashIdx + 1);
    if (!Number.isFinite(surahNum)) return;
    void playAyahRef.current?.(surahNum, ayahStr);
  }, [audioReciterId]);

  // When page changes: stop audio unless we intentionally advanced for continuous "Listen Page".
  // Depends only on pageNum so mushaf `lines` filling in later does not cancel an active session.
  useEffect(() => {
    if (autoListenAdvanceRef.current) {
      autoListenAdvanceRef.current = false;
      const L = linesRef.current;
      if (L.length > 0) {
        const f = L[0];
        setLiveTargetAyahKey(ayahRowKey(f.surah, f.verseNumber));
        void playAyahRef.current?.(f.surah, f.verseNumber);
      } else {
        continuousListenRef.current = false;
        setIsPlaying(false);
        setPlayingAyahKey(null);
      }
      return;
    }
    continuousListenRef.current = false;
    stopAudio();
  }, [pageNum, stopAudio]);

  const togglePagePlay = () => {
    if (isPlaying) {
      continuousListenRef.current = false;
      stopAudio();
    } else {
      if (lines.length > 0) {
        continuousListenRef.current = true;
        const f = lines[0];
        setLiveTargetAyahKey(ayahRowKey(f.surah, f.verseNumber));
        void playAyah(f.surah, f.verseNumber);
      }
    }
  };

  const handleAyahClick = (surah: number, ayah: string) => {
    continuousListenRef.current = false;
    setLiveTargetAyahKey(ayahRowKey(surah, ayah));
    void playAyah(surah, ayah);
  };

  useEffect(() => {
    setWordMistakes(new Set());
    setWordCorrect(new Set());
  }, [pageNum]);

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col max-w-6xl mx-auto gap-4">
        {/* Header & Compact Controls */}
        <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/50 p-3 rounded-xl border">
          <div>
            <h1 className="text-xl font-bold text-foreground">Qur'an — Mushaf</h1>
            <p className="text-xs text-muted-foreground">Madina layout. Flip pages to read.</p>
          </div>
          {pages && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Page</Label>
                <Input
                  className="w-14 h-8 text-center"
                  inputMode="numeric"
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                />
                <Button size="sm" variant="secondary" className="h-8" onClick={applyJumpPage}>
                  Go
                </Button>
              </div>
              <div className="hidden md:block w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                <Select value={pickSurah} onValueChange={setPickSurah}>
                  <SelectTrigger className="h-8 w-[130px]">
                    <SelectValue placeholder="Surah" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {Array.from({ length: 114 }, (_, i) => i + 1).map((id) => (
                      <SelectItem key={id} value={String(id)}>
                        {id}. {surahTitles.get(id) ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="secondary" className="h-8" onClick={goFirstOfSurah}>
                  Open
                </Button>
              </div>
              <div className="hidden md:block w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Surah</Label>
                <Input
                  className="w-12 h-8 text-center"
                  inputMode="numeric"
                  value={jumpSurah}
                  onChange={(e) => setJumpSurah(e.target.value)}
                />
                <Label className="text-xs text-muted-foreground ml-1">Ayah</Label>
                <Input
                  className="w-12 h-8 text-center"
                  inputMode="numeric"
                  value={jumpAyah}
                  onChange={(e) => setJumpAyah(e.target.value)}
                />
                <Button size="sm" variant="secondary" className="h-8" onClick={applyJumpVerse}>
                  Go
                </Button>
              </div>
              <div className="hidden md:block w-px h-6 bg-border" />
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Button
                  size="sm"
                  variant={isPlaying ? "destructive" : "default"}
                  className="h-8 gap-1.5"
                  onClick={togglePagePlay}
                  disabled={lines.length === 0 || isTilawatRecording || tilawatChecking}
                >
                  {isPlaying ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Listen Page
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground shrink-0">Reciter</Label>
                  <Select
                    value={audioReciterId}
                    onValueChange={(v) => {
                      setAudioReciterId(v);
                      try {
                        localStorage.setItem(RECITER_STORAGE_KEY, v);
                      } catch {
                        /* ignore */
                      }
                    }}
                    disabled={isTilawatRecording || tilawatChecking}
                  >
                    <SelectTrigger
                      className="h-8 w-[min(100vw-10rem,10.5rem)] sm:w-[10.5rem]"
                      title="Reciter — audio from api.alquran.cloud"
                    >
                      <SelectValue placeholder="Reciter" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {AUDIO_RECITERS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  variant={isTilawatRecording ? "destructive" : "secondary"}
                  className="h-8 gap-1.5"
                  disabled={lines.length === 0 || isPlaying || tilawatChecking}
                  onClick={async () => {
                    try {
                      setTilawatError("");
                      if (!isTilawatRecording) {
                        setTilawatResult(null);
                        setWordMistakes(new Set());
                        setWordCorrect(new Set());
                        await startRecording();
                        return;
                      }
                      setTilawatChecking(true);
                      const blob = await stopRecording();
                      const refLine =
                        (liveTargetAyahKey != null
                          ? lines.find((l) => ayahRowKey(l.surah, l.verseNumber) === liveTargetAyahKey)
                          : null) ?? lines[0];
                      const expectedAyah = (refLine?.text || "").trim();
                      if (refLine) setTilawatAyah({ surah: refLine.surah, ayah: refLine.verseNumber });
                      const result = await checkRecitation(blob, "quran", expectedAyah);
                      setTilawatResult(result);
                      if (refLine && Array.isArray(result?.wordResults)) {
                        const ayahNum = parseInt(String(refLine.verseNumber).replace(/[^\d]/g, ""), 10) || 1;
                        const mistakes = new Set<string>();
                        const correct = new Set<string>();
                        result.wordResults.forEach((w: any, idx: number) => {
                          const k = wordHighlightKey(refLine.surah, ayahNum, idx + 1);
                          if (w?.correct) correct.add(k);
                          else mistakes.add(k);
                        });
                        setWordMistakes(mistakes);
                        setWordCorrect(correct);
                      }
                    } catch (e) {
                      console.error("[Quran] checkRecitation failed:", e);
                      setTilawatError("Could not process audio, please try again");
                    } finally {
                      setTilawatChecking(false);
                    }
                  }}
                >
                  {isTilawatRecording ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      Stop &amp; Check
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      Start Tilawat
                    </>
                  )}
                </Button>
                {audioError && <span className="text-xs text-destructive">{audioError}</span>}
                {tilawatError && <span className="text-xs text-destructive">{tilawatError}</span>}
              </div>
            </div>
          )}
        </div>

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {!pages && !loadError && <p className="text-sm text-muted-foreground">Loading mushaf…</p>}

        {pages && (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 md:gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="h-20 w-12 shrink-0 rounded-xl bg-card border shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => goPage(pageNum - 1)}
              disabled={pageNum <= 1}
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>

            <div className="flex-1 min-w-0 h-full max-w-4xl">
              <MushafPageView
                pageNum={pageNum}
                lines={lines}
                primaryTitleAr={primary?.titleAr}
                juz={juz}
                catchword={catchword}
                playingAyahKey={playingAyahKey}
                liveTargetAyahKey={liveTargetAyahKey}
                onAyahClick={handleAyahClick}
                wordMistakes={wordMistakes}
                wordCorrect={wordCorrect}
              />

              {tilawatResult && typeof tilawatResult?.accuracy === "number" && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Accuracy: {tilawatResult.accuracy}% ({tilawatResult.correctWords}/{tilawatResult.totalWords} words correct)
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-20 w-12 shrink-0 rounded-xl bg-card border shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => goPage(pageNum + 1)}
              disabled={pageNum >= TOTAL_PAGES}
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          </div>
        )}

        {pages && null}
      </div>
    </DashboardLayout>
  );
}

function MushafPageView({
  pageNum,
  lines,
  primaryTitleAr,
  juz,
  catchword,
  playingAyahKey,
  liveTargetAyahKey,
  onAyahClick,
  wordMistakes,
  wordCorrect,
}: {
  pageNum: number;
  lines: FlatVerseLine[];
  primaryTitleAr?: string;
  juz?: number;
  catchword: string;
  playingAyahKey: string | null;
  liveTargetAyahKey: string | null;
  onAyahClick: (surah: number, ayah: string) => void;
  wordMistakes: Set<string>;
  wordCorrect: Set<string>;
}) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Outer ornate frame — site emerald + gold */}
      <div
        className="rounded-lg p-[4px] shadow-xl h-full flex flex-col"
        style={{
          background: "linear-gradient(135deg, hsl(42, 80%, 48%) 0%, hsl(160, 55%, 28%) 50%, hsl(42, 75%, 42%) 100%)",
        }}
      >
        <div
          className="rounded-[6px] border-2 overflow-hidden flex flex-col h-full"
          style={{
            borderColor: "hsl(160, 45%, 22%)",
            background: "hsl(40, 33%, 97%)",
            boxShadow: "inset 0 0 0 1px hsl(42, 80%, 55% / 0.35)",
          }}
        >
          {/* Header */}
          <div
            className="shrink-0 grid grid-cols-3 items-center gap-1 px-4 py-2 border-b-2 text-center bg-[hsl(40,33%,94%)]"
            style={{ borderColor: "hsl(160, 35%, 28% / 0.35)" }}
          >
            <div className="text-base font-['Amiri',serif] text-foreground truncate text-right" dir="rtl" title={primaryTitleAr}>
              {primaryTitleAr ?? "—"}
            </div>
            <div className="font-['Amiri',serif] text-xl font-semibold text-primary tabular-nums" dir="rtl">
              {toArabicIndicNum(pageNum)}
            </div>
            <div className="text-base font-['Amiri',serif] text-muted-foreground truncate text-left" dir="rtl">
              {juz != null ? (
                <>
                  الجزء&nbsp;{toArabicIndicNum(juz)}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>

          {/* Body: raw text flow */}
          <div className="flex-1 min-h-0 px-6 py-4 overflow-y-auto">
            {lines.length === 0 ? (
              <div className="flex items-center justify-center text-muted-foreground text-sm h-full">No text for this page.</div>
            ) : (
              <div className="min-h-full flex flex-col justify-center">
                <div
                  className="font-['Amiri',serif] font-medium text-foreground text-justify break-words py-4"
                  dir="rtl"
                  style={{ fontSize: "clamp(1.2rem, 2.5vw + 1vh, 2.1rem)", lineHeight: "2.2", textAlignLast: "justify" }}
                >
                  {lines.map((row, i) => {
                    const ayahKey = ayahRowKey(row.surah, row.verseNumber);
                    const isPlaying = playingAyahKey === ayahKey;
                    const isLiveTarget = liveTargetAyahKey != null && liveTargetAyahKey === ayahKey;

                    const words = row.text.trim().split(/\s+/).filter(Boolean);

                    return (
                      <span
                        key={`${ayahKey}-${i}`}
                        className={`cursor-pointer transition-colors duration-300 ${
                          isPlaying ? "bg-primary/10 rounded-md" : ""
                        } ${isLiveTarget ? "ring-2 ring-amber-500/70 rounded-md ring-offset-1 ring-offset-[hsl(40,33%,97%)]" : ""} ${
                          !isPlaying && !isLiveTarget ? "hover:text-primary/70" : ""
                        }`}
                        onClick={() => onAyahClick(row.surah, row.verseNumber)}
                      >
                        <span className="inline">
                          {words.map((word, wIdx) => {
                            const ayahNum = parseInt(String(row.verseNumber).replace(/[^\d]/g, ""), 10) || 1;
                            const wordKey = wordHighlightKey(row.surah, ayahNum, wIdx + 1);
                            const isMistake = wordMistakes.has(wordKey);
                            const isCorrect = wordCorrect.has(wordKey);

                            return (
                              <span
                                key={wIdx}
                                className={`${isMistake ? "text-red-600 font-bold" : isCorrect ? "text-green-600" : isPlaying ? "text-primary" : ""}`}
                              >
                                {word}{" "}
                              </span>
                            );
                          })}
                        </span>
                        <span
                          className="inline-flex items-center justify-center rounded-full border-2 text-[0.55em] text-primary mx-2"
                          style={{
                            borderColor: "hsl(160, 50%, 32%)",
                            width: "2.2em",
                            height: "2.2em",
                            verticalAlign: "middle",
                            transform: "translateY(-2px)",
                          }}
                          dir="rtl"
                        >
                          {toArabicIndicNum(parseInt(row.verseNumber, 10))}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {catchword ? (
            <div
              className="shrink-0 text-center py-2 text-sm font-['Amiri',serif] text-muted-foreground border-t border-[hsl(160,25%,28%/0.2)] bg-[hsl(40,33%,94%)]"
              dir="rtl"
            >
              {catchword}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
