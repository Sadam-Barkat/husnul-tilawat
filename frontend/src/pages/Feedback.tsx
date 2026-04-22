import { useState } from "react";
import { motion } from "framer-motion";
import { Star, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/DashboardLayout";
import axios from "axios";

export default function Feedback() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!rating || !text) return;

    setSubmitting(true);
    setError("");
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        setError("You must be logged in to submit feedback.");
        setSubmitting(false);
        return;
      }
      await axios.post(
        "/api/feedback",
        { rating, message: text.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-3xl font-bold mb-2">Feedback</h1>
        <p className="text-muted-foreground mb-8">Help us improve your learning experience</p>

        <div className="max-w-lg mx-auto">
          {submitted ? (
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <Card>
                <CardContent className="pt-8 text-center">
                  <div className="w-16 h-16 rounded-full emerald-gradient flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">JazakAllahu Khairan!</h2>
                  <p className="text-muted-foreground mb-6">Thank you for your feedback. It helps us serve you better.</p>
                  <Button onClick={() => { setSubmitted(false); setRating(0); setText(""); }}>Submit Another</Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <Card>
              <CardHeader><CardTitle>Rate Your Experience</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map(i => (
                    <button key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => setRating(i)} className="transition-transform hover:scale-110">
                      <Star
                        className={`w-8 h-8 ${
                          i <= (hover || rating)
                            ? "fill-gold text-gold"
                            : "text-gold/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea placeholder="Tell us about your experience with Husn-ul-Tilawat..." value={text} onChange={e => setText(e.target.value)} rows={5} />
                <Button onClick={handleSubmit} className="w-full gap-2" disabled={!rating || !text || submitting}>
                  <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Feedback"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
