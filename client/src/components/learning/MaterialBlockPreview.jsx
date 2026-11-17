import { useState } from 'react';
import { Eye } from 'lucide-react';
import ConceptContent from './ConceptContent';

export default function MaterialBlockPreview({ block }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="material-block-preview"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <Eye size={16} />
        Pratinjau bagian seperti tampilan siswa
      </summary>
      {open && (
        <div className="material-block-preview-content">
          <h3>{block.title || 'Judul bagian'}</h3>
          <ConceptContent block={block} />
        </div>
      )}
    </details>
  );
}
