import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients, useDocuments } from '../db/hooks';
import { useI18n } from '../i18n';
import { docLabel } from '../lib/documents';
import { fmtDate, fmtMoney } from '../lib/format';
import { Icon, Modal, type IconName } from './ui';

/** Texte ramené en minuscules sans accents : « elodie » trouve « Élodie ». */
const simplifier = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Groupe = 'actions' | 'documents' | 'clients';
interface Resultat {
  cle: string;
  groupe: Groupe;
  titre: string;
  detail: string;
  lien: string;
  icone: IconName;
}

const PAGES: { lien: string; cle: string; icone: IconName }[] = [
  { lien: '/', cle: 'nav.dashboard', icone: 'dashboard' },
  { lien: '/documents', cle: 'nav.documents', icone: 'file' },
  { lien: '/clients', cle: 'nav.clients', icone: 'users' },
  { lien: '/cotisations', cle: 'nav.contributions', icone: 'calc' },
  { lien: '/echeances', cle: 'nav.deadlines', icone: 'calendar' },
  { lien: '/recettes', cle: 'nav.ledger', icone: 'table' },
  { lien: '/depenses', cle: 'nav.expenses', icone: 'receipt' },
  { lien: '/parametres', cle: 'nav.settings', icone: 'settings' },
];

function Contenu({ fermer }: { fermer: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const docs = useDocuments();
  const clients = useClients();
  const [texte, setTexte] = useState('');
  const [actif, setActif] = useState(0);
  const liste = useRef<HTMLDivElement>(null);

  const resultats = useMemo(() => {
    const q = simplifier(texte.trim());
    const noms = new Map(clients.map((c) => [c.id, c.nom]));
    const toutes: Resultat[] = [
      { cle: 'a-facture', groupe: 'actions', titre: t('editor.newInvoice'), detail: '', lien: '/documents/nouveau?type=facture', icone: 'plus' },
      { cle: 'a-devis', groupe: 'actions', titre: t('editor.newQuote'), detail: '', lien: '/documents/nouveau?type=devis', icone: 'plus' },
      { cle: 'a-client', groupe: 'actions', titre: t('clients.new'), detail: '', lien: '/clients?nouveau=1', icone: 'plus' },
      ...PAGES.map((p): Resultat => ({ cle: `p-${p.lien}`, groupe: 'actions', titre: t(p.cle), detail: '', lien: p.lien, icone: p.icone })),
    ];
    const actions = toutes.filter((a) => !q || simplifier(a.titre).includes(q));
    if (!q) return actions;
    const documents: Resultat[] = docs
      .filter((d) => simplifier(`${d.numero} ${d.objet} ${d.client?.nom ?? noms.get(d.clientId ?? undefined) ?? ''}`).includes(q))
      .sort((a, b) => b.dateEmission.localeCompare(a.dateEmission) || (b.id ?? 0) - (a.id ?? 0))
      .slice(0, 8)
      .map((d) => ({
        cle: `d-${d.id}`,
        groupe: 'documents',
        titre: docLabel(d, t),
        detail: [d.client?.nom ?? noms.get(d.clientId ?? undefined), d.objet, fmtDate(d.dateEmission), fmtMoney(d.totalTTC)].filter(Boolean).join(' · '),
        lien: `/documents/${d.id}`,
        icone: 'file',
      }));
    const trouves: Resultat[] = clients
      .filter((c) => simplifier(`${c.nom} ${c.ville} ${c.email} ${c.siret}`).includes(q))
      .slice(0, 6)
      .map((c) => ({ cle: `c-${c.id}`, groupe: 'clients', titre: c.nom, detail: [c.ville, c.email].filter(Boolean).join(' · '), lien: `/clients?modifier=${c.id}`, icone: 'users' }));
    return [...documents, ...trouves, ...actions];
  }, [texte, docs, clients, t]);

  useEffect(() => setActif(0), [texte]);
  useEffect(() => {
    liste.current?.querySelector('.palette-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  const ouvrir = (r: Resultat | undefined) => {
    if (!r) return;
    fermer();
    navigate(r.lien);
  };
  const titres: Record<Groupe, string> = { actions: t('search.actions'), documents: t('nav.documents'), clients: t('nav.clients') };

  return (
    <>
      <input
        type="text"
        className="palette-input"
        autoFocus
        value={texte}
        placeholder={t('search.placeholder')}
        aria-label={t('search.title')}
        onChange={(e) => setTexte(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActif((i) => Math.min(i + 1, resultats.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActif((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            ouvrir(resultats[actif]);
          }
        }}
      />
      <div className="palette-list" ref={liste} role="listbox" aria-label={t('search.title')}>
        {resultats.length === 0 && <p className="small text-2" style={{ padding: '10px 4px' }}>{t('search.empty')}</p>}
        {resultats.map((r, i) => (
          <div key={r.cle}>
            {(i === 0 || resultats[i - 1].groupe !== r.groupe) && <div className="palette-group">{titres[r.groupe]}</div>}
            <button type="button" role="option" aria-selected={i === actif} className={`palette-item${i === actif ? ' active' : ''}`} onMouseEnter={() => setActif(i)} onClick={() => ouvrir(r)}>
              <Icon name={r.icone} size={16} />
              <span className="palette-title">{r.titre}</span>
              {r.detail && <span className="palette-detail">{r.detail}</span>}
            </button>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{t('search.hint')}</p>
    </>
  );
}

/** Recherche globale (Ctrl+K) : documents, clients, pages et actions courantes. */
export default function Recherche({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={t('search.title')}>
      {/* Le contenu n'est monté que lorsque la recherche est ouverte : aucune donnée n'est lue sinon. */}
      {open && <Contenu fermer={onClose} />}
    </Modal>
  );
}
