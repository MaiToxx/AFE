// Encodage / signature / vérification des clés de licence AFE (ECDSA P-256, SHA-256).
// Format d'une clé : AFE1-<base64url(JSON charge utile)>.<base64url(signature r||s)>
import { createPrivateKey, createPublicKey, randomBytes, sign, verify } from 'node:crypto';

export const PREFIX = 'AFE1-';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

export function encodeKey(payload, privateJwk) {
  const data = Buffer.from(JSON.stringify(payload), 'utf8');
  const key = createPrivateKey({ key: privateJwk, format: 'jwk' });
  const sig = sign('sha256', data, { key, dsaEncoding: 'ieee-p1363' });
  return `${PREFIX}${b64u(data)}.${b64u(sig)}`;
}

export function decodeKey(rawKey, publicJwk) {
  const clean = String(rawKey).replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) return { ok: false, reason: 'préfixe invalide' };
  const [p, s] = clean.slice(PREFIX.length).split('.');
  if (!p || !s) return { ok: false, reason: 'format invalide' };
  const data = fromB64u(p);
  const sig = fromB64u(s);
  const key = createPublicKey({ key: publicJwk, format: 'jwk' });
  if (!verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig)) return { ok: false, reason: 'signature invalide' };
  return { ok: true, payload: JSON.parse(data.toString('utf8')) };
}

export const newId = () => randomBytes(4).toString('hex').toUpperCase();

// Extrait l'objet JWK du fichier src/lib/license-public-key.ts
export function readPublicJwk(tsSource) {
  const m = tsSource.match(/=\s*(\{[\s\S]*?\})\s*as const/);
  if (!m) throw new Error('Clé publique introuvable dans license-public-key.ts');
  return JSON.parse(m[1]);
}
