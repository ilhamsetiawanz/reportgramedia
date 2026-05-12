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
import ManageEvents from "./pages/sm/ManageEvents";
import EventTargets from "./pages/sm/EventTargets";
import EventRegistration from "./pages/sa/EventRegistration";
import EventParticipantReport from "./pages/reports/EventParticipantReport";
import CounterEventRegistration from "./pages/counter/CounterEventRegistration";
import ManageCounters from "./pages/sm/ManageCounters";
import CounterWeeklyRevenue from "./pages/counter/CounterWeeklyRevenue";


/**
 * Robust Protected Route
 */
const ProtectedRoute = ({ children, requireApproval = true, allowedRoles }: { children: React.ReactNode, requireApproval?: boolean, allowedRoles?: string[] }) => {
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

    if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role)) {
      return <Navigate to="/" replace />;
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
          <Route path="/sm/users" element={<ProtectedRoute allowedRoles={["store_manager"]}><ManageUsers /></ProtectedRoute>} />
          <Route path="/sm/departments" element={<ProtectedRoute allowedRoles={["store_manager"]}><ManageDepartments /></ProtectedRoute>} />
          <Route path="/sm/targets" element={<ProtectedRoute allowedRoles={["store_manager"]}><ManageDepartments /></ProtectedRoute>} />
          <Route path="/sm/events" element={<ProtectedRoute allowedRoles={["store_manager"]}><ManageEvents /></ProtectedRoute>} />
          <Route path="/sm/event-targets" element={<ProtectedRoute allowedRoles={["store_manager"]}><EventTargets /></ProtectedRoute>} />
          <Route path="/sm/counters" element={<ProtectedRoute allowedRoles={["store_manager"]}><ManageCounters /></ProtectedRoute>} />

          {/* SPV Routes */}
          <Route path="/spv/sa" element={<ProtectedRoute allowedRoles={["supervisor"]}><ManageSA /></ProtectedRoute>} />
          <Route path="/spv/assign" element={<ProtectedRoute allowedRoles={["supervisor"]}><AssignSA /></ProtectedRoute>} />
          <Route path="/spv/verify" element={<ProtectedRoute allowedRoles={["supervisor"]}><VerifyRevenue /></ProtectedRoute>} />
          <Route path="/spv/input-revenue" element={<ProtectedRoute allowedRoles={["supervisor"]}><SARevenueInput /></ProtectedRoute>} />
          <Route path="/spv/targets" element={<ProtectedRoute allowedRoles={["supervisor"]}><MonthlyTargetsSPV /></ProtectedRoute>} />
          <Route path="/spv/waqaf-targets" element={<ProtectedRoute allowedRoles={["supervisor"]}><WaqafMemberTargets /></ProtectedRoute>} />
          <Route path="/spv/event-targets" element={<ProtectedRoute allowedRoles={["supervisor"]}><EventTargets /></ProtectedRoute>} />

          {/* SA Routes */}
          <Route path="/sa/revenue" element={<ProtectedRoute allowedRoles={["store_associate"]}><DailyRevenueInput /></ProtectedRoute>} />
          <Route path="/sa/waqaf" element={<ProtectedRoute allowedRoles={["store_associate"]}><WaqafMemberInput /></ProtectedRoute>} />
          <Route path="/sa/activities" element={<ProtectedRoute allowedRoles={["store_associate"]}><ActivityReportInput /></ProtectedRoute>} />
          <Route path="/sa/event-registration" element={<ProtectedRoute allowedRoles={["store_associate"]}><EventRegistration /></ProtectedRoute>} />

          {/* Counter Routes */}
          <Route path="/counter/event-registration" element={<ProtectedRoute allowedRoles={["counter"]}><CounterEventRegistration /></ProtectedRoute>} />
          <Route path="/counter/weekly-revenue" element={<ProtectedRoute allowedRoles={["counter"]}><CounterWeeklyRevenue /></ProtectedRoute>} />

          {/* Reports (Accessible by SM, SPV, SA based on specific report) */}
          <Route path="/reports/daily" element={<ProtectedRoute allowedRoles={["store_manager"]}><DailyReport /></ProtectedRoute>} />
          <Route path="/reports/daily-recap" element={<ProtectedRoute allowedRoles={["store_manager", "supervisor", "store_associate"]}><DailyRecap /></ProtectedRoute>} />
          <Route path="/reports/monthly" element={<ProtectedRoute allowedRoles={["store_manager", "store_associate"]}><MonthlyReport /></ProtectedRoute>} />
          <Route path="/reports/waqaf-member" element={<ProtectedRoute allowedRoles={["store_manager", "supervisor"]}><WaqafMemberReport /></ProtectedRoute>} />
          <Route path="/reports/dept" element={<ProtectedRoute allowedRoles={["supervisor"]}><MonthlyReport /></ProtectedRoute>} />
          <Route path="/reports/activities" element={<ProtectedRoute allowedRoles={["supervisor"]}><ActivityReport /></ProtectedRoute>} />
          <Route path="/reports/event-participants" element={<ProtectedRoute allowedRoles={["store_manager", "supervisor"]}><EventParticipantReport /></ProtectedRoute>} />

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
