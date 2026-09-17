import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useApp } from "@/context/AppContext";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/AdminDashboard";
import StaffDashboard from "@/pages/StaffDashboard";

const queryClient = new QueryClient();

const AppRouter = () => {
  const { currentUser, currentPortal } = useApp();
  if (!currentUser) return <Login />;
  if (currentUser.role === 'admin') {
    if (currentPortal === 'staff') return <StaffDashboard />;
    return <AdminDashboard />;
  }
  return <StaffDashboard />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
