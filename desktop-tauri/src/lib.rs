#[cfg(target_os = "macos")]
use serde::Serialize;

#[cfg(target_os = "macos")]
#[derive(Debug, Serialize)]
struct CaptureSource {
    id: String,
    kind: String,
    title: String,
    application: Option<String>,
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn list_capture_sources() -> Result<Vec<CaptureSource>, String> {
    use screencapturekit::prelude::*;

    let content = SCShareableContent::get().map_err(|error| error.to_string())?;
    let mut sources = Vec::new();

    for display in content.displays() {
        sources.push(CaptureSource {
            id: format!("display:{}", display.display_id()),
            kind: "display".into(),
            title: format!("Monitor {} ({}x{})", display.display_id(), display.width(), display.height()),
            application: None,
        });
    }

    for window in content.windows().iter().filter(|window| window.is_on_screen()) {
        let application = window.owning_application().map(|app| app.application_name());
        let title = window.title().unwrap_or_default();
        if title.is_empty() { continue; }
        sources.push(CaptureSource {
            id: format!("window:{}", window.window_id()),
            kind: "window".into(),
            title,
            application,
        });
    }

    Ok(sources)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn list_capture_sources() -> Result<Vec<serde_json::Value>, String> {
    Err("A captura nativa está disponível nesta etapa apenas no macOS.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![list_capture_sources])
        .run(tauri::generate_context!())
        .expect("error while running Aurora");
}

