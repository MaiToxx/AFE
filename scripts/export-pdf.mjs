// Exporte un document en PDF via Edge/Chrome headless, en pilotant l'application
// servie par `npm run dev`. Utile pour les tests et les démonstrations.
//
//   node scripts/export-pdf.mjs <id-document> <fichier.pdf> [--demo] [--theme clair|sombre] [--url http://localhost:5173]
//
// --demo  : charge le jeu de démonstration dans un profil vierge avant l'export.
// --theme : force le style des documents (serveur de développement uniquement).
//
// Le navigateur est lancé à la main avec un port de débogage (plus robuste que le lancement
// par puppeteer quand Edge est déjà ouvert), puis piloté via puppeteer-core.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const [id, out] = args;
if (!id || !out) {
  console.error('Usage : node scripts/export-pdf.mjs <id-document> <fichier.pdf> [--demo] [--theme clair|sombre] [--url <base>]');
  process.exit(1);
}
const demo = args.includes('--demo');
const theme = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : '';
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5173';

const candidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);
const exe = candidates.find((p) => existsSync(p));
if (!exe) {
  console.error('Aucun navigateur Chromium (Edge/Chrome) trouvé ; définissez BROWSER_PATH.');
  process.exit(1);
}

const userDataDir = mkdtempSync(join(tmpdir(), 'afe-pdf-'));
const proc = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${userDataDir}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });

// Edge écrit le port choisi dans DevToolsActivePort une fois prêt.
const portFile = join(userDataDir, 'DevToolsActivePort');
let port = 0;
for (let i = 0; i < 100 && !port; i++) {
  await new Promise((r) => setTimeout(r, 100));
  if (existsSync(portFile)) port = Number(readFileSync(portFile, 'utf8').split(/\r?\n/)[0]);
}
if (!port) {
  proc.kill();
  console.error('Le navigateur headless ne répond pas (DevToolsActivePort absent).');
  process.exit(1);
}

const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null });
try {
  const page = await browser.newPage();
  if (demo) {
    await page.goto(`${base}/#/?demo=1`, { waitUntil: 'load' });
    // Le jeu de démo est chargé : au moins une facture apparaît dans « Dernières factures ».
    await page.waitForFunction(() => /F-\d{4}-\d{4}/.test(document.body.innerText), { timeout: 30_000 });
  }
  if (theme) {
    await page.evaluate(async (t) => {
      const m = await import('/src/db/db.ts');
      await m.saveProfile({ themeDocument: t });
    }, theme);
  }
  await page.goto(`${base}/#/documents/${id}/imprimer`, { waitUntil: 'load' });
  await page.waitForSelector('.sheet table.lines tbody tr', { timeout: 30_000 });
  await page.pdf({
    path: resolve(out),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  console.log(`PDF écrit : ${resolve(out)}`);
} finally {
  browser.disconnect();
  proc.kill();
  await new Promise((r) => setTimeout(r, 1500));
  // Edge peut garder le profil ouvert quelques instants : on réessaie, sans faire échouer l'export.
  try {
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    /* profil temporaire laissé dans le dossier Temp */
  }
}
