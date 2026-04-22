import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Mic, BarChart3, MessageCircle, Star, ChevronRight, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const features = [
  { icon: BookOpen, title: "Interactive Lessons", desc: "Step-by-step Tajweed lessons with visual explanations and Arabic text." },
  { icon: Mic, title: "AI Pronunciation Checker", desc: "Record your recitation and get instant AI-powered feedback." },
  { icon: Volume2, title: "Voice Feedback", desc: "Hear correct pronunciation with detailed audio corrections." },
  { icon: BarChart3, title: "Progress Analytics", desc: "Track your learning journey with detailed charts and milestones." },
];

type FeedbackDoc = {
  _id: string;
  rating: number;
  message: string;
  userName?: string;
};

export default function Landing() {
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState<{ name: string; text: string; rating: number }[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 3;

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        const { data } = await axios.get<FeedbackDoc[]>("/api/feedback?limit=50");
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((f) => ({
            name: f.userName || "Learner",
            text: f.message,
            rating: Math.min(Math.max(f.rating || 5, 1), 5),
          }));
          setTestimonials(mapped);
        }
      } catch {
        // Ignore errors and keep any existing testimonials (which default to empty)
      }
    };
    fetchFeedback();
  }, []);

  const totalPages = Math.max(1, Math.ceil(testimonials.length / pageSize));
  const currentSlice = testimonials.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg emerald-gradient flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Husn-ul-Tilawat</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth?mode=login")}>Log In</Button>
            <Button onClick={() => navigate("/auth?mode=signup")}>Sign Up</Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 geometric-pattern">
        <div className="container mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <p className="text-sm font-semibold tracking-widest uppercase text-gold mb-4">AI-Powered Qur'an Learning</p>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 max-w-3xl mx-auto">
              Learn <span className="text-primary">Tajweed</span> with{" "}
              <span className="text-gold">AI Feedback</span>
            </h1>
            <p className="font-arabic text-2xl md:text-3xl text-muted-foreground mb-4 dir-rtl">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
              Practice Qur'anic recitation and get instant pronunciation corrections powered by advanced AI.
            </p>
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
                <Button size="lg" className="text-lg px-8" onClick={() => navigate("/auth?mode=signup")}>
                  Get started <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8" onClick={() => navigate("/auth?mode=login")}>
                  Log in
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Free to use — create an account to save your progress.</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Everything You Need to Master Tajweed</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-card rounded-xl p-6 border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-lg emerald-gradient flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Loved by Learners Worldwide</h2>
          {testimonials.length === 0 ? (
            <p className="text-center text-muted-foreground">
              No feedback has been submitted yet. Be the first to share your experience!
            </p>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-6">
                {currentSlice.map((t, i) => (
                  <motion.div
                    key={`${t.name}-${i}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-card rounded-xl p-6 border"
                  >
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-gold text-gold" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4">"{t.text}"</p>
                    <p className="font-semibold">{t.name}</p>
                  </motion.div>
                ))}
              </div>
              {testimonials.length > pageSize && (
            <div className="flex justify-center mt-8 gap-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next
              </Button>
            </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 border-t">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>© 2026 Husn-ul-Tilawat. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
