import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Layers } from 'lucide-react';
import { Badge, Symbol } from '../ui/Kit';
import './Materials.css';
export default function MaterialCards({ materials, actions }) {
  return (
    <div className="material-grid">
      {materials.map((m) => (
        <article className="material-card" key={m.id}>
          <div className="row-between">
            <Symbol topic={m} />
            <Badge tone={m.published ? 'teal' : 'neutral'}>{m.published ? 'Terbit' : 'Draf'}</Badge>
          </div>
          <span className="eyebrow">{m.topicTitle}</span>
          <h3>
            <Link to={`/penguatan/${m.id}`}>{m.title}</Link>
          </h3>
          <p>{m.summary}</p>
          <div className="material-meta">
            <span>
              <Clock3 size={14} />
              {m.minutes} menit
            </span>
            <span>
              <Layers size={14} />
              {m.sectionCount} bagian
            </span>
          </div>
          <div className="material-card-foot">
            <span>{m.className}</span>
            <Link to={`/penguatan/${m.id}`} aria-label={`Baca ${m.title}`}>
              <ArrowUpRight size={19} />
            </Link>
          </div>
          {actions && m.canManage && <div className="material-card-actions">{actions(m)}</div>}
        </article>
      ))}
    </div>
  );
}
