import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Mail, Lock, User, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

type AuthView = "login" | "signup" | "verify" | "forgot" | "reset";

export default function Auth() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode");

  const [authView, setAuthView] = useState<AuthView>(mode === "login" ? "login" : "signup");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (mode === "login") setAuthView("login");
    else if (mode === "signup") setAuthView("signup");
  }, [mode]);

  const goLogin = () => {
    setAuthView("login");
    navigate("/auth?mode=login", { replace: true });
  };
  const goSignup = () => {
    setAuthView("signup");
    navigate("/auth?mode=signup", { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post("/api/auth/register", {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      toast({
        title: "Check your email",
        description: "We sent a 6-digit code. Enter it below to activate your account.",
      });
      setVerifyCode("");
      setAuthView("verify");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Registration failed. Try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      toast({ title: "Enter the code from your email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/auth/verify-email", {
        email: email.trim().toLowerCase(),
        code: verifyCode.trim(),
      });
      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      toast({ title: "Email verified", description: "Welcome! Redirecting…" });
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Invalid or expired code.";
      toast({ title: "Verification failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    try {
      await axios.post("/api/auth/resend-verification", {
        email: email.trim().toLowerCase(),
      });
      toast({ title: "Code sent", description: "Check your inbox (and spam folder)." });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not resend.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      toast({ title: "Welcome back!", description: "Redirecting to dashboard…" });
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; code?: string; email?: string } } };
      const payload = ax.response?.data;
      if (payload?.code === "EMAIL_NOT_VERIFIED" && payload.email) {
        setEmail(payload.email);
        setAuthView("verify");
        setVerifyCode("");
        toast({
          title: "Verify your email",
          description: payload.message || "Enter the code we sent you, or resend a new one.",
        });
        return;
      }
      const message = payload?.message || "Login failed. Check your credentials.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Enter your email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });
      toast({ title: "Check your email", description: data.message });
      setResetCode("");
      setNewPassword("");
      setAuthView("reset");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Request failed.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword) {
      toast({ title: "Fill in code and new password", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await axios.post("/api/auth/reset-password", {
        email: email.trim().toLowerCase(),
        code: resetCode.trim(),
        newPassword,
      });
      toast({ title: "Password updated", description: "You can sign in now." });
      setPassword("");
      goLogin();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Reset failed.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    authView === "login"
      ? "Welcome Back"
      : authView === "signup"
        ? "Create Account"
        : authView === "verify"
          ? "Verify your email"
          : authView === "forgot"
            ? "Forgot password"
            : "Set new password";

  const subtitle =
    authView === "login"
      ? "Sign in to continue learning"
      : authView === "signup"
        ? "Start your Tajweed journey today"
        : authView === "verify"
          ? `Enter the 6-digit code sent to ${email || "your email"}`
          : authView === "forgot"
            ? "We’ll email you a reset code"
            : "Enter the code from your email and choose a new password";

  return (
    <div className="min-h-screen flex geometric-pattern">
      <div className="hidden lg:flex flex-1 emerald-gradient items-center justify-center p-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="w-16 h-16 rounded-2xl gold-gradient flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-primary-foreground mb-4">Husn-ul-Tilawat</h2>
          <p className="font-arabic text-2xl text-primary-foreground/80 mb-4">إِقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ</p>
          <p className="text-primary-foreground/70 max-w-sm">Read in the name of your Lord who created — Al-Alaq 96:1</p>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground mb-8">{subtitle}</p>

          {authView === "signup" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="Your full name"
                    className="pl-10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Sending code…" : "Create account"}
              </Button>
            </form>
          )}

          {authView === "verify" && (
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <Label htmlFor="code">Verification code</Label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="pl-10 tracking-widest font-mono text-lg"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Code expires in 15 minutes.</p>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Verifying…" : "Verify & continue"}
              </Button>
              <Button type="button" variant="outline" className="w-full" disabled={submitting} onClick={handleResend}>
                Resend code
              </Button>
              <button type="button" onClick={goSignup} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
                Back to sign up
              </button>
            </form>
          )}

          {authView === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email-login"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="password-login">Password</Label>
                  <button type="button" className="text-xs text-primary font-medium hover:underline" onClick={() => setAuthView("forgot")}>
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password-login"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Signing In…" : "Sign In"}
              </Button>
            </form>
          )}

          {authView === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <Label htmlFor="femail">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="femail"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset code"}
              </Button>
              <button type="button" onClick={goLogin} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>
            </form>
          )}

          {authView === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="remail">Email</Label>
                <Input id="remail" type="email" value={email} readOnly className="bg-muted/50" />
              </div>
              <div>
                <Label htmlFor="rcode">Reset code</Label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="rcode"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="pl-10 tracking-widest font-mono text-lg"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="npw">New password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="npw"
                    name="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pl-10 pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Updating…" : "Update password"}
              </Button>
              <button type="button" onClick={() => setAuthView("forgot")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" />
                Request code again
              </button>
            </form>
          )}

          {(authView === "login" || authView === "signup") && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {authView === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button type="button" onClick={authView === "login" ? goSignup : goLogin} className="text-primary font-semibold hover:underline">
                {authView === "login" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
