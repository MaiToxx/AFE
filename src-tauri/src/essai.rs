//! Début de la période d'essai, consigné hors du dossier de l'application.
//!
//! Le désinstalleur peut effacer les données de l'application (`%APPDATA%\fr.afe.desktop` et
//! `%LOCALAPPDATA%\fr.afe.desktop`). Pour qu'une réinstallation ne redonne pas une période d'essai
//! complète, la date de début est aussi conservée à deux endroits qu'il ne touche pas : une valeur
//! du registre (propre à l'utilisateur) et un fichier sous `%PROGRAMDATA%` (commun à la machine).
//! La valeur est une courte chaîne opaque, encodée et contrôlée par l'interface (`src/lib/trial.ts`).

use std::path::{Path, PathBuf};

const DOSSIER: &str = "fr.afe.support";
const VALEUR: &str = "etat";
const FICHIER: &str = "etat.dat";

/// Seules de courtes chaînes alphanumériques sont lues ou écrites, quoi que demande l'interface.
pub fn valide(marque: &str) -> bool {
    !marque.is_empty() && marque.len() <= 64 && marque.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn cle_registre() -> String {
    format!("Software\\{DOSSIER}")
}

fn fichier() -> Option<PathBuf> {
    std::env::var_os("PROGRAMDATA").map(|d| PathBuf::from(d).join(DOSSIER).join(FICHIER))
}

#[cfg(windows)]
fn registre_lire(cle: &str) -> Option<String> {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    RegKey::predef(HKEY_CURRENT_USER).open_subkey(cle).ok()?.get_value::<String, _>(VALEUR).ok()
}

#[cfg(windows)]
fn registre_ecrire(cle: &str, marque: &str) -> bool {
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    match RegKey::predef(HKEY_CURRENT_USER).create_subkey(cle) {
        Ok((k, _)) => k.set_value(VALEUR, &marque).is_ok(),
        Err(_) => false,
    }
}

#[cfg(not(windows))]
fn registre_lire(_cle: &str) -> Option<String> {
    None
}

#[cfg(not(windows))]
fn registre_ecrire(_cle: &str, _marque: &str) -> bool {
    false
}

/// Marques valides trouvées aux emplacements donnés : aucune, une ou deux.
pub fn lire_dans(cle: &str, fichier: Option<&Path>) -> Vec<String> {
    let mut marques = Vec::new();
    if let Some(v) = registre_lire(cle) {
        marques.push(v);
    }
    if let Some(v) = fichier.and_then(|f| std::fs::read_to_string(f).ok()) {
        marques.push(v);
    }
    marques.into_iter().map(|m| m.trim().to_string()).filter(|m| valide(m)).collect()
}

/// Écrit la marque aux emplacements donnés et renvoie le nombre d'écritures réussies.
pub fn ecrire_dans(cle: &str, fichier: Option<&Path>, marque: &str) -> u8 {
    if !valide(marque) {
        return 0;
    }
    let mut ecrites = 0;
    if registre_ecrire(cle, marque) {
        ecrites += 1;
    }
    if let Some(f) = fichier {
        if let Some(dossier) = f.parent() {
            let _ = std::fs::create_dir_all(dossier);
        }
        if std::fs::write(f, marque).is_ok() {
            ecrites += 1;
        }
    }
    ecrites
}

pub fn lire() -> Vec<String> {
    lire_dans(&cle_registre(), fichier().as_deref())
}

pub fn ecrire(marque: &str) -> u8 {
    ecrire_dans(&cle_registre(), fichier().as_deref(), marque)
}
