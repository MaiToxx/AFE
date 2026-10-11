/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Version de package.json, injectée par Vite (vite.config.ts → define). */
declare const __APP_VERSION__: string;
/** Jour de la compilation (ISO), injecté par Vite : repère de date que l'utilisateur ne peut pas modifier. */
declare const __BUILD_DATE__: string;
