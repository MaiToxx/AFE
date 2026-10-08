// Pas de console noire derrière la fenêtre en version release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    afe_lib::run()
}
