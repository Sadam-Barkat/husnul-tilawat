import { useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Mail, Eye, EyeOff, Sparkles, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { setAdminSession, getAdminToken, clearAdminSession, getAdminUserDisplay } from "@/lib/adminAuth";

function subscribeAdminSession(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener("admin-session", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("admin-session", cb);
  };
}

function getSessionSnapshot() {
  return getAdminToken() ? "1" : "";
}

/**
 * VIP admin-only login at /admin — never auto-redirects to dashboard.
 * Session is tab-scoped (sessionStorage); close tab = must log in again.
 */
export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasSession = useSyncExternalStore(subscribeAdminSession, getSessionSnapshot, () => "");

  const bumpSession = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("admin-session"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Enter email and password", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      if (data.user?.role !== "admin") {
        toast({
          title: "Administrator access only",
          description: "This portal is restricted. Use an account with the admin role.",
          variant: "destructive",
        });
        return;
      }
      if (data.token) setAdminSession(data.token, data.user);
      bumpSession();
      toast({ title: "Welcome, Administrator" });
      setTimeout(() => navigate("/admin/dashboard", { replace: true }), 0);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Login failed. Check your credentials.";
      toast({ title: "Access denied", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050807] text-zinc-100 flex flex-col lg:flex-row overflow-hidden">
      {/* VIP left panel */}
      <div className="lg:w-[46%] relative flex flex-col justify-between p-10 lg:p-14 border-b lg:border-b-0 lg:border-r border-amber-500/20">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, rgba(212,175,55,0.4) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(16,185,129,0.25) 0%, transparent 45%)`,
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/25 ring-2 ring-amber-400/30">
              <Shield className="w-7 h-7 text-zinc-950" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-amber-500/90 font-semibold">Restricted</p>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-transparent">
              Husn-ul-Tilawat
              <br />
              <span className="text-zinc-300 text-2xl lg:text-3xl font-semibold">Control Center</span>
            </h2>
            <p className="text-zinc-400 max-w-md text-sm leading-relaxed">
              Manage learners, content, reviews, and pronunciation data. This area is not linked from the public site.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {["Users", "Lessons", "Feedback", "Quiz"].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800/80 text-amber-200/90 border border-amber-500/20"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
        <p className="relative z-10 text-zinc-600 text-xs mt-10 lg:mt-0">
          © Husn-ul-Tilawat · Administrator access only
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-gradient-to-b from-zinc-950 to-[#0a120e]">
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm p-8 shadow-2xl shadow-black/40">
            <div className="mb-8 text-center lg:text-left">
              <p className="text-amber-500/80 text-xs font-semibold tracking-widest uppercase mb-2">Secure sign-in</p>
              <h3 className="text-2xl font-bold text-white">Administrator login</h3>
              <p className="text-zinc-500 text-sm mt-2">No self-registration — credentials issued separately.</p>
            </div>

            {hasSession ? (
              <div className="space-y-4 rounded-xl border border-amber-500/25 bg-zinc-950/60 p-5">
                <p className="text-sm text-zinc-300">
                  Active session{getAdminUserDisplay() ? ` (${getAdminUserDisplay()})` : ""} in this tab. Dashboard is not opened automatically from this URL.
                </p>
                <Button
                  type="button"
                  className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-semibold gap-2"
                  onClick={() => navigate("/admin/dashboard", { replace: true })}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Continue to dashboard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800 gap-2"
                  onClick={() => {
                    clearAdminSession();
                    bumpSession();
                    toast({ title: "Signed out", description: "Sign in again to access admin." });
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Sign out (this tab)
                </Button>
              </div>
            ) : null}

            {!hasSession ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="admin-email" className="text-zinc-300">
                  Email
                </Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    placeholder="admin@yourdomain.com"
                    className="pl-10 bg-zinc-950/80 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="admin-password" className="text-zinc-300">
                  Password
                </Label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <Input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-10 pr-10 bg-zinc-950/80 border-zinc-700 text-white placeholder:text-zinc-600 focus-visible:ring-amber-500/40"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-semibold shadow-lg shadow-amber-900/30 border-0"
              >
                {submitting ? "Verifying…" : "Enter dashboard"}
              </Button>
            </form>
            ) : null}

            <p className="text-center text-sm text-zinc-500 mt-8">
              <Link to="/" className="text-amber-600/90 hover:text-amber-400 transition-colors">
                ← Back to public site
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
