import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { checkRecitation } from "@/utils/checkRecitation";

type PracticePhrase = {
  _id: string;
  label: string;
  text: string;
  textForComparison?: string;
  audioUrl?: string; // optional if backend provides
};

export default function Pronunciation() {
  const [phrases, setPhrases] = useState<PracticePhrase[]>([]);
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");

  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [result, setResult] = useState<any>(null);

  const resetLesson = useCallback(() => {
    setResult(null);
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
        <h1 className="text-3xl font-bold mb-2">AI Pronunciation Checker</h1>
        <p className="text-muted-foreground mb-8">Record your recitation and get instant AI-powered Tajweed feedback</p>

        {loadError && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{loadError}</div>}

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
                    resetLesson();
                  }}
                  className={`px-3 py-1 rounded-full text-xs border transition ${
                    phrase._id === selectedPhraseId
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
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
              <p className="text-sm text-muted-foreground mb-2">Reference</p>
              <p className="font-arabic text-3xl text-center" dir="rtl">
                {selectedPhrase.text}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Recitation check (AI)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!isRecording ? (
              <Button type="button" onClick={() => void startRecording()} disabled={checking || !selectedPhrase}>
                Start Recording
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                disabled={checking}
                onClick={async () => {
                  try {
                    setCheckError("");
                    setChecking(true);
                    const blob = await stopRecording();
                    const expectedText = (selectedPhrase?.text || "").trim();
                    const out = await checkRecitation(blob, "pronunciation", expectedText);
                    setResult(out);
                  } catch {
                    setCheckError("Could not process audio, please try again");
                  } finally {
                    setChecking(false);
                  }
                }}
              >
                Stop and Check
              </Button>
            )}

            {checkError && <p className="text-sm text-destructive">{checkError}</p>}

            {result && (
              <div className={result.passed ? "text-green-600" : "text-red-600"}>
                <p>Score: {result.score}</p>
                <p>You said: {result.spokenWord}</p>
                <p>Expected: {result.expectedWord}</p>
                <button onClick={resetLesson} className="underline ml-3">
                  Try Again
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}

