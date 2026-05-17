import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import {
  compareLessonPractice,
  getPhraseExpectedPlain,
  type LessonPracticeResult,
} from "@/utils/compareLessonPractice";

type PracticePhrase = {
  _id: string;
  label: string;
  text: string;
  textForComparison?: string;
  audioUrl?: string;
};

export default function Pronunciation() {
  const [phrases, setPhrases] = useState<PracticePhrase[]>([]);
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const { isListening, interim, startListening, stopListening, listenDurationMs, peekTranscript } =
    useSpeechRecognition("phrase");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [checkResult, setCheckResult] = useState<LessonPracticeResult | null>(null);

  const resetCheck = useCallback(() => {
    setCheckResult(null);
    setCheckError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get<PracticePhrase[]>("/api/practice-phrases");
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setPhrases(data);
          setSelectedPhraseId((prev) => prev ?? data[0]._id);
          setLoadError("");
        } else {
          setPhrases([]);
          setSelectedPhraseId(null);
          setLoadError("No pronunciation topics found. Please add practice phrases in Admin → Phrases.");
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not load pronunciation topics. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPhrase = phrases.find((p) => p._id === selectedPhraseId) || null;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-bold mb-2">Pronunciation Practice</h1>
        <p className="text-muted-foreground mb-8">
          Recite the ayah in Arabic. We compare your speech to the plain text stored in the database (no
          harakat) — no AI server required.
        </p>

        {loadError && <motion.div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{loadError}</motion.div>}

        {phrases.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">Select a topic:</p>
            <div className="flex flex-wrap gap-2">
              {phrases.map((phrase) => (
                <button
                  key={phrase._id}
                  type="button"
                  onClick={() => {
                    setSelectedPhraseId(phrase._id);
                    resetCheck();
                  }}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs border transition",
                    phrase._id === selectedPhraseId
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {phrase.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPhrase && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-2 text-center">Reference (with harakat)</p>
              <p className="font-arabic text-3xl text-center" dir="rtl">
                {selectedPhrase.text}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" /> Recitation check
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              className="w-full sm:w-auto"
              variant={isListening ? "destructive" : "default"}
              disabled={checking || !selectedPhrase}
              onClick={async () => {
                if (!selectedPhrase) return;

                if (!isListening) {
                  resetCheck();
                  try {
                    await startListening();
                  } catch (e) {
                    setCheckError(
                      e instanceof Error
                        ? e.message
                        : "Could not start speech recognition. Use Chrome or Edge and allow the microphone.",
                    );
                  }
                  return;
                }

                try {
                  setCheckError("");
                  setChecking(true);
                  if (listenDurationMs() < 1200) {
                    await new Promise((r) => setTimeout(r, 1200 - listenDurationMs()));
                  }
                  const fromStop = (await stopListening()).trim();
                  const heard = fromStop || peekTranscript() || interim.trim();
                  if (!heard) {
                    setCheckError(
                      "No speech detected. Use Chrome or Edge, allow the microphone, recite the ayah clearly, then tap Stop & check.",
                    );
                    return;
                  }
                  const expectedPlain = getPhraseExpectedPlain(selectedPhrase);
                  const result = compareLessonPractice(heard, expectedPlain);
                  setCheckResult(result);
                } catch (e) {
                  setCheckError(e instanceof Error ? e.message : "Could not recognize speech. Try again.");
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking
                ? "Checking…"
                : isListening
                  ? "Stop & check"
                  : "Start speaking"}
            </Button>

            {(isListening || (interim && !checking)) && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-primary">{isListening ? "Listening…" : "Heard"}</p>
                <p className="font-arabic text-xl mt-1 text-foreground" dir="rtl">
                  {interim || "…"}
                </p>
              </div>
            )}

            {checkError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {checkError}
              </div>
            )}

            {checkResult && selectedPhrase && (
              <div
                className={cn(
                  "rounded-xl border px-4 py-4 space-y-3",
                  checkResult.passed
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/30 bg-red-500/5",
                )}
              >
                <div className="flex items-center gap-2">
                  {checkResult.passed ? (
                    <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                  )}
                  <p
                    className={cn(
                      "text-lg font-semibold",
                      checkResult.passed ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300",
                    )}
                  >
                    {checkResult.passed ? "Correct — well done!" : "Not quite — try again"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-background/60 px-3 py-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Match</p>
                    <p className="font-semibold">{checkResult.similarity}%</p>
                  </div>
                  <div className="rounded-lg bg-background/60 px-3 py-2">
                    <p className="text-muted-foreground text-xs mb-0.5">Score</p>
                    <p className="font-semibold">{checkResult.score}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm border-t pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-muted-foreground shrink-0">You said:</span>
                    <span className="font-arabic text-2xl text-foreground" dir="rtl">
                      {checkResult.spokenWord || "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-muted-foreground shrink-0">Expected:</span>
                    <span className="font-arabic text-2xl text-primary" dir="rtl">
                      {selectedPhrase.text}
                    </span>
                  </div>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={resetCheck} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try again
                </Button>
              </div>
            )}

            {!checkResult && !checkError && !isListening && !checking && selectedPhrase && (
              <p className="text-sm text-muted-foreground">
                Tap <span className="font-medium text-foreground">Start speaking</span>, recite the ayah in Arabic,
                then tap <span className="font-medium text-foreground">Stop & check</span>.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
