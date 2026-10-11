import { useMemo } from 'react';
import { qrMatrix } from '../lib/sepa';

/** Marge blanche autour du code, en modules (la norme en demande quatre pour une lecture fiable). */
const MARGE = 4;

/** QR code dessiné en SVG, toujours noir sur blanc, quel que soit le thème du document. */
export default function QrCode({ value, size = 112, label }: { value: string; size?: number; label?: string }) {
  const { cote, trace } = useMemo(() => {
    const m = qrMatrix(value);
    let d = '';
    m.forEach((ligne, r) => ligne.forEach((sombre, c) => (d += sombre ? `M${c + MARGE},${r + MARGE}h1v1h-1z` : '')));
    return { cote: m.length + 2 * MARGE, trace: d };
  }, [value]);
  return (
    <svg viewBox={`0 0 ${cote} ${cote}`} width={size} height={size} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={cote} height={cote} fill="#fff" />
      <path d={trace} fill="#000" />
    </svg>
  );
}
