import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectLayout from "./components/ProjectLayout";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import BoardPage from "./pages/BoardPage";
import MembersPage from "./pages/MembersPage";
import DMPage from "./pages/DMPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />

            {/* Project routes with sidebar layout */}
            <Route path="/projects/:id" element={<ProtectedRoute><ProjectLayout /></ProtectedRoute>}>
              <Route index element={<ProjectDetailPage />} />
              <Route path="boards/:boardId" element={<BoardPage />} />
              <Route path="dm" element={<DMPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="settings" element={<div className="p-8 text-center text-muted-foreground">프로젝트 설정은 다음 단계에서 구현됩니다</div>} />
              <Route path="admin/allocation" element={<div className="p-8 text-center text-muted-foreground">배분 관리는 다음 단계에서 구현됩니다</div>} />
            </Route>

            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
