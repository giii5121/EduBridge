import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import Dashboard from '../pages/dashboard/Dashboard';
import KatalogMateri from "../pages/dashboard/KatalogMateri";
import Kuis from '../pages/dashboard/Kuis';
import Progres from '../pages/dashboard/Progres';
import Profil from '../pages/dashboard/Profil';

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/katalog" element={<KatalogMateri />} />
        <Route path="/kuis" element={<Kuis />} />
        <Route path="/progres" element={<Progres />} />
        <Route path="/profil" element={<Profil />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
