import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPassword from './pages/ForgotPassword';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// Agent Pages
import AgentDashboard from './pages/agent/Dashboard';
import VisitForm from './pages/agent/VisitForm';
import Customers from './pages/agent/Customers';

// Customer Pages
import CustomerDashboard from './pages/customer/Dashboard';
import BookingPage from './pages/customer/Booking';
import InventoryPage from './pages/customer/Inventory';
import HistoryPage from './pages/customer/History';
import CertificatesPage from './pages/customer/Certificates';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AgentManagement from './pages/admin/Agents';
import GlobalMap from './pages/admin/Map';
import AdminServices from './pages/admin/Services';
import AdminCustomers from './pages/admin/Customers';


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

            {/* Agent Routes */}
            <Route path="/agent/*" element={
              <ProtectedRoute allowedRoles={['agent']}>
                <Routes>
                  <Route path="dashboard" element={<AgentDashboard />} />
                  <Route path="visit" element={<VisitForm />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="performance" element={<div>Performance (Coming Soon)</div>} />
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
                </Routes>
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="agents" element={<AgentManagement />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="map" element={<GlobalMap />} />
                  <Route path="services" element={<AdminServices />} />
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
