// Modèles du message envoyé au client avec sa clé, dans les sept langues de l'application.
// Les noms de menus (« Paramètres → Licence », « Activer ») reprennent ceux de l'interface d'AFE.

export const LANGUES = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
};

const LOCALES = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', de: 'de-DE', it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL' };

const MODELES = {
  fr: {
    objet: 'Votre licence AFE',
    objetRenouvellement: 'Votre nouvelle clé de licence AFE',
    bonjour: 'Bonjour {nom},',
    intro: 'Merci pour votre achat. Voici votre clé de licence AFE :',
    introRenouvellement: 'Votre abonnement AFE est renouvelé. Voici votre nouvelle clé de licence :',
    activer: 'Pour l’activer, ouvrez AFE, allez dans Paramètres → Licence, collez la clé puis cliquez sur « Activer ».',
    activerRenouvellement: 'Collez-la dans Paramètres → Licence puis cliquez sur « Activer » : elle remplace la précédente.',
    jusquau: 'Elle est valable jusqu’au {date}.',
    sansLimite: 'Elle est valable sans limite de durée.',
    conserver: 'Conservez ce message : la clé vous servira si vous changez d’ordinateur.',
    salutation: 'Cordialement,',
  },
  en: {
    objet: 'Your AFE licence',
    objetRenouvellement: 'Your new AFE licence key',
    bonjour: 'Hello {nom},',
    intro: 'Thank you for your purchase. Here is your AFE licence key:',
    introRenouvellement: 'Your AFE subscription has been renewed. Here is your new licence key:',
    activer: 'To activate it, open AFE, go to Settings → Licence, paste the key and click “Activate”.',
    activerRenouvellement: 'Paste it in Settings → Licence and click “Activate”: it replaces the previous one.',
    jusquau: 'It is valid until {date}.',
    sansLimite: 'It is valid with no time limit.',
    conserver: 'Keep this message: you will need the key if you change computers.',
    salutation: 'Kind regards,',
  },
  es: {
    objet: 'Su licencia de AFE',
    objetRenouvellement: 'Su nueva clave de licencia de AFE',
    bonjour: 'Hola, {nom}:',
    intro: 'Gracias por su compra. Esta es su clave de licencia de AFE:',
    introRenouvellement: 'Su suscripción a AFE ha sido renovada. Esta es su nueva clave de licencia:',
    activer: 'Para activarla, abra AFE, vaya a Ajustes → Licencia, pegue la clave y pulse «Activar».',
    activerRenouvellement: 'Péguela en Ajustes → Licencia y pulse «Activar»: sustituye a la anterior.',
    jusquau: 'Es válida hasta el {date}.',
    sansLimite: 'Es válida sin límite de tiempo.',
    conserver: 'Conserve este mensaje: necesitará la clave si cambia de ordenador.',
    salutation: 'Un saludo,',
  },
  de: {
    objet: 'Ihre AFE-Lizenz',
    objetRenouvellement: 'Ihr neuer AFE-Lizenzschlüssel',
    bonjour: 'Guten Tag {nom},',
    intro: 'vielen Dank für Ihren Kauf. Hier ist Ihr AFE-Lizenzschlüssel:',
    introRenouvellement: 'Ihr AFE-Abonnement wurde verlängert. Hier ist Ihr neuer Lizenzschlüssel:',
    activer: 'Zum Aktivieren öffnen Sie AFE, gehen Sie zu Einstellungen → Lizenz, fügen Sie den Schlüssel ein und klicken Sie auf „Aktivieren“.',
    activerRenouvellement: 'Fügen Sie ihn unter Einstellungen → Lizenz ein und klicken Sie auf „Aktivieren“: Er ersetzt den bisherigen Schlüssel.',
    jusquau: 'Er ist bis zum {date} gültig.',
    sansLimite: 'Er ist zeitlich unbegrenzt gültig.',
    conserver: 'Bewahren Sie diese Nachricht auf: Sie benötigen den Schlüssel bei einem Rechnerwechsel.',
    salutation: 'Mit freundlichen Grüßen',
  },
  it: {
    objet: 'La tua licenza AFE',
    objetRenouvellement: 'La tua nuova chiave di licenza AFE',
    bonjour: 'Buongiorno {nom},',
    intro: 'grazie per l’acquisto. Ecco la tua chiave di licenza AFE:',
    introRenouvellement: 'il tuo abbonamento AFE è stato rinnovato. Ecco la tua nuova chiave di licenza:',
    activer: 'Per attivarla, apri AFE, vai in Impostazioni → Licenza, incolla la chiave e fai clic su «Attiva».',
    activerRenouvellement: 'Incollala in Impostazioni → Licenza e fai clic su «Attiva»: sostituisce la precedente.',
    jusquau: 'È valida fino al {date}.',
    sansLimite: 'È valida senza limiti di tempo.',
    conserver: 'Conserva questo messaggio: la chiave ti servirà se cambi computer.',
    salutation: 'Cordiali saluti,',
  },
  pt: {
    objet: 'A sua licença AFE',
    objetRenouvellement: 'A sua nova chave de licença AFE',
    bonjour: 'Bom dia, {nom},',
    intro: 'Obrigado pela sua compra. Esta é a sua chave de licença AFE:',
    introRenouvellement: 'A sua subscrição AFE foi renovada. Esta é a sua nova chave de licença:',
    activer: 'Para a ativar, abra o AFE, vá a Definições → Licença, cole a chave e clique em «Ativar».',
    activerRenouvellement: 'Cole-a em Definições → Licença e clique em «Ativar»: substitui a anterior.',
    jusquau: 'É válida até {date}.',
    sansLimite: 'É válida sem limite de tempo.',
    conserver: 'Guarde esta mensagem: precisará da chave se mudar de computador.',
    salutation: 'Com os melhores cumprimentos,',
  },
  nl: {
    objet: 'Uw AFE-licentie',
    objetRenouvellement: 'Uw nieuwe AFE-licentiesleutel',
    bonjour: 'Beste {nom},',
    intro: 'Bedankt voor uw aankoop. Dit is uw AFE-licentiesleutel:',
    introRenouvellement: 'Uw AFE-abonnement is verlengd. Dit is uw nieuwe licentiesleutel:',
    activer: 'Om te activeren opent u AFE, gaat u naar Instellingen → Licentie, plakt u de sleutel en klikt u op „Activeren”.',
    activerRenouvellement: 'Plak hem in Instellingen → Licentie en klik op „Activeren”: hij vervangt de vorige.',
    jusquau: 'Hij is geldig tot {date}.',
    sansLimite: 'Hij is onbeperkt geldig.',
    conserver: 'Bewaar dit bericht: u hebt de sleutel nodig als u van computer verandert.',
    salutation: 'Met vriendelijke groeten,',
  },
};

