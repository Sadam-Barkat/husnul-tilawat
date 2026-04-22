import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Mic, Trophy, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import axios from "axios";

type ProgressOverview = {
  lessons: { total: number; completed: number };
  quizzes: { totalAttempts: number; avgScore: number | null };
  recitations: { total: number };
  last7Days: { date: string; label: string; quizzes: number; avgQuizScore: number | null; recitations: number }[];
  streakDays: number;
};

export default function Dashboard() {
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
        setError("Failed to load your progress. Showing sample data.");
      }
    };
    load();
  }, []);

  const storedUser = (() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const firstName =
    storedUser?.name?.trim().split(" ")[0] ||
    storedUser?.email?.split("@")[0] ||
    "User";

  const lessonsCompleted = overview ? overview.lessons.completed : 0;
  const totalLessons = overview ? overview.lessons.total : 0;
  const lessonsPct = totalLessons ? Math.round((lessonsCompleted / totalLessons) * 100) : 0;
  const avgQuizScore = overview?.quizzes.avgScore ?? null;
  const totalRecitations = overview?.recitations.total ?? 0;
  const streakDays = overview?.streakDays ?? 0;

  const stats = [
    { label: "Lessons Completed", value: `${lessonsCompleted}/${totalLessons || "—"}`, icon: BookOpen, pct: lessonsPct },
    { label: "Quiz Average", value: avgQuizScore != null ? `${avgQuizScore}%` : "—", icon: Trophy, pct: avgQuizScore ?? 0 },
    { label: "Recitations Practiced", value: `${totalRecitations}`, icon: Mic, pct: totalRecitations ? 100 : 0 },
    { label: "Weekly Streak", value: `${streakDays} day${streakDays === 1 ? "" : "s"}`, icon: TrendingUp, pct: Math.min(streakDays * 15, 100) },
  ];

  const weeklyData =
    overview?.last7Days?.map((d) => ({
      day: d.label,
      lessons: d.quizzes || 0,
      score: d.avgQuizScore ?? 0,
    })) ?? [];

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-1">Welcome, {firstName}! 👋</h1>
        <p className="text-muted-foreground mb-8">Continue your Tajweed journey</p>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg emerald-gradient flex items-center justify-center">
                      <s.icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                      <p className="text-xl font-bold">{s.value}</p>
                    </div>
                  </div>
                  <Progress value={s.pct} className="h-2" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Activity This Week</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Bar dataKey="lessons" name="Quizzes" fill="hsl(160, 60%, 28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Quiz Score Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" name="Avg quiz score" stroke="hsl(42, 80%, 55%)" strokeWidth={2} dot={{ fill: "hsl(42, 80%, 55%)" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
