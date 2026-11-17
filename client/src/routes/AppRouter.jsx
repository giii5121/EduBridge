import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from '../lib/AppContext';
import { homeFor } from '../lib/api';
import { Loading, ErrorNotice, Button } from '../components/ui/Kit';
import DashboardLayout from '../components/layout/DashboardLayout';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import Dashboard from '../pages/dashboard/Dashboard';
import KatalogMateri from '../pages/dashboard/KatalogMateri';
import Kuis, { AssessmentRunner, AssessmentResult } from '../pages/dashboard/Kuis';
import Progres from '../pages/dashboard/Progres';
import Profil from '../pages/dashboard/Profil';
import Lesson from '../pages/dashboard/Lesson';
import Teacher from '../pages/staff/Teacher';
import Admin from '../pages/staff/Admin';
import Home from '../pages/Home';
import Materials from '../pages/staff/Materials';
import MaterialReader from '../pages/dashboard/MaterialReader';
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function Gate({ roles, children }) {
  const { user, loading, error, refresh } = useApp();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error && !user)
    return (
      <div className="fatal">
        <ErrorNotice>{error}</ErrorNotice>
        <Button onClick={() => refresh().catch(() => {})}>Coba lagi</Button>
      </div>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
export default function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollReset />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          element={
            <Gate>
              <DashboardLayout />
            </Gate>
          }
        >
          <Route
            path="/dashboard"
            element={
              <Gate roles={['student']}>
                <Dashboard />
              </Gate>
            }
          />
          <Route path="/katalog" element={<KatalogMateri />} />
          <Route
            path="/kelola-materi"
            element={
              <Gate roles={['teacher', 'admin']}>
                <Materials />
              </Gate>
            }
          />
          <Route path="/penguatan/:materialId" element={<MaterialReader />} />
          <Route path="/materi/:topicId" element={<Lesson />} />
          <Route
            path="/kuis"
            element={
              <Gate roles={['student']}>
                <Kuis />
              </Gate>
            }
          />
          <Route
            path="/kuis/kerjakan/:assessmentId"
            element={
              <Gate roles={['student']}>
                <AssessmentRunner />
              </Gate>
            }
          />
          <Route
            path="/kuis/hasil/:assessmentId"
            element={
              <Gate roles={['student']}>
                <AssessmentResult />
              </Gate>
            }
          />
          <Route
            path="/progres"
            element={
              <Gate roles={['student']}>
                <Progres />
              </Gate>
            }
          />
          <Route path="/profil" element={<Profil />} />
          <Route
            path="/guru"
            element={
              <Gate roles={['teacher', 'admin']}>
                <Teacher />
              </Gate>
            }
          />
          <Route
            path="/admin"
            element={
              <Gate roles={['admin']}>
                <Admin />
              </Gate>
            }
          />
        </Route>
        <Route
          path="*"
          element={
            <div className="fatal">
              <span className="eyebrow">404</span>
              <h1>Sepertinya kamu tersesat.</h1>
              <p>Perjalanan belajarmu masih menunggu.</p>
              <Link className="button primary" to="/">
                Kembali ke beranda
              </Link>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
