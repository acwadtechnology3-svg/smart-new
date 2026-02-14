import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { SOSNotification } from "@/components/SOSNotification";
import { SOSAlertNotificationListener } from "@/components/SOSAlertNotification";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import DriverRequests from "./pages/DriverRequests";
import WithdrawalRequests from "./pages/WithdrawalRequests";
import VehicleChangeRequests from "./pages/VehicleChangeRequests";
import Drivers from "./pages/Drivers";
import Trips from "./pages/Trips";
import Customers from "./pages/Customers";
import Wallet from "./pages/Wallet";
import Promos from "./pages/Promos";
import PromoBanners from '@/pages/PromoBanners';
import Support from "./pages/Support";
import Safety from "./pages/Safety";
import Settings from "./pages/Settings";
import Members from "./pages/Members";
import AppPopups from '@/pages/AppPopups';
import SurgeZones from "./pages/SurgeZones";
import NotFound from "./pages/NotFound";
import LiveMap from "./pages/LiveMap";
import SystemMonitoringDashboard from "./pages/Monitoring";

const queryClient = new QueryClient();

// Wrapper for protected pages with permission check
const ProtectedPage = ({
  children,
  page,
  requiredRoles
}: {
  children: React.ReactNode;
  page: string;
  requiredRoles?: ('super_admin' | 'admin' | 'manager' | 'viewer')[];
}) => (
  <ProtectedRoute requiredPage={page} requiredRoles={requiredRoles}>
    {children}
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedPage page="dashboard"><Dashboard /></ProtectedPage>} />
            <Route path="/live-map" element={<ProtectedPage page="dashboard"><LiveMap /></ProtectedPage>} />
            <Route path="/drivers" element={<ProtectedPage page="drivers"><Drivers /></ProtectedPage>} />
            <Route path="/driver-requests" element={<ProtectedPage page="driver_requests"><DriverRequests /></ProtectedPage>} />
            <Route path="/vehicle-change-requests" element={<ProtectedPage page="vehicle_change_requests"><VehicleChangeRequests /></ProtectedPage>} />
            <Route path="/trips" element={<ProtectedPage page="trips"><Trips /></ProtectedPage>} />
            <Route path="/customers" element={<ProtectedPage page="customers"><Customers /></ProtectedPage>} />
            <Route path="/wallet" element={<ProtectedPage page="wallet"><Wallet /></ProtectedPage>} />
            <Route path="/withdrawal-requests" element={<ProtectedPage page="withdrawal_requests"><WithdrawalRequests /></ProtectedPage>} />
            <Route path="/promos" element={<ProtectedPage page="promos"><Promos /></ProtectedPage>} />
            <Route path="/popups" element={<ProtectedPage page="popups" requiredRoles={['super_admin', 'admin']}><AppPopups /></ProtectedPage>} />
            <Route path="/promo-banners" element={<ProtectedPage page="promo_banners" requiredRoles={['super_admin', 'admin']}><PromoBanners /></ProtectedPage>} />
            <Route path="/surge-zones" element={<ProtectedPage page="surge_zones" requiredRoles={['super_admin', 'admin']}><SurgeZones /></ProtectedPage>} />
            <Route path="/support" element={<ProtectedPage page="support"><Support /></ProtectedPage>} />
            <Route path="/safety" element={<ProtectedPage page="safety"><Safety /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage page="settings"><Settings /></ProtectedPage>} />
            <Route path="/monitoring" element={<ProtectedPage page="settings" requiredRoles={['super_admin', 'admin']}><SystemMonitoringDashboard /></ProtectedPage>} />

            {/* Super Admin only routes */}
            <Route
              path="/members"
              element={
                <ProtectedRoute requiredRoles={['super_admin']}>
                  <Members />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <SOSNotification />
          <SOSAlertNotificationListener />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
