import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Trophy, HelpCircle, BookOpen, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";

type Lesson = { _id: string; title: string; order?: number };
type QuizQuestion = { _id: string; questionText: string; options: string[] };
type QuizHistoryItem = {
  _id: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  createdAt: string;
};

export default function Quizzes() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [history, setHistory] = useState<QuizHistoryItem[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    score: number;
    correctCount: number;
    totalQuestions: number;
    correctPerQuestion?: boolean[];
  } | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    const load = async () => {
      try {
        const [lessonsRes, historyRes] = await Promise.all([
          axios.get<Lesson[]>("/api/lessons", { headers }),
          axios.get<QuizHistoryItem[]>("/api/quiz/history", { headers }),
        ]);
        if (Array.isArray(lessonsRes.data)) setLessons(lessonsRes.data);
        if (Array.isArray(historyRes.data)) setHistory(historyRes.data);
      } catch {
        setError("Failed to load lessons or history.");
      }
    };
    load();
  }, []);

  const startQuiz = async (lesson: Lesson) => {
    setError("");
    setSelectedLesson(lesson);
    setLoading(true);
    try {
      const { data } = await axios.get<QuizQuestion[]>(`/api/quiz/questions?lessonId=${lesson._id}`, { headers });
      setQuestions(Array.isArray(data) ? data : []);
      setCurrent(0);
      setSelected(null);
      setAnswers([]);
      setShowResult(false);
      setSubmitResult(null);
    } catch {
      setError("Failed to load questions.");
      setSelectedLesson(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
  };

  const handleNext = () => {
    if (selected === null || questions.length === 0) return;
    const newAnswers = [...answers, selected];
    setAnswers(newAnswers);
    setSelected(null);
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      setShowResult(true);
      submitQuiz(newAnswers);
    }
  };

  const submitQuiz = async (finalAnswers: number[]) => {
    if (!selectedLesson || finalAnswers.length !== questions.length) return;
    try {
      const { data } = await axios.post<{
        score: number;
        correctCount: number;
        totalQuestions: number;
        correctPerQuestion?: boolean[];
      }>(
        "/api/quiz/submit",
        {
          lessonId: selectedLesson._id,
          answers: questions.map((q, i) => ({ questionId: q._id, selectedIndex: finalAnswers[i] })),
        },
        { headers }
      );
      setSubmitResult(data);
      const historyRes = await axios.get<QuizHistoryItem[]>("/api/quiz/history", { headers });
      if (Array.isArray(historyRes.data)) setHistory(historyRes.data);
    } catch {
      setSubmitResult({
        score: 0,
        correctCount: 0,
        totalQuestions: questions.length,
      });
    }
  };

  const totalQuestions = questions.length;
  const correctCount = submitResult?.correctCount ?? 0;
  const score = submitResult?.score ?? 0;

  const backToLessons = () => {
    setSelectedLesson(null);
    setQuestions([]);
    setCurrent(0);
    setSelected(null);
    setAnswers([]);
    setShowResult(false);
    setSubmitResult(null);
  };

  const handleRetry = () => {
    if (selectedLesson) {
      setCurrent(0);
      setSelected(null);
      setAnswers([]);
      setShowResult(false);
      setSubmitResult(null);
      startQuiz(selectedLesson);
    }
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-bold mb-2">Tajweed Quizzes</h1>
        <p className="text-muted-foreground mb-8">Test your knowledge with random questions per lesson</p>

        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}

        {!selectedLesson ? (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" /> Choose a lesson
                </CardTitle>
                <p className="text-sm text-muted-foreground">Start a quiz to get 5 random questions for that lesson.</p>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Loading…</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {lessons.map((lesson) => (
                      <Button
                        key={lesson._id}
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={() => startQuiz(lesson)}
                      >
                        <HelpCircle className="w-4 h-4 mr-2 shrink-0" />
                        {lesson.title}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" /> Quiz history
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No quiz attempts yet. Start a quiz above.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((item) => (
                      <li key={item._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 border-b last:border-0">
                        <span className="text-sm font-medium">{item.lessonTitle}</span>
                        <span className="text-sm text-muted-foreground">{item.score}% ({item.correctCount}/{item.totalQuestions})</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        ) : showResult && questions.length > 0 ? (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="max-w-lg mx-auto">
            <Card>
              <CardContent className="pt-8 text-center">
                <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center mx-auto mb-4">
                  <Trophy className="w-10 h-10 text-foreground" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Quiz complete</h2>
                <p className="text-4xl font-extrabold text-primary mb-2">{submitResult?.correctCount ?? correctCount}/{totalQuestions}</p>
                <p className="text-muted-foreground mb-2">{score}%</p>
                <p className="text-muted-foreground mb-6">
                  {score === 100 ? "Perfect! Masha'Allah!" : score >= 60 ? "Great job! Keep practicing!" : "Keep learning, you'll improve!"}
                </p>
                {submitResult?.correctPerQuestion && questions.length > 0 && (
                  <div className="space-y-2 text-left mb-6">
                    {questions.map((q, i) => (
                      <div key={q._id} className="flex items-center gap-2 text-sm">
                        {submitResult.correctPerQuestion[i] ? (
                          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                        <span className="text-muted-foreground truncate">{q.questionText}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={backToLessons}>Back to lessons</Button>
                  <Button onClick={handleRetry}>Try again</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : questions.length > 0 ? (
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">
                {selectedLesson.title} — Question {current + 1} of {questions.length}
              </span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${i < answers.length ? "bg-primary" : i === current ? "bg-gold" : "bg-muted"}`}
                  />
                ))}
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{questions[current].questionText}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions[current].options.map((opt, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(i)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selected === i ? "border-primary bg-primary/5" : "hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm">{opt}</span>
                  </motion.button>
                ))}
                <Button onClick={handleNext} disabled={selected === null} className="w-full mt-4">
                  {current < questions.length - 1 ? "Next question" : "See results"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No questions for this lesson yet. <Button variant="link" className="p-0 h-auto" onClick={backToLessons}>Back to lessons</Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
