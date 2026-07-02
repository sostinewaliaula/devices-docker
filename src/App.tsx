import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContextNew';
import { GoogleConfigProvider, useGoogleConfig } from './contexts/GoogleConfigContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrandingProvider } from './contexts/BrandingContext';
import Layout from './components/layout/Layout';
import ToastContainer from './components/ui/ToastContainer';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyCode from './pages/auth/VerifyCode';
import ChangePassword from './pages/auth/ChangePassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import AssetManagement from './pages/admin/AssetManagement';
import DepartmentManagement from './pages/admin/DepartmentManagement';
import IssueManagement from './pages/admin/IssueManagement';
import UserDashboard from './pages/user/UserDashboard';
import UserAssets from './pages/user/UserAssets';
import UserIssues from './pages/user/UserIssues';
import UserAssetRequests from './pages/user/UserAssetRequests';
import AssetDetails from './pages/shared/AssetDetails';
import QrScanner from './pages/shared/QrScanner';
import NotificationsPage from './pages/shared/NotificationsPage';
import Settings from './pages/shared/Settings';
import SecuritySettings from './pages/settings/SecuritySettings';
import UserIssueDetail from './pages/user/UserIssueDetail';
import Profile from './pages/shared/Profile';
// import { useSupabase } from './hooks/useSupabase'; // Removed - using new API
import BackupManagement from './pages/admin/BackupManagement';
import BackupEmailRecipients from './pages/admin/BackupEmailRecipients';
import AuditLogs from './pages/admin/AuditLogs';
import DepartmentDetails from './pages/admin/DepartmentDetails';
import AssetRequestsManagement from './pages/admin/AssetRequestsManagement';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import TeamMembers from './pages/manager/TeamMembers';
import DepartmentIssues from './pages/manager/DepartmentIssues';
import DepartmentAssets from './pages/manager/DepartmentAssets';
import AssetRequests from './pages/manager/AssetRequests';
import Communication from './pages/manager/Communication';
import MfaManagement from './pages/admin/MfaManagement';
import MfaPolicyManagement from './pages/admin/MfaPolicyManagement';
import IssueDetail from './pages/admin/IssueDetail';
import MfaSetup from './pages/auth/MfaSetup';
import CompleteProfile from './pages/auth/CompleteProfile';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import TermsOfService from './pages/legal/TermsOfService';
import WeeklyNotifications from './pages/admin/WeeklyNotifications';
import PositionsManagement from './pages/admin/PositionsManagement';
import AssetTypeManagement from './pages/admin/AssetTypeManagement';
import AssetTypesConfig from './pages/admin/AssetTypesConfig';
import IssueCategoryManagement from './pages/admin/IssueCategoryManagement';
import AssetHistory from './pages/admin/AssetHistory';
import AssetHistoryDetail from './pages/admin/AssetHistoryDetail';
import UserHistory from './pages/admin/UserHistory';
import UserHistoryDetail from './pages/admin/UserHistoryDetail';
import BudgetOverview from './pages/admin/BudgetOverview';

// Toast container wrapper component
const ToastContainerWrapper = () => {
  const { toasts, dismissToast } = useNotifications();
  return <ToastContainer toasts={toasts} onDismiss={dismissToast} />;
};

function RoleIndexRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  const target = user?.role === 'admin' ? '/admin/dashboard' :
    user?.role === 'manager' ? '/manager/dashboard' : '/user/dashboard';
  return <Navigate to={target} replace />;
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // console.log('🔒 RequireAuth: Still loading...');
    return null;
  }

  if (!isAuthenticated) {
    // console.log('🔒 RequireAuth: Not authenticated, redirecting to login');
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // console.log('🔒 RequireAuth: Authenticated, rendering children');
  return children;
}

function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/user/dashboard" replace />;
  }
  return children;
}

function RequireManager({ children }: { children: React.ReactElement }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (user.role !== 'manager' && user.role !== 'admin') {
    return <Navigate to="/user/dashboard" replace />;
  }
  return children;
}

