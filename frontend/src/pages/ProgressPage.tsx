import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import axios from "axios";

type ProgressOverview = {
  lessons: { total: number; completed: number };
  quizzes: { totalAttempts: number; avgScore: number | null };
  recitations: { total: number };
  last7Days: { date: string; label: string; quizzes: number; avgQuizScore: number | null; recitations: number }[];
  streakDays: number;
};

const COLORS = ["hsl(160, 60%, 28%)", "hsl(var(--muted))"];

export default function ProgressPage() {
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const { data } = await axios.get<ProgressOverview>("/api/progress/overview", { headers });
        setOverview(data);
      } catch {
        setError("Failed to load your progress.");
      }
    };
    load();
  }, []);

  const lessonsCompleted = overview?.lessons.completed ?? 0;
  const totalLessons = overview?.lessons.total ?? 0;
  const lessonsPieData = [
    { name: "Completed", value: lessonsCompleted },
    { name: "Remaining", value: Math.max(totalLessons - lessonsCompleted, 0) },
  ];

  const weekly = overview?.last7Days ?? [];
  const barData = weekly.map((d) => ({
    day: d.label,
    quizzes: d.quizzes,
    recitations: d.recitations,
  }));

  const avgPronunciation = overview?.recitations.total ? 70 : 0; // placeholder until we store recitation scores

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-bold mb-2">Your Progress</h1>
        <p className="text-muted-foreground mb-8">Track your Tajweed learning journey</p>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-lg">Quiz Accuracy This Week</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgQuizScore" stroke="hsl(160, 60%, 28%)" strokeWidth={3} dot={{ fill: "hsl(160, 60%, 28%)", r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Lessons Progress</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={lessonsPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" strokeWidth={0}>
                    {lessonsPieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <p className="text-2xl font-bold">
                {lessonsCompleted}/{totalLessons || "—"}
              </p>
              <p className="text-sm text-muted-foreground">Lessons Completed</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Activity Breakdown (Last 7 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="quizzes" fill="hsl(42, 80%, 55%)" radius={[4, 4, 0, 0]} name="Quizzes" />
                  <Bar dataKey="recitations" fill="hsl(160, 60%, 28%)" radius={[4, 4, 0, 0]} name="Recitations" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Pronunciation Practice</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Total recitations</span>
                <span className="font-semibold">{overview?.recitations.total ?? 0}</span>
              </div>
              <Progress value={avgPronunciation} className="h-2" />
              <p className="text-xs text-muted-foreground">
                This bar will become more precise when we start storing detailed pronunciation scores.
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
