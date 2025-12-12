import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Admin from './pages/Admin';
import FormBuilder from './pages/FormBuilder';
import DataEntry from './pages/DataEntry';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/analysis" element={
              <ProtectedRoute>
                <Layout>
                  <Analysis />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/form-builder" element={
              <ProtectedRoute allowedRoles={['admin', 'editor']}>
                <Layout>
                  <FormBuilder />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/data-entry" element={
              <ProtectedRoute>
                <Layout>
                  <DataEntry />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Layout>
                  <Admin />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
