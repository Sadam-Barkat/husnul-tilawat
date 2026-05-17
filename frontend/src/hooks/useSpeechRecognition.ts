import { useCallback, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

const LANG_TRY_ORDER_LESSON = ["en-US", "ur-PK", "ar-SA"] as const;
const LANG_TRY_ORDER_PHRASE = ["ar-SA", "ur-PK", "en-US"] as const;

export type SpeechRecognitionMode = "lesson" | "phrase";

function getRecognitionCtor(): (new () => AnyRecognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => AnyRecognition;
    webkitSpeechRecognition?: new () => AnyRecognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ResultEvent = {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal?: boolean; 0: { transcript: string } } };
};

/** Append new final segments (Web Speech API spec pattern). */
function applyResultEvent(
  event: ResultEvent,
  finals: { current: string },
  interimOut: { current: string },
) {
  let interim = "";
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const piece = event.results[i]?.[0]?.transcript ?? "";
    if (!piece) continue;
    if (event.results[i]?.isFinal) {
      finals.current += piece;
    } else {
      interim += piece;
    }
  }
  interimOut.current = interim;
}

/**
 * Short second pass when the first session returned nothing (common on Windows + ar-SA).
 */
function listenBurst(Ctor: new () => AnyRecognition, lang: string, ms: number): Promise<string> {
  return new Promise((resolve) => {
    const rec = new Ctor();
    const finals = { current: "" };
    const interim = { current: "" };
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      resolve((finals.current + interim.current).trim());
    };

    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.lang = lang;

    const timer = window.setTimeout(() => {
      try {
        rec.stop();
      } catch {
        done();
      }
    }, ms);

    rec.onresult = (event: ResultEvent) => {
      applyResultEvent(event, finals, interim);
    };

    rec.onend = () => {
      window.clearTimeout(timer);
      done();
    };

    rec.onerror = (event: { error?: string }) => {
      window.clearTimeout(timer);
      if (event.error === "no-speech" || event.error === "aborted") {
        done();
        return;
      }
      done();
    };

    try {
      rec.start();
    } catch {
      window.clearTimeout(timer);
      done();
    }
  });
}

/**
 * Lesson letter practice — browser speech only (no Python).
 * Optimized for Windows: en-US letter names, mic priming, retry if first pass is empty.
 */
export function useSpeechRecognition(mode: SpeechRecognitionMode = "lesson") {
  const langOrder = mode === "phrase" ? LANG_TRY_ORDER_PHRASE : LANG_TRY_ORDER_LESSON;
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<AnyRecognition | null>(null);
  const finalsRef = useRef("");
  const interimRef = useRef("");
  const langRef = useRef<string>(langOrder[0]);
  const startedAtRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const syncDisplay = useCallback(() => {
    const text = (finalsRef.current + interimRef.current).trim();
    setInterim(text);
    return text;
  }, []);

  const startListening = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      throw new Error("Speech recognition is not supported in this browser. Try Chrome or Edge.");
    }

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      throw new Error("Microphone access is required. Allow the mic in browser settings and reload.");
    }

    finalsRef.current = "";
    interimRef.current = "";
    setInterim("");
    startedAtRef.current = Date.now();
    langRef.current = langOrder[0];

    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.lang = langRef.current;

    rec.onresult = (event: ResultEvent) => {
      applyResultEvent(event, finalsRef, interimRef);
      syncDisplay();
    };

    rec.onerror = (event: { error?: string; message?: string }) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      console.warn("[speech]", event.error, event.message);
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      recRef.current = null;
      const msg = e instanceof Error ? e.message : String(e);
      if (/already started|not-allowed/i.test(msg)) {
        throw new Error("Speech recognition is busy. Wait a moment and try again.");
      }
      throw e;
    }
    setIsListening(true);
  }, [syncDisplay, langOrder]);

  const peekTranscript = useCallback(
    () => (finalsRef.current + interimRef.current).trim(),
    [],
  );

  const stopListening = useCallback(async (): Promise<string> => {
    const Ctor = getRecognitionCtor();
    const rec = recRef.current;
    const collectLocal = () => (finalsRef.current + interimRef.current).trim();
    const stopWaitMs = mode === "phrase" ? 2200 : 1500;

    if (rec) {
      await Promise.race([
        new Promise<void>((resolve) => {
          const finish = () => {
            recRef.current = null;
            setIsListening(false);
            resolve();
          };

          rec.onend = () => window.setTimeout(finish, 150);
          rec.onerror = () => window.setTimeout(finish, 100);

          try {
            rec.stop();
          } catch {
            finish();
          }
        }),
        wait(stopWaitMs).then(() => {
          try {
            rec.abort();
          } catch {
            /* ignore */
          }
          recRef.current = null;
          setIsListening(false);
        }),
      ]);
    } else {
      setIsListening(false);
    }

    let text = collectLocal();
    if (text) {
      setInterim(text);
      return text;
    }

    if (!Ctor) return "";

    const burstMs = mode === "phrase" ? 2200 : 2800;
    const langsToTry = mode === "phrase" ? langOrder.slice(0, 1) : langOrder;
    for (const lang of langsToTry) {
      const burst = await listenBurst(Ctor, lang, burstMs);
      if (burst) {
        finalsRef.current = burst;
        interimRef.current = "";
        setInterim(burst);
        return burst;
      }
    }

    setInterim("");
    return "";
  }, [langOrder, mode]);

  const cancelListening = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
    recRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsListening(false);
    setInterim("");
    finalsRef.current = "";
    interimRef.current = "";
  }, []);

  const listenDurationMs = useCallback(() => {
    if (!startedAtRef.current) return 0;
    return Date.now() - startedAtRef.current;
  }, []);

  return {
    isListening,
    interim,
    startListening,
    stopListening,
    cancelListening,
    listenDurationMs,
    peekTranscript,
  };
}
