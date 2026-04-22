import { BookOpen, Mic, HelpCircle, BarChart3, MessageCircle, Home, LogOut, ScrollText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Qur'an", url: "/quran", icon: ScrollText },
  { title: "Lessons", url: "/lessons", icon: BookOpen },
  { title: "AI Pronunciation", url: "/pronunciation", icon: Mic },
  { title: "Quizzes", url: "/quizzes", icon: HelpCircle },
  { title: "Progress", url: "/progress", icon: BarChart3 },
  { title: "Feedback", url: "/feedback", icon: MessageCircle },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent>
        <div className="p-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-foreground" />
          </div>
          {!collapsed && <span className="font-bold text-sidebar-foreground">Husn-ul-Tilawat</span>}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
              }
              navigate("/auth?mode=login");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> {!collapsed && "Log Out"}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-[100dvh] min-h-0 flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <header className="h-14 shrink-0 flex items-center border-b px-4 bg-background/80 backdrop-blur-md z-40">
            <SidebarTrigger className="mr-4" />
            <span className="text-sm text-muted-foreground">Husn-ul-Tilawat — AI Tajweed Learning</span>
          </header>
          <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 pb-10">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
