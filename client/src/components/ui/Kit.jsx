import { useEffect, useRef } from 'react';
import {
  ArrowRight,
  LoaderCircle,
  X,
  AlertCircle,
  Check,
  LockKeyhole,
  BookOpen,
  Trophy,
  Flame,
  Flag,
  Star,
  Target,
  Compass,
  Waypoints,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import TopicIllustration from './TopicIllustration';
export function Button({
  children,
  variant = 'primary',
  className = '',
  busy = false,
  disabled = false,
  ...props
}) {
  return (
    <button className={`button ${variant} ${className}`} disabled={busy || disabled} {...props}>
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function ButtonLink({
  children,
  to,
  variant = 'primary',
  className = '',
  arrow = false,
  ...props
}) {
  return (
    <Link to={to} className={`button ${variant} ${className}`} {...props}>
      {children}
      {arrow && <ArrowRight size={17} />}
    </Link>
  );
}
export function Badge({ children, tone = 'blue', className = '' }) {
  return <span className={`badge ${tone} ${className}`}>{children}</span>;
}
export function ErrorNotice({ children }) {
  return children ? (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
    </div>
  ) : null;
}
export function Loading({ label = 'Sedang memuat…' }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={25} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({ title, children, action, icon: Icon = BookOpen }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SectionHead({ eyebrow, title, children, action }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {children && <p className="muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function PageHead({ eyebrow, title, children, action }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
export function Meter({ value = 0, tone = 'blue', label }) {
  return (
    <div
      className={`meter ${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Symbol({ topic, small = false }) {
  return (
    <span className={`topic-symbol ${topic.color} ${small ? 'small' : ''}`} aria-hidden="true">
      <TopicIllustration id={topic.icon ?? topic.id} />
    </span>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Tutup dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const badgeIcons = {
  flag: Flag,
  bridge: Waypoints,
  star: Star,
  target: Target,
  flame: Flame,
  compass: Compass,
};
export function Achievement({ badge }) {
  const Icon = badgeIcons[badge.icon] ?? Trophy;
  return (
    <div className={`achievement ${badge.earned ? 'earned' : ''}`}>
      <div className="achievement-icon">
        <Icon size={27} />
        {!badge.earned && <LockKeyhole size={12} className="achievement-lock" />}
      </div>
      <h3>{badge.name}</h3>
      <p>{badge.description}</p>
      <span>
        {badge.earned ? (
          <>
            <Check size={13} /> Terbuka
          </>
        ) : (
          'Belum terbuka'
        )}
      </span>
    </div>
  );
}
export function Stat({ icon: Icon, label, value, detail, tone = 'blue' }) {
  return (
    <div className="stat">
      <span className={`stat-icon ${tone}`}>
        <Icon size={20} />
      </span>
      <div>
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}
