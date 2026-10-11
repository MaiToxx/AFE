import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon, Seg } from '../components/ui';
import { db } from '../db/db';
import { useDocuments, usePaiements, useProfile } from '../db/hooks';
import { tIn, useI18n, type Lang } from '../i18n';
import { todayISO } from '../lib/dates';
import { montantDu } from '../lib/documents';
import { resteDu } from '../lib/echeances';
import { fmtDate, fmtMoneyIn, round2 } from '../lib/format';
import { encaisseParFacture } from '../lib/stats';
import { localeFor } from '../regimes';

type Vue = 'impayees' | 'toutes';

/** Relevé de compte d'un client : ses factures émises, ce qui a été réglé et ce qui reste dû, prêt à imprimer. */
export default function ReleveClient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { profile, loaded } = useProfile();
  const docs = useDocuments();
  const paiements = usePaiements();
  const [vue, setVue] = useState<Vue>('impayees');
  // `undefined` pendant la lecture, `null` si le client n'existe pas.
  const client = useLiveQuery(() => db.clients.get(Number(id)).then((c) => c ?? null), [id]);
  const today = todayISO();

  const lang: Lang = client?.langue || profile.langueDocuments;
  const tl = (key: string, vars?: Record<string, string | number>) => tIn(lang, key, vars);
  const locale = localeFor(lang, profile.pays);
  const date = (iso: string) => fmtDate(iso, locale);

  const lignes = useMemo(() => {
    const encaisse = encaisseParFacture(paiements);
    return docs
      .filter((d) => d.type === 'facture' && d.clientId === Number(id) && d.statut !== 'brouillon' && d.statut !== 'annulee')
      .map((d) => {
        const reste = resteDu(d, encaisse);
        return { doc: d, devise: d.devise || profile.devise, montant: montantDu(d), regle: round2(montantDu(d) - reste), reste, retard: reste > 0 && d.dateEcheance < today };
      })
      .filter((l) => vue === 'toutes' || l.reste > 0)
      .sort((a, b) => a.doc.dateEmission.localeCompare(b.doc.dateEmission) || (a.doc.id ?? 0) - (b.doc.id ?? 0));
  }, [docs, paiements, id, vue, profile.devise, today]);

  // Un total par devise : des montants en devises différentes ne s'additionnent pas.
  const totaux = useMemo(() => {
    const out = new Map<string, { montant: number; regle: number; reste: number }>();
    for (const l of lignes) {
      const s = out.get(l.devise) ?? { montant: 0, regle: 0, reste: 0 };
      out.set(l.devise, { montant: round2(s.montant + l.montant), regle: round2(s.regle + l.regle), reste: round2(s.reste + l.reste) });
    }
    return [...out.entries()];
  }, [lignes]);

  useEffect(() => {
    if (!client) return;
    const prev = document.title;
    document.title = `${tIn(lang, 'print.statementTitle')} - ${client.nom}`;
    return () => {
      document.title = prev;
    };
  }, [client, lang]);

  if (!loaded || client === undefined) return <div className="print-stage"><p className="muted">{t('common.loading')}</p></div>;
  if (!client) return <div className="print-stage"><p>{t('print.statementNoClient')}</p></div>;

  const emetteur = profile.denomination || `${profile.prenom} ${profile.nom}`.trim() || tl('print.yourName');
  const c = lang === 'fr' ? ' : ' : ': ';

  return (
    <div className="print-stage">
      <div className="print-toolbar no-print" style={{ margin: '-28px -16px 24px' }}>
        <button type="button" className="btn ghost" onClick={() => navigate('/clients')}>
          <Icon name="back" /> {t('clients.title')}
        </button>
        <Seg<Vue>
          size="sm"
          value={vue}
          onChange={setVue}
          options={[
            { value: 'impayees', label: t('clients.statementUnpaid') },
            { value: 'toutes', label: t('clients.statementAll') },
          ]}
        />
        <span className="spacer" style={{ flex: 1 }} />
        <span className="small text-2">{t('print.hint')}</span>
        <button type="button" className="btn primary" onClick={() => window.print()}>
          <Icon name="print" /> {t('common.printPdf')}
        </button>
      </div>

      <article className={`sheet${profile.themeDocument === 'sombre' ? ' sheet-dark' : ''}`} style={{ ['--doc-accent' as string]: profile.couleur || '#2a78d6' }} lang={lang}>
        <header className="sheet-head">
          <div className="sheet-emitter">
            {profile.logo && <img className="sheet-logo" src={profile.logo} alt="" style={{ display: 'block', marginBottom: 10 }} />}
            <strong>{emetteur}</strong>
            {profile.adresse && <div>{profile.adresse}</div>}
            {(profile.codePostal || profile.ville) && <div>{profile.codePostal} {profile.ville}</div>}
            {profile.email && <div>{profile.email}</div>}
            {profile.telephone && <div>{profile.telephone}</div>}
          </div>
          <div className="sheet-title">
            <h1 style={{ fontSize: '19pt' }}>{tl('print.statementTitle')}</h1>
            <div className="dates">{tl('print.statementAt', { date: date(today) })}</div>
          </div>
        </header>

        <section className="sheet-parties">
          <div className="sheet-box">
            <div className="lbl">{tl('print.issuer')}</div>
            <strong>{emetteur}</strong>
          </div>
          <div className="sheet-box">
            <div className="lbl">{tl('print.addressedTo')}</div>
            <strong>{client.nom}</strong>
            {client.adresse && <div>{client.adresse}</div>}
            {(client.codePostal || client.ville) && <div>{client.codePostal} {client.ville}</div>}
            {client.pays && <div>{client.pays}</div>}
          </div>
        </section>

        {lignes.length === 0 ? (
          <p className="meta">{tl(vue === 'impayees' ? 'print.statementNothingDue' : 'print.statementEmpty')}</p>
        ) : (
          <>
            <table className="lines">
              <thead>
                <tr>
                  <th>{tl('print.date')}</th>
                  <th>{tl('print.invoice')}</th>
                  <th>{tl('print.dueDate')}</th>
                  <th className="num">{tl('print.statementAmount')}</th>
                  <th className="num">{tl('print.alreadyPaid')}</th>
                  <th className="num">{tl('print.remaining')}</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.doc.id}>
                    <td>{date(l.doc.dateEmission)}</td>
                    <td>
                      {l.doc.numero}
                      {l.doc.objet && <div className="meta" style={{ fontSize: '8.5pt' }}>{l.doc.objet}</div>}
                    </td>
                    <td>
                      {date(l.doc.dateEcheance)}
                      {l.retard && <div style={{ fontSize: '8.5pt', fontWeight: 600 }}>{tl('print.statementLate')}</div>}
                    </td>
                    <td className="num">{fmtMoneyIn(locale, l.devise, l.montant)}</td>
                    <td className="num">{l.regle > 0 ? fmtMoneyIn(locale, l.devise, l.regle) : '—'}</td>
                    <td className="num"><b>{l.reste > 0 ? fmtMoneyIn(locale, l.devise, l.reste) : '—'}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="totals-block">
              <table>
                <tbody>
                  {totaux.map(([devise, s]) => (
                    <tr key={devise} className="grand"><td>{tl('print.statementTotalDue')}</td><td>{fmtMoneyIn(locale, devise, s.reste)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <section className="mentions">
          {(profile.iban || profile.bic) && lignes.some((l) => l.reste > 0) && (
            <div>
              <h4>{tl('print.paymentTerms')}</h4>
              <div>
                {profile.iban && <>IBAN{c}{profile.iban}</>}
                {profile.iban && profile.bic && ' · '}
                {profile.bic && <>BIC{c}{profile.bic}</>}
              </div>
            </div>
          )}
          <div>{tl('print.statementDisclaimer')}</div>
        </section>

        <footer className="sheet-foot">
          <div>{[emetteur, profile.adresse && `${profile.adresse}, ${profile.codePostal} ${profile.ville}`.trim(), profile.email, profile.telephone].filter(Boolean).join(' · ')}</div>
        </footer>
      </article>
    </div>
  );
}