/**
 * Compose l'objet et le corps du message.
 * @param {{ langue: string, renouvellement: boolean, nom: string, cle: string, expire: string, signature: string }} p
 */
export function composer({ langue, renouvellement, nom, cle, expire, signature }) {
  const code = MODELES[langue] ? langue : 'fr';
  const m = MODELES[code];
  const date = expire ? new Date(expire + 'T12:00:00').toLocaleDateString(LOCALES[code], { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const lignes = [
    m.bonjour.replace('{nom}', nom),
    '',
    renouvellement ? m.introRenouvellement : m.intro,
    '',
    cle,
    '',
    renouvellement ? m.activerRenouvellement : m.activer,
    expire ? m.jusquau.replace('{date}', date) : m.sansLimite,
    '',
    m.conserver,
    '',
    m.salutation,
    signature,
  ];
  return { objet: renouvellement ? m.objetRenouvellement : m.objet, corps: lignes.join('\n') };
}

const enc = encodeURIComponent;

/** Lien mailto: (sauts de ligne en CRLF, comme l'exige le format). */
export function lienCourriel(email, objet, corps) {
  return `mailto:${enc(email).replace(/%40/g, '@')}?subject=${enc(objet)}&body=${enc(String(corps).replace(/\r?\n/g, '\r\n'))}`;
}

/** Fenêtre de rédaction Gmail pré-remplie. */
export function lienGmail(email, objet, corps) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(email)}&su=${enc(objet)}&body=${enc(corps)}`;
}