function AppWithGoogle() {
  const { clientId } = useGoogleConfig();
  return (
    <GoogleOAuthProvider clientId={clientId}>
    <AuthProvider>
      <NotificationProvider>
        <BrandingProvider>
          <ThemeProvider>
            <ToastContainerWrapper />
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-code" element={<VerifyCode />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/setup-mfa" element={<RequireAuth><MfaSetup /></RequireAuth>} />
                <Route path="/complete-profile" element={<RequireAuth><CompleteProfile /></RequireAuth>} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />

                <Route path="/" element={<RoleIndexRedirect />} />

                {/* Protected Routes */}
                <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                  <Route path="admin">
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
                    <Route path="users" element={<RequireAdmin><UserManagement /></RequireAdmin>} />
                    <Route path="users/history" element={<RequireAdmin><UserHistory /></RequireAdmin>} />
                    <Route path="users/history/:userId" element={<RequireAdmin><UserHistoryDetail /></RequireAdmin>} />
                    <Route path="assets" element={<RequireAdmin><AssetManagement /></RequireAdmin>} />
                    <Route path="assets/history" element={<RequireAdmin><AssetHistory /></RequireAdmin>} />
                    <Route path="assets/history/:assetId" element={<RequireAdmin><AssetHistoryDetail /></RequireAdmin>} />
                    <Route path="issue-details/:issueId" element={<RequireAdmin><IssueDetail /></RequireAdmin>} />
                    <Route path="departments" element={<RequireAdmin><DepartmentManagement /></RequireAdmin>} />
                    <Route path="departments/:id" element={<RequireAdmin><DepartmentDetails /></RequireAdmin>} />
                    <Route path="issues" element={<RequireAdmin><IssueManagement /></RequireAdmin>} />
                    <Route path="issues/:issueId" element={<RequireAdmin><IssueDetail /></RequireAdmin>} />
                    <Route path="asset-requests" element={<RequireAdmin><AssetRequestsManagement /></RequireAdmin>} />
                    <Route path="positions" element={<RequireAdmin><PositionsManagement /></RequireAdmin>} />
                    <Route path="asset-requests/types" element={<RequireAdmin><AssetTypeManagement /></RequireAdmin>} />
                    <Route path="asset-types" element={<RequireAdmin><AssetTypesConfig /></RequireAdmin>} />
                    <Route path="issue-categories" element={<RequireAdmin><IssueCategoryManagement /></RequireAdmin>} />
                    <Route path="budget" element={<RequireAdmin><BudgetOverview /></RequireAdmin>} />
                    <Route path="mfa-management" element={<RequireAdmin><MfaManagement /></RequireAdmin>} />
                    <Route path="mfa-policies" element={<RequireAdmin><MfaPolicyManagement /></RequireAdmin>} />
                    <Route path="weekly-notifications" element={<RequireAdmin><WeeklyNotifications /></RequireAdmin>} />
                    <Route path="backup" element={<RequireAdmin><BackupManagement /></RequireAdmin>} />
                    <Route path="backup/recipients" element={<RequireAdmin><BackupEmailRecipients /></RequireAdmin>} />
                    <Route path="audit" element={<RequireAdmin><AuditLogs /></RequireAdmin>} />
                  </Route>
                  <Route path="manager">
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<RequireManager><ManagerDashboard /></RequireManager>} />
                    <Route path="team" element={<RequireManager><TeamMembers /></RequireManager>} />
                    <Route path="issues" element={<RequireManager><DepartmentIssues /></RequireManager>} />
                    <Route path="assets" element={<RequireManager><DepartmentAssets /></RequireManager>} />
                    <Route path="asset-requests" element={<RequireManager><AssetRequests /></RequireManager>} />
                    <Route path="communication" element={<RequireManager><Communication /></RequireManager>} />
                  </Route>
                  <Route path="user">
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<UserDashboard />} />
                    <Route path="assets" element={<UserAssets />} />
                    <Route path="asset-requests" element={<UserAssetRequests />} />
                    <Route path="issues" element={<UserIssues />} />
                    <Route path="issues/:issueId" element={<UserIssueDetail />} />
                  </Route>
                  <Route path="assets/:assetId" element={<AssetDetails />} />
                  <Route path="scan" element={<RequireAuth><QrScanner /></RequireAuth>} />
                  <Route path="shared">
                    <Route path="asset/:id" element={<AssetDetails />} />
                  </Route>
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="security-settings" element={<SecuritySettings />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Routes>
            </Router>
          </ThemeProvider>
        </BrandingProvider>
      </NotificationProvider>
    </AuthProvider>
    </GoogleOAuthProvider>
  );
}

function App() {
  return (
    <GoogleConfigProvider>
      <AppWithGoogle />
    </GoogleConfigProvider>
  );
}

export default App;
