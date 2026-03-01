import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AdminGuard from "@/components/admin/AdminGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import ProviderDashboard from "./pages/ProviderDashboard";
import Profile from "./pages/Profile";
import Scholarships from "./pages/Scholarships";
import AdminSourceHubs from "./pages/admin/AdminSourceHubs";
import AdminUrlQueue from "./pages/admin/AdminUrlQueue";
import AdminJobs from "./pages/admin/AdminJobs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/provider" element={<ProviderDashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/scholarships" element={<Scholarships />} />
            <Route path="/admin" element={<Navigate to="/admin/hubs" replace />} />
            <Route path="/admin/hubs" element={<AdminGuard><AdminSourceHubs /></AdminGuard>} />
            <Route path="/admin/queue" element={<AdminGuard><AdminUrlQueue /></AdminGuard>} />
            <Route path="/admin/jobs" element={<AdminGuard><AdminJobs /></AdminGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
