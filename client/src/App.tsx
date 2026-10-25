import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import ErrorBoundary from "@/components/ErrorBoundary";
import RouteLoading from "@/components/RouteLoading";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/context/ThemeContext";

const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const RoomPage = lazy(() => import("@/pages/RoomPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={200}>
        <BrowserRouter>
          <ErrorBoundary>
            <ScrollToTop />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/room/:roomId" element={<RoomPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
