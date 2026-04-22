import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Lessons from "./pages/Lessons";
import Pronunciation from "./pages/Pronunciation";
import Quizzes from "./pages/Quizzes";
import ProgressPage from "./pages/ProgressPage";
import Feedback from "./pages/Feedback";
import Quran from "./pages/Quran";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminFeedbackPage from "./pages/admin/AdminFeedbackPage";
import AdminLessonsPage from "./pages/admin/AdminLessonsPage";
import AdminPhrasesPage from "./pages/admin/AdminPhrasesPage";
import AdminQuizPage from "./pages/admin/AdminQuizPage";
import AdminRecitationsPage from "./pages/admin/AdminRecitationsPage";
import { getAdminToken } from "./lib/adminAuth";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (!token) {
    return <Navigate to="/auth?mode=login" replace />;
  }

  return children;
};

const AdminProtectedRoute = ({ children }: { children: JSX.Element }) => {
  if (!getAdminToken()) {
    return <Navigate to="/admin" replace />;
  }
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="lessons" element={<AdminLessonsPage />} />
            <Route path="phrases" element={<AdminPhrasesPage />} />
            <Route path="quiz" element={<AdminQuizPage />} />
            <Route path="recitations" element={<AdminRecitationsPage />} />
          </Route>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lessons"
            element={
              <ProtectedRoute>
                <Lessons />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pronunciation"
            element={
              <ProtectedRoute>
                <Pronunciation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes"
            element={
              <ProtectedRoute>
                <Quizzes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <ProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <Feedback />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quran"
            element={
              <ProtectedRoute>
                <Quran />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
