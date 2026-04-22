import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { adminAuthHeaders, clearAdminSession } from "@/lib/adminAuth";
import { Users, BookOpen, MessageSquare, Mic, HelpCircle, ScrollText, Award } from "lucide-react";

type Stats = {
  users: number;
  admins: number;
  lessons: number;
  feedback: number;
  practicePhrases: number;
  quizQuestions: number;
  recitations: number;
  quizAttempts: number;
};

export default function AdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    axios
      .get<Stats>("/api/admin/stats", { headers: adminAuthHeaders() })
      .then(({ data }) => setStats(data))
      .catch((e) => {
        const status = (e as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          clearAdminSession();
          navigate("/admin", { replace: true });
          return;
        }
        setErr("Could not load stats.");
      });
  }, [navigate]);

  const cards = stats
    ? [
        {
          label: "Learners",
          value: stats.users,
          sub: stats.admins > 0 ? `${stats.admins} admin account(s) · not counted above` : undefined,
          icon: Users,
        },
        { label: "Lessons", value: stats.lessons, icon: BookOpen },
        { label: "Reviews", value: stats.feedback, icon: MessageSquare },
        { label: "Pronunciation phrases", value: stats.practicePhrases, icon: Mic },
        { label: "Quiz questions", value: stats.quizQuestions, icon: HelpCircle },
        { label: "Recitations logged", value: stats.recitations, icon: ScrollText },
        { label: "Quiz attempts", value: stats.quizAttempts, icon: Award },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
      <p className="text-zinc-500 text-sm mb-8">Platform snapshot</p>
      {err && <p className="text-red-400 text-sm mb-4">{err}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-amber-500/20 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-zinc-400 text-sm">{label}</span>
              <Icon className="w-5 h-5 text-amber-500/70" />
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
            {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
