import { Link } from 'react-router-dom';
import { Check, ArrowUpRight } from 'lucide-react';
import mascot from '../../assets/images/mascots copy/mascot-2-1-2.png';
import ThemeToggle from '../ui/ThemeToggle';
export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Link to="/" className="brand light">
          <img src="/assets/images/logo.png" alt="" />
          <span>
            edu<span>bridge</span>
          </span>
        </Link>
        <div className="auth-story-body">
          <span className="auth-kicker">UNTUK SETIAP LANGKAH BELAJARMU</span>
          <h1>
            Kenali kebutuhanmu.
            <br />
            Temukan ritmemu.
            <br />
            <em>Bangun pemahaman.</em>
          </h1>
          <p>
            Kenali celah pemahamanmu, kuatkan konsepnya, dan lihat kemajuanmu setelah belajar di
            kelas.
          </p>
          <div className="auth-illustration">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="math-float float-one">f(x)</span>
            <span className="math-float float-two">
              +1 konsep dikuasai <Check size={15} />
            </span>
            <img src={mascot} alt="Maskot astronaut EduBridge membaca buku" />
            <span className="illustration-star">✦</span>
          </div>
          <div className="auth-steps">
            <span>
              <i>01</i> Kenali gap
            </span>
            <span>
              <i>02</i> Belajar terarah
            </span>
            <span>
              <i>03</i> Ukur kemajuan
            </span>
          </div>
        </div>
        <div className="auth-story-foot">
          <span>Matematika · Kelas XI SMA</span>
          <ArrowUpRight size={20} />
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-theme-switch">
          <ThemeToggle showLabel />
        </div>
        <Link to="/" className="brand auth-mobile-brand">
          <img src="/assets/images/logo.png" alt="" />
          <span>
            edu<span>bridge</span>
          </span>
        </Link>
        {children}
        <p className="auth-foot">Belajar sesuai kebutuhanmu. Bertumbuh dengan caramu.</p>
      </section>
    </div>
  );
}
