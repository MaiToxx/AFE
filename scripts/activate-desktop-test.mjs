// Test : active la licence de test dans l'application de bureau en cours (port debug 9223) et vérifie l'écriture.
import puppeteer from 'puppeteer-core';
const key = process.argv[2];
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9223', defaultViewport: null });
const page = (await browser.pages()).find((p) => p.url().startsWith('http://tauri.localhost'));
await page.evaluate(() => { location.hash = '#/parametres?tab=licence'; });
await new Promise((r) => setTimeout(r, 1200));
await page.evaluate((k) => {
  const ta = document.querySelector('textarea[aria-label="Clé de licence"]');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, k);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}, key);
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Activer').click());
await new Promise((r) => setTimeout(r, 1500));
const res = await page.evaluate(async () => {
  const notice = document.querySelector('.notice')?.innerText;
  const badge = document.querySelector('.lic')?.innerText;
  const db = await new Promise((res, rej) => { const r = indexedDB.open('afe'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const settings = await new Promise((res) => { const t = db.transaction('settings').objectStore('settings').getAll(); t.onsuccess = () => res(t.result); });
  db.close();
  return { notice, badge, settings: settings.map((s) => s.key + '=' + String(s.value).slice(0, 16)) };
});
console.log(JSON.stringify(res, null, 1));
browser.disconnect();
