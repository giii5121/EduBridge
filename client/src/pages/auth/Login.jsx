import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, GraduationCap, ShieldCheck, UserRound } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import { Button, ErrorNotice, Loading } from '../../components/ui/Kit';
import { api, homeFor } from '../../lib/api';
import { useApp } from '../../lib/AppContext';
export default function Login() {
  const { user, loading, refresh } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoEnabled, setDemoEnabled] = useState(false);
  useEffect(() => {
    api('/config')
      .then((config) => setDemoEnabled(config.demoEnabled))
      .catch(() => {});
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  if (loading) return <Loading />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  async function login(values) {
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/login', { method: 'POST', body: { ...values, remember } });
      await refresh();
      const from = location.state?.from;
      navigate(
        typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
          ? from
          : homeFor(result.user.role),
        { replace: true },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-form">
        <span className="eyebrow">SELAMAT DATANG KEMBALI</span>
        <h2>Siap makin paham?</h2>
        <p className="muted">Masuk dan lanjutkan perjalanan belajarmu.</p>
        <ErrorNotice>{error}</ErrorNotice>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login({ email, password });
          }}
        >
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              placeholder="nama@sekolah.sch.id"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Kata sandi
            <div className="password-input">
              <input
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan kata sandimu"
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Ingat saya selama 30 hari
          </label>
          <Button busy={busy} type="submit" className="full">
            Masuk ke EduBridge
            <ArrowRight size={18} />
          </Button>
        </form>
        <p className="auth-switch">
          Belum punya akun? <Link to="/register">Daftar sebagai siswa</Link>
        </p>
        {demoEnabled && (
          <div className="demo-section">
            <div className="divider">
              <span>Jelajahi dengan akun demo</span>
            </div>
            <div className="demo-buttons">
              {[
                ['siswa', 'Siswa', UserRound],
                ['guru', 'Guru', GraduationCap],
                ['admin', 'Admin', ShieldCheck],
              ].map(([role, label, Icon]) => (
                <button
                  type="button"
                  key={role}
                  disabled={busy}
                  onClick={() =>
                    login({ email: `${role}@edubridge.id`, password: 'EduBridge123!' })
                  }
                >
                  <Icon size={19} />
                  {label}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
            <p>Data contoh tersimpan di server. Semua fitur dapat dicoba.</p>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
