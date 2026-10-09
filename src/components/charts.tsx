import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui';

export interface Series {
  name: string;
  color: string;
  values: number[];
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.max(260, Math.floor(e.contentRect.width)));
    });
    ro.observe(el);
    if (el.clientWidth) setW(Math.max(260, el.clientWidth));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 8 ? 8 : 10;
  return nf * p;
}

interface BarChartProps {
  categories: string[];
  series: Series[];
  format: (n: number) => string;
  formatTick?: (n: number) => string;
  highlightIndex?: number;
  height?: number;
  ariaLabel: string;
  /** Libellé de la colonne « catégorie » dans la vue tableau. */
  categoryLabel?: string;
}

/**
 * Histogramme groupé (1 ou 2 séries) : barres fines à bout arrondi, grille en filet,
 * survol par colonne avec infobulle listant toutes les séries, légende dès 2 séries,
 * et vue tableau équivalente.
 */
export function BarChart({ categories, series, format, formatTick = format, highlightIndex, height = 240, ariaLabel, categoryLabel = 'Période' }: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const yMax = niceCeil(max > 0 ? max * 1.08 : 1);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const tickW = Math.max(...ticks.map((t) => formatTick(t).length)) * 6.6 + 14;
  const m = { top: 20, right: 12, bottom: 28, left: Math.ceil(tickW) };
  const plotW = Math.max(60, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const n = Math.max(1, categories.length);
  const bandW = plotW / n;
  const k = Math.max(1, series.length);
  const gap = 2;
  const groupW = Math.min(bandW * 0.72, k * 24 + (k - 1) * gap);
  const barW = Math.max(2, (groupW - (k - 1) * gap) / k);
  const yb = m.top + plotH;
  const y = (v: number) => yb - (v / yMax) * plotH;
  const x0 = (i: number) => m.left + i * bandW + (bandW - groupW) / 2;
  const empty = max <= 0;

  const barPath = (x: number, yTop: number, w: number) => {
    const h = yb - yTop;
    const r = Math.min(4, w / 2, h);
    return `M${x},${yb} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + w - r} Q${x + w},${yTop} ${x + w},${yTop + r} V${yb} Z`;
  };

  const hi = highlightIndex;
  const hiVal = hi !== undefined ? series[0]?.values[hi] ?? 0 : 0;

  return (
    <div className="chart-block">
      <div className="chart-tools" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {series.length >= 2 ? (
          <div className="legend" aria-label="Légende">
            {series.map((s) => (
              <span key={s.name} className="key">
                <i className="swatch" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <button type="button" className="btn ghost sm" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          <Icon name={table ? 'chart' : 'table'} size={15} />
          {table ? 'Graphique' : 'Tableau'}
        </button>
      </div>

      {table ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{categoryLabel}</th>
                {series.map((s) => (
                  <th key={s.name} className="num">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c} className={i === hi ? 'current' : ''}>
                  <td>{c}</td>
                  {series.map((s) => (
                    <td key={s.name} className="num">{format(s.values[i] ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {series.map((s) => (
                  <td key={s.name} className="num">{format(s.values.reduce((a, b) => a + b, 0))}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="chart" ref={ref} onPointerLeave={() => setHover(null)} style={{ height }}>
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel}>
            {ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'baseline' : 'grid-line'} x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
                <text className="tick" x={m.left - 8} y={y(t) + 4} textAnchor="end">
                  {formatTick(t)}
                </text>
              </g>
            ))}
            {categories.map((c, i) => (
              <g key={c} className={`band${hover !== null && hover !== i ? ' dim' : ''}`}>
                {hover === i && <rect x={m.left + i * bandW} y={m.top} width={bandW} height={plotH} fill="var(--surface-2)" />}
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (v <= 0) return null;
                  const xx = x0(i) + si * (barW + gap);
                  return <path key={s.name} className="bar" d={barPath(xx, y(v), barW)} fill={s.color} />;
                })}
                {hi === i && hiVal > 0 && bandW >= 34 && (
                  <text className="end-label" x={x0(i) + barW / 2} y={y(hiVal) - 6} textAnchor="middle">
                    {format(hiVal)}
                  </text>
                )}
                <text className="tick" x={m.left + i * bandW + bandW / 2} y={height - 8} textAnchor="middle">
                  {c}
                </text>
                <rect
                  className="hit"
                  x={m.left + i * bandW}
                  y={m.top}
                  width={bandW}
                  height={plotH}
                  tabIndex={0}
                  onPointerMove={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${c} : ${series.map((s) => `${s.name} ${format(s.values[i] ?? 0)}`).join(', ')}`}
                />
              </g>
            ))}
          </svg>
          {hover !== null && (
            <Tooltip
              x={m.left + hover * bandW + bandW / 2}
              flip={m.left + hover * bandW + bandW / 2 > width - 180}
              top={m.top}
              title={categories[hover]}
              rows={series.map((s) => ({ name: s.name, color: s.color, value: format(s.values[hover] ?? 0) }))}
            />
          )}
          {empty && (
            <div className="muted small" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              Aucune donnée sur cette période
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tooltip({ x, flip, top, title, rows }: { x: number; flip: boolean; top: number; title: string; rows: { name: string; color: string; value: string }[] }) {
  const style: React.CSSProperties = flip ? { right: `calc(100% - ${x - 10}px)`, top } : { left: x + 10, top };
  return (
    <div className="tooltip" style={style} role="status">
      <div className="tt-title">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="tt-row">
          <span className="k">
            <i style={{ background: r.color }} />
            {r.name}
          </span>
          <b>{r.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Meter({ label, value, max, format, marker, note, goal = false }: {
  label: ReactNode;
  value: number;
  max: number;
  format: (n: number) => string;
  marker?: { value: number; label: string };
  note?: ReactNode;
  /** Objectif à atteindre (vert une fois atteint) plutôt que seuil à ne pas dépasser. */
  goal?: boolean;
}) {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const severity = goal ? (ratio >= 1 ? 'good' : '') : ratio >= 1 ? 'critical' : ratio >= 0.8 ? 'warning' : '';
  const status = goal
    ? ratio >= 1 ? 'Objectif atteint' : `${Math.round(ratio * 100)} % de l’objectif`
    : ratio >= 1 ? 'Seuil dépassé' : ratio >= 0.8 ? 'Proche du seuil' : 'Sous le seuil';
  return (
    <div className={`meter ${severity}`}>
      <div className="meter-head">
        <span className="label">{label}</span>
        <span className="tnum small text-2">
          <b style={{ color: 'var(--text)' }}>{format(value)}</b> / {format(max)} · {Math.round(ratio * 100)} %
        </span>
      </div>
      <div className="meter-track" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={typeof label === 'string' ? label : undefined}>
        <div className="meter-fill" style={{ width: `${pct}%` }} />
        {marker && marker.value < max && <div className="meter-mark" style={{ left: `${(marker.value / max) * 100}%` }} title={marker.label} />}
      </div>
      <div className="meter-foot">
        <span className={`status ${severity}`}>
          <Icon name={goal ? (ratio >= 1 ? 'checkCircle' : 'info') : ratio >= 1 ? 'alert' : ratio >= 0.8 ? 'info' : 'checkCircle'} size={14} />
          {status}
        </span>
        {note && <span>{note}</span>}
      </div>
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card stat">
      <span className="label muted">{label}</span>
      <span className="value">{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
}
