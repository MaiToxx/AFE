// Inspecte l'application de bureau en cours d'exécution (lancée avec
// WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223) : base IndexedDB, écran, erreurs console.
//   node scripts/inspect-desktop.mjs
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
const pages = await browser.pages();
const page = pages.find((p) => p.url().startsWith('http://tauri.localhost')) ?? pages[0];
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text().slice(0, 200)));
page.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 200)));
const info = await page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  const open = (name) => new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')); });
  const db = await open('afe');
  const stores = [...db.objectStoreNames];
  const counts = {};
  for (const s of stores) counts[s] = await new Promise((res) => { const t = db.transaction(s).objectStore(s).count(); t.onsuccess = () => res(t.result); });
  const profil = await new Promise((res) => { const t = db.transaction('profile').objectStore('profile').get(1); t.onsuccess = () => res(t.result); });
  const settings = await new Promise((res) => { const t = db.transaction('settings').objectStore('settings').getAll(); t.onsuccess = () => res(t.result); });
  db.close();
  return {
    url: location.href, title: document.title, dbs, version: db.version, counts,
    profil: profil && { nom: profil.nom, prenom: profil.prenom, ville: profil.ville },
    settings: settings.map((s) => s.key + '=' + String(s.value).slice(0, 12)),
    ecran: { h1: document.querySelector('h1')?.innerText, sousTitre: document.querySelector('.page-header p')?.innerText, badge: document.querySelector('.lic')?.innerText, version: document.querySelector('.nav-footer .version')?.innerText, bienvenue: !!document.querySelector('main')?.innerText.includes('Bienvenue') },
  };
});
await new Promise((r) => setTimeout(r, 1500));
console.log(JSON.stringify({ info, logs: logs.slice(0, 15) }, null, 1));
browser.disconnect();
