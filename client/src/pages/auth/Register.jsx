import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import AuthLayout from '../../components/layout/AuthLayout';
import { Button, ErrorNotice, Loading, Modal } from '../../components/ui/Kit';
import { useApp } from '../../lib/AppContext';
import { api, homeFor } from '../../lib/api';
export default function Register() {
  const { user, loading, refresh } = useApp();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    school: '',
    classCode: '',
    agree: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [terms, setTerms] = useState(false);
  const change = (key) => (event) =>
    setValues((v) => ({
      ...v,
      [key]: key === 'agree' ? event.target.checked : event.target.value,
    }));
  if (loading) return <Loading />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/auth/register', { method: 'POST', body: values });
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout>
      <div className="auth-form register-form">
        <span className="eyebrow">SATU LANGKAH UNTUK MULAI</span>
        <h2>Pahami potensimu.</h2>
        <p className="muted">Buat akun siswa dan bergabung ke kelas XI.</p>
        <ErrorNotice>{error}</ErrorNotice>
        <form onSubmit={submit}>
          <label>
            Nama lengkap
            <input
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              placeholder="Nama lengkapmu"
              value={values.name}
              onChange={change('name')}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="nama@sekolah.sch.id"
              value={values.email}
              onChange={change('email')}
            />
          </label>
          <label>
            Kata sandi
            <input
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              value={values.password}
              onChange={change('password')}
            />
          </label>
          <div className="form-grid">
            <label>
              Asal sekolah
              <input
                required
                minLength={2}
                maxLength={120}
                placeholder="Nama SMA"
                value={values.school}
                onChange={change('school')}
              />
            </label>
            <label>
              Kode kelas
              <input
                required
                minLength={4}
                maxLength={20}
                placeholder="Dari guru, mis. BRIDGE11"
                value={values.classCode}
                onChange={change('classCode')}
              />
            </label>
          </div>
          <p className="field-help">
            Kode demo: <strong>BRIDGE11</strong>. Akun guru dan admin dibuat oleh administrator.
          </p>
          <div className="terms-row">
            <label className="checkbox-label">
              <input type="checkbox" required checked={values.agree} onChange={change('agree')} />
              Saya menyetujui
            </label>
            <button type="button" className="text-button" onClick={() => setTerms(true)}>
              ketentuan penggunaan
            </button>
          </div>
          <Button className="full" busy={busy}>
            Buat akun siswa
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="auth-switch">
          Sudah bergabung? <Link to="/login">Masuk ke akunmu</Link>
        </p>
      </div>
      {terms && (
        <Modal title="Ketentuan penggunaan" onClose={() => setTerms(false)}>
          <div className="modal-body prose">
            <p>
              EduBridge menyimpan nama, email, kelas, dan aktivitas belajarmu untuk menampilkan
              progres serta membantu guru menentukan penguatan. Guru penanggung jawab kelas dan
              administrator dapat melihat hasil asesmen.
            </p>
            <p>
              Gunakan akunmu sendiri dan kerjakan asesmen secara mandiri. Diagnosis pada versi ini
              menggunakan kalibrasi sintetis dan perlu ditinjau guru. Gemini dapat membantu
              menjelaskan hasil tanpa menerima nama/email akun. Hasil bukan penilaian akademik
              final.
            </p>
          </div>
        </Modal>
      )}
    </AuthLayout>
  );
}
