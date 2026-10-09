// Compile la version bureau en signant les artefacts de mise à jour.
//   npm run desktop:build
// La clé de signature (scripts/updater/afe-updater.key, non commitée) est lue automatiquement ;
// sinon, définissez TAURI_SIGNING_PRIVATE_KEY (contenu ou chemin) et TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(here, 'updater/afe-updater.key');
const env = { ...process.env };
if (!env.TAURI_SIGNING_PRIVATE_KEY && existsSync(keyPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, 'utf8').trim();
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= '';
}
if (!env.TAURI_SIGNING_PRIVATE_KEY) {
  console.error('Clé de signature des mises à jour absente : scripts/updater/afe-updater.key ou TAURI_SIGNING_PRIVATE_KEY.');
  process.exit(1);
}
const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tauri', 'build', ...process.argv.slice(2)], { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
