import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPassword from './pages/ForgotPassword';
import SetPassword from './pages/SetPassword';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Agent Pages
import AgentDashboard from './pages/agent/Dashboard';
import VisitForm from './pages/agent/VisitForm';
import Customers from './pages/agent/Customers';
import CustomerDetails from './pages/agent/CustomerDetails';
import QueryDetail from './pages/agent/QueryDetail';
import AgentComplaintPage from './pages/agent/ComplaintPage';
import SeniorAgentActivate from './pages/agent/SeniorAgentActivate';
import TeamActivity from './pages/agent/TeamActivity';
import TeamAgentDetail from './pages/agent/TeamAgentDetail';

// Customer Pages
import CustomerDashboard from './pages/customer/Dashboard';
import BookingPage from './pages/customer/Booking';
import InventoryPage from './pages/customer/Inventory';
import HistoryPage from './pages/customer/History';
import CertificatesPage from './pages/customer/Certificates';
import CustomerComplaintPage from './pages/customer/ComplaintPage';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AgentManagement from './pages/admin/Agents';
import AgentProfile from './pages/admin/AgentProfile';
import GlobalMap from './pages/admin/Map';
import AdminServices from './pages/admin/Services';
import AdminCustomers from './pages/admin/Customers';
import CustomerProfile from './pages/admin/CustomerProfile';
import ComplaintCenter from './pages/admin/ComplaintCenter';
import Analytics from './pages/admin/Analytics';
import Partners from './pages/admin/Partners';
import PartnerProfile from './pages/admin/PartnerProfile';
import Operations from './pages/admin/Operations';
import Reports from './pages/admin/Reports';
import InquiryList from './pages/admin/InquiryList';
import InquiryDetail from './pages/admin/InquiryDetail';
import InquiryItemDetail from './pages/admin/InquiryItemDetail';
import QuotationAnalytics from './pages/admin/QuotationAnalytics';
import AgentPerformance from './pages/perfomance/Dashboard';
import CategoryDetails from './pages/perfomance/CategoryDetails';

// Partner Pages
import PartnerDashboard from './pages/partner/Dashboard';
import InquiryItemsList from './pages/partner/InquiryItemsList';
import InquiryItemDetailPage from './pages/partner/InquiryItemDetailPage';
import SiteAssessmentFormPage from './pages/partner/SiteAssessmentFormPage';
import StickersUsagePage from './pages/partner/StickersUsagePage';
import AiAgentPage from './pages/partner/AiAgentPage';
import PartnerComplaintPage from './pages/partner/ComplaintPage';



// Placeholder Pages (Temporary)
const NotFound = () => <div className="p-10 text-center">Page Not Found</div>;

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (!user) return <Navigate to="/" replace />;

  const role = user.role || localStorage.getItem('role');
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Auth Routes */}
            <Route path="/login/:role" element={<LoginPage />} />
            <Route path="/register/:role" element={<RegisterPage />} />
            <Route path="/forgot-password/:role" element={<ForgotPassword />} />
            <Route path="/set-password" element={<SetPassword />} />

            {/* Senior Agent Activation (public — no login needed) */}
            <Route path="/senior-agent/activate" element={<SeniorAgentActivate />} />

            {/* Agent Routes */}
            <Route path="/agent/*" element={
              <ProtectedRoute allowedRoles={['agent']}>
                <Routes>
                  <Route path="dashboard" element={<AgentDashboard />} />
                  <Route path="visit" element={<VisitForm />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customer/:id" element={<CustomerDetails />} />
                  <Route path="query/:id" element={<QueryDetail />} />
                  <Route path="performance" element={<AgentPerformance />} />
                  <Route path="performance/:category" element={<CategoryDetails />} />
                  <Route path="complaint" element={<AgentComplaintPage />} />
                  <Route path="team" element={<TeamActivity />} />
                  <Route path="team/:memberId" element={<TeamAgentDetail />} />
                </Routes>
              </ProtectedRoute>
            } />

            {/* Customer Routes */}
            <Route path="/customer/*" element={
              <ProtectedRoute allowedRoles={['customer']}>
                <Routes>
                  <Route path="dashboard" element={<CustomerDashboard />} />
                  <Route path="booking" element={<BookingPage />} />
                  <Route path="inventory" element={<InventoryPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="certificates" element={<CertificatesPage />} />
                  <Route path="complaint" element={<CustomerComplaintPage />} />
                </Routes>
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="agents" element={<AgentManagement />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="agents/:id" element={<AgentProfile />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="customers/:id" element={<CustomerProfile />} />
                  <Route path="partners" element={<Partners />} />
                  <Route path="partners/:id" element={<PartnerProfile />} />
                  <Route path="map" element={<GlobalMap />} />
                  <Route path="services" element={<AdminServices />} />
                  <Route path="operations" element={<Operations />} />
                  <Route path="complaints" element={<ComplaintCenter />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="inquiries" element={<InquiryList />} />
                  <Route path="inquiries/:id" element={<InquiryDetail />} />
                  <Route path="inquiries/:id/items/:itemId" element={<InquiryItemDetail />} />
                  <Route path="quotations" element={<QuotationAnalytics />} />
                </Routes>
              </ProtectedRoute>
            } />

            {/* Partner Routes */}
            <Route path="/partner/*" element={
              <ProtectedRoute allowedRoles={['partner']}>
                <Routes>
                  <Route path="dashboard" element={<PartnerDashboard />} />
                  <Route path="stickers" element={<StickersUsagePage />} />
                  <Route path="ai-agent" element={<AiAgentPage />} />
                  <Route path="complaint" element={<PartnerComplaintPage />} />
                  <Route path="inquiry/:id/item/:itemId/site-assessment" element={<SiteAssessmentFormPage />} />
                  <Route path="inquiry/:id/item/:itemId" element={<InquiryItemDetailPage />} />
                  <Route path="inquiry/:id" element={<InquiryItemsList />} />
                </Routes>
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />

          </Routes>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
