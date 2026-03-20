import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectLayout from "./components/ProjectLayout";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import BoardPage from "./pages/BoardPage";
import MembersPage from "./pages/MembersPage";
import DMPage from "./pages/DMPage";
import NotificationsPage from "./pages/NotificationsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import ProjectSettingsPage from "./pages/ProjectSettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // 권한/인증 에러는 재시도하지 않음
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('permission denied') || msg.includes('jwt expired') || msg.includes('invalid login')) {
            return false;
          }
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      staleTime: 1000 * 60, // 1분
      refetchOnWindowFocus: true,
      networkMode: 'online', // 오프라인 시 자동 일시정지, 복구 시 재시도
    },
    mutations: {
      retry: 1,
      retryDelay: 2000,
      networkMode: 'online',
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <OfflineBanner />
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

              {/* Project routes with sidebar layout */}
              <Route path="/projects/:id" element={<ProtectedRoute><ProjectLayout /></ProtectedRoute>}>
                <Route index element={<ErrorBoundary><ProjectDetailPage /></ErrorBoundary>} />
                <Route path="boards/:boardId" element={<ErrorBoundary><BoardPage /></ErrorBoundary>} />
                <Route path="dm" element={<ErrorBoundary><DMPage /></ErrorBoundary>} />
                <Route path="members" element={<ErrorBoundary><MembersPage /></ErrorBoundary>} />
                <Route path="settings" element={<ErrorBoundary><ProjectSettingsPage /></ErrorBoundary>} />
                <Route path="admin/allocation" element={<div className="p-8 text-center text-muted-foreground">배분 관리는 다음 단계에서 구현됩니다</div>} />
              </Route>

              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

              {/* Project routes with sidebar layout */}
              <Route path="/projects/:id" element={<ProtectedRoute><ProjectLayout /></ProtectedRoute>}>
                <Route index element={<ErrorBoundary><ProjectDetailPage /></ErrorBoundary>} />
                <Route path="boards/:boardId" element={<ErrorBoundary><BoardPage /></ErrorBoundary>} />
                <Route path="dm" element={<ErrorBoundary><DMPage /></ErrorBoundary>} />
                <Route path="members" element={<ErrorBoundary><MembersPage /></ErrorBoundary>} />
                <Route path="settings" element={<ErrorBoundary><ProjectSettingsPage /></ErrorBoundary>} />
                <Route path="admin/allocation" element={<div className="p-8 text-center text-muted-foreground">배분 관리는 다음 단계에서 구현됩니다</div>} />
              </Route>

              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
