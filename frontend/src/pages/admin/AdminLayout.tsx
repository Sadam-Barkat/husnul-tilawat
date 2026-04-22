import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Shield, LayoutDashboard, Users, MessageSquare, BookOpen, Mic, HelpCircle, ScrollText, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearAdminSession, getAdminToken } from "@/lib/adminAuth";
import { useEffect, useState } from "react";

const nav = [
  { to: "/admin/dashboard", end: true, label: "Overview", icon: LayoutDashboard },
  { to: "/admin/dashboard/users", label: "Learners", icon: Users },
  { to: "/admin/dashboard/feedback", label: "Reviews", icon: MessageSquare },
  { to: "/admin/dashboard/lessons", label: "Lessons", icon: BookOpen },
  { to: "/admin/dashboard/phrases", label: "Pronunciation", icon: Mic },
  { to: "/admin/dashboard/quiz", label: "Quiz questions", icon: HelpCircle },
  { to: "/admin/dashboard/recitations", label: "Recitations", icon: ScrollText },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("Admin");

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem("adminUser") : null;
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.name) setAdminName(u.name);
      }
    } catch {
      /* ignore */
    }
    const t = getAdminToken();
    if (!t) {
      navigate("/admin", { replace: true });
      return;
    }
    /* Do not ping /api here — any failure (network, Strict Mode double-mount) was logging users out right after login. */
  }, [navigate]);

  const logout = () => {
    clearAdminSession();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("admin-session"));
    navigate("/admin", { replace: true });
  };

  return (
    <div className="h-[100dvh] min-h-0 flex overflow-hidden bg-[#0c0f0d] text-zinc-100">
      <aside className="w-60 shrink-0 min-h-0 border-r border-amber-500/15 bg-[#080a09] flex flex-col">
        <div className="p-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-zinc-950" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-amber-500/90 font-semibold">Admin</p>
              <p className="text-sm font-semibold text-white truncate max-w-[140px]">{adminName}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
          {nav.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800/80">
          <Button
            variant="ghost"
            className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-950/30"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto pb-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
