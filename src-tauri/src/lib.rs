mod essai;

/// Marques du début de la période d'essai conservées hors du dossier de l'application.
#[tauri::command]
fn marques_essai_lire() -> Vec<String> {
    essai::lire()
}

/// Consigne le début de la période d'essai ; renvoie le nombre d'emplacements écrits.
#[tauri::command]
fn marques_essai_ecrire(marque: String) -> u8 {
    essai::ecrire(&marque)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![marques_essai_lire, marques_essai_ecrire])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application AFE");
}
