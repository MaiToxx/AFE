// Exporte un document en PDF via Edge/Chrome headless, en pilotant l'application
// servie par `npm run dev`. Utile pour les tests et les démonstrations.
//
//   node scripts/export-pdf.mjs <id-document> <fichier.pdf> [--demo] [--url http://localhost:5173]
//
// --demo : charge le jeu de démonstration dans un profil vierge avant l'export.

import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const [id, out] = args;
if (!id || !out) {
  console.error('Usage : node scripts/export-pdf.mjs <id-document> <fichier.pdf> [--demo] [--url <base>]');
  process.exit(1);
}
const demo = args.includes('--demo');
const base = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'http://localhost:5173';

const candidates = [
  process.env.BROWSER_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const browser = await puppeteer.launch({
  headless: true,
  executablePath: candidates.find((p) => existsSync(p)) ?? candidates[1],
  userDataDir: mkdtempSync(join(tmpdir(), 'afe-pdf-')),
  args: ['--disable-gpu', '--no-first-run'],
});

try {
  const page = await browser.newPage();
  if (demo) {
    await page.goto(`${base}/#/?demo=1`, { waitUntil: 'load' });
    // Le jeu de démo est chargé : au moins une facture apparaît dans « Dernières factures ».
    await page.waitForFunction(() => /F-\d{4}-\d{4}/.test(document.body.innerText), { timeout: 30_000 });
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
  await browser.close();
}
