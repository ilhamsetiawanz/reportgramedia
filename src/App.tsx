import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router";
import { supabase } from "./lib/supabase";
import { useAuthStore } from "./store/useAuthStore";

import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import PendingApproval from "./pages/AuthPages/PendingApproval";
import NotFound from "./pages/OtherPage/NotFound";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import ManageDepartments from "./pages/sm/ManageDepartments";
import ManageUsers from "./pages/sm/ManageUsers";
import DailyRevenueInput from "./pages/sa/DailyRevenueInput";
import WaqafMemberInput from "./pages/sa/WaqafMemberInput";
import ActivityReportInput from "./pages/sa/ActivityReportInput";
import VerifyRevenue from "./pages/spv/VerifyRevenue";
import MonthlyTargetsSPV from "./pages/spv/MonthlyTargetsSPV";
import ManageSA from "./pages/spv/ManageSA";
import WaqafMemberTargets from "./pages/spv/WaqafMemberTargets";
import WaqafMemberReport from "./pages/reports/WaqafMemberReport";
import DailyReport from "./pages/reports/DailyReport";
import MonthlyReport from "./pages/reports/MonthlyReport";
import ActivityReport from "./pages/reports/ActivityReport";
import DailyRecap from "./pages/reports/DailyRecap";
import AssignSA from "./pages/spv/AssignSA";
import SARevenueInput from "./pages/spv/SARevenueInput";


/**
 * Robust Protected Route
 */
const ProtectedRoute = ({ children, requireApproval = true }: { children: React.ReactNode, requireApproval?: boolean }) => {
  const { session, profile, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  // 1. Check Session
  if (!session) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // 2. Check Approval & Role (if required)
  if (requireApproval) {
    const isApproved = profile?.is_approved;
    const hasRole = !!profile?.role;

    if (!isApproved || !hasRole) {
      return <Navigate to="/pending" replace />;
    }
  }

  return <>{children}</>;
};

export default function App() {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listener for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Public Routes (Accessible only when logged out) */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Pending Approval Route (Accessible only when logged in but not approved) */}
        <Route path="/pending" element={
          <ProtectedRoute requireApproval={false}>
            <PendingApproval />
          </ProtectedRoute>
        } />

        {/* Protected Dashboard Routes (Accessible only when logged in AND approved) */}
        <Route
          element={
            <ProtectedRoute requireApproval={true}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index path="/" element={<Home />} />
          {/* Profile Route Removed */}

          {/* SM Routes */}
          <Route path="/sm/users" element={<ManageUsers />} />
          <Route path="/sm/departments" element={<ManageDepartments />} />
          <Route path="/sm/targets" element={<ManageDepartments />} />

          {/* SPV Routes */}
          <Route path="/spv/sa" element={<ManageSA />} />
          <Route path="/spv/assign" element={<AssignSA />} />
          <Route path="/spv/verify" element={<VerifyRevenue />} />
          <Route path="/spv/input-revenue" element={<SARevenueInput />} />
          <Route path="/spv/targets" element={<MonthlyTargetsSPV />} />
          <Route path="/spv/waqaf-targets" element={<WaqafMemberTargets />} />

          {/* SA Routes */}
          <Route path="/sa/revenue" element={<DailyRevenueInput />} />
          <Route path="/sa/waqaf" element={<WaqafMemberInput />} />
          <Route path="/sa/activities" element={<ActivityReportInput />} />

          <Route path="/reports/daily" element={<DailyReport />} />
          <Route path="/reports/daily-recap" element={<DailyRecap />} />
          <Route path="/reports/monthly" element={<MonthlyReport />} />
          <Route path="/reports/waqaf-member" element={<WaqafMemberReport />} />
          <Route path="/reports/dept" element={<MonthlyReport />} />
          <Route path="/reports/activities" element={<ActivityReport />} />

          <Route path="/blank" element={<Blank />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<ProtectedRedirect />} />
      </Routes>
    </Router>
  );
}

/**
 * Handle 404 with proper redirect based on auth state
 */
function ProtectedRedirect() {
  const { session } = useAuthStore();
  if (!session) return <NotFound />; // Show 404 if not logged in
  return <Navigate to="/" replace />; // Redirect to home if logged in
}
