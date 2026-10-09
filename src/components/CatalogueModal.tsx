import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogue } from '../db/hooks';
import type { Prestation } from '../db/types';
import { fmtEUR } from '../lib/format';
import { Modal } from './ui';

/** Sélecteur de prestations du catalogue : un clic insère une ligne dans le document. */
export default function CatalogueModal({ open, onClose, onPick }: {
  open: boolean;
  onClose: () => void;
  onPick: (p: Prestation) => void;
}) {
  const catalogue = useCatalogue();
  const [q, setQ] = useState('');
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  const s = q.trim().toLowerCase();
  const list = catalogue.filter((p) => !s || p.libelle.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));

  return (
    <Modal open={open} onClose={onClose} title="Insérer depuis le catalogue">
      {catalogue.length === 0 ? (
        <p className="text-2">
          Le catalogue est vide. Ajoutez vos prestations habituelles dans <Link to="/parametres?tab=catalogue" onClick={onClose}>Paramètres → Catalogue</Link>, ou enregistrez une ligne existante avec l'icône « + catalogue ».
        </p>
      ) : (
        <>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" autoFocus aria-label="Rechercher une prestation" />
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table className="table">
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => { onPick(p); onClose(); }}>
                    <td>
                      <b>{p.libelle}</b>
                      {p.description && <div className="small text-2 ellipsis" style={{ maxWidth: 360 }}>{p.description}</div>}
                    </td>
                    <td className="text-2 small nowrap">{p.unite}</td>
                    <td className="num nowrap">{fmtEUR(p.prixUnitaire)}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr><td className="muted">Aucune prestation ne correspond.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
