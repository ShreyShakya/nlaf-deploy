import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LawyerDashboard from './pages/LawyerDashboard';
import LawyerRegistration from './components/Auth/LawyerRegistration';
import LawyerLogin from './components/Auth/LawyerLogin';
import ClientRegistration from './components/Auth/ClientRegistration';
import ClientLogin from './components/Auth/ClientLogin';
import ClientDashboard from './pages/ClientDashboard';
import BrowseLawyers from './pages/BrowseLawyers';
import LawyerProfile from './components/Auth/LawyerProfile';
import CaseDetails from './pages/CaseDetails';
import ClientCaseDetails from './pages/ClientCaseDetails';
import DocumentTemplatesPage from './pages/DocumentTemplatesPage';
import AdminLogin from './components/Admin/AdminLogin'; // New admin login component
import Dashboard from './components/Admin/Dashboard'; // New admin dashboard component
import AdminRegister from './components/Admin/AdminRegister';
import ForgotPassword from './components/Auth/ForgotPassword';
import VerifyKyc from './components/Auth/VerifyKyc';

function App() {
  return (
    <Router>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Lawyer Routes */}
        <Route path="/lawyerdashboard" element={<LawyerDashboard />} />
        <Route path="/register-lawyer" element={<LawyerRegistration />} />
        <Route path="/lawyer-login" element={<LawyerLogin />} />
        <Route path="/lawyer-profile" element={<LawyerProfile />} />
        <Route path="/lawyer-profile/:id" element={<LawyerProfile />} />
        <Route path="/verify-kyc" element={<VerifyKyc />} />

        {/* Client Routes */}
        <Route path="/client-registration" element={<ClientRegistration />} />
        <Route path="/client-login" element={<ClientLogin />} />
        <Route path="/client-dashboard" element={<ClientDashboard />} />

        {/* General Routes */}
        <Route path="/browse-lawyers" element={<BrowseLawyers />} />
        <Route path="/case-details/:caseId" element={<CaseDetails />} />
        <Route path="/client-case/:caseId" element={<ClientCaseDetails />} />
        <Route path="/document-templates" element={<DocumentTemplatesPage />} />
        <Route path="forgot-password/:role" element={<ForgotPassword />} />

        {/* Admin Routes */}
        <Route path="/admin/register" element={<AdminRegister />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;