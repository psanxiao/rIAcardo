import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Atleta = lazy(() => import('./pages/Atleta'));
const ActivityDetail = lazy(() => import('./pages/ActivityDetail'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Coach = lazy(() => import('./pages/Coach'));
const Settings = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));

const PageLoader = () => (
  <div className="flex h-64 items-center justify-center">
    <Spinner size="h-10 w-10" />
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></ErrorBoundary>} />
                <Route path="/calendar" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Calendar /></Suspense></ErrorBoundary>} />
                <Route path="/atleta" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Atleta /></Suspense></ErrorBoundary>} />
                <Route path="/activity/:id" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ActivityDetail /></Suspense></ErrorBoundary>} />
                <Route path="/analytics" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Analytics /></Suspense></ErrorBoundary>} />
                <Route path="/coach" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Coach /></Suspense></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Settings /></Suspense></ErrorBoundary>} />
                <Route path="/help" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Help /></Suspense></ErrorBoundary>} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;