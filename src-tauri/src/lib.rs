mod db;
mod domain;

use db::{Db, Measurement, Profile};
use rusqlite::Connection;
use domain::{bmi, bmi_category, generate_plan, progress_percent, weekly_trend, Plan};
use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize)]
struct Dashboard {
    current_weight_kg: Option<f64>,
    target_weight_kg: Option<f64>,
    bmi: Option<f64>,
    bmi_category: Option<String>,
    delta_to_target_kg: Option<f64>,
    progress_percent: Option<f64>,
    weekly_trend_kg: Option<f64>,
    monthly_trend_kg: Option<f64>,
    total_change_kg: Option<f64>,
    measurement_count: usize,
}

fn db<'a>(state: &'a tauri::State<'a, Db>) -> &'a Db {
    state.inner()
}

fn parse_target(state: &tauri::State<Db>) -> Result<Option<f64>, String> {
    Ok(db(state)
        .get_setting("target_weight_kg")?
        .and_then(|v| v.parse().ok()))
}

fn build_dashboard(state: &tauri::State<Db>) -> Result<Dashboard, String> {
    let d = db(state);
    let profile = d.get_profile()?;
    let measurements = d.list_measurements()?;
    let target = parse_target(state)?;

    let current = measurements.last().map(|m| m.weight_kg);
    let bmi_val = profile
        .as_ref()
        .and_then(|p| current.map(|w| bmi(w, p.height_cm)).flatten());

    let now = chrono::Utc::now().timestamp();
    let points: Vec<(i64, f64)> = measurements
        .iter()
        .map(|m| (m.measured_at, m.weight_kg))
        .collect();
    let week_pts: Vec<(i64, f64)> = points
        .iter()
        .cloned()
        .filter(|(t, _)| *t >= now - 7 * 86_400)
        .collect();
    let month_pts: Vec<(i64, f64)> = points
        .iter()
        .cloned()
        .filter(|(t, _)| *t >= now - 30 * 86_400)
        .collect();
    let first = measurements.first().map(|m| m.weight_kg);
    let initial = profile
        .as_ref()
        .map(|p| p.initial_weight_kg)
        .filter(|w| *w > 0.0)
        .or(first);

    Ok(Dashboard {
        current_weight_kg: current,
        target_weight_kg: target,
        bmi: bmi_val,
        bmi_category: bmi_val.map(|b| format!("{:?}", bmi_category(b))),
        delta_to_target_kg: current.zip(target).map(|(c, t)| c - t),
        progress_percent: initial
            .zip(current)
            .zip(target)
            .map(|((i, c), t)| progress_percent(i, c, t)),
        weekly_trend_kg: weekly_trend(&week_pts),
        monthly_trend_kg: weekly_trend(&month_pts).map(|w| w * 30.0 / 7.0),
        total_change_kg: first.zip(current).map(|(f, c)| c - f),
        measurement_count: measurements.len(),
    })
}

#[tauri::command]
fn get_profile(state: tauri::State<Db>) -> Result<Option<Profile>, String> {
    db(&state).get_profile()
}

#[tauri::command]
fn save_profile(state: tauri::State<Db>, profile: Profile) -> Result<(), String> {
    db(&state).save_profile(&profile)
}

#[tauri::command]
fn list_measurements(state: tauri::State<Db>) -> Result<Vec<Measurement>, String> {
    db(&state).list_measurements()
}

#[tauri::command]
fn add_measurement(
    state: tauri::State<Db>,
    weight_kg: f64,
    measured_at: i64,
) -> Result<i64, String> {
    db(&state).add_measurement(weight_kg, measured_at)
}

#[tauri::command]
fn update_measurement(
    state: tauri::State<Db>,
    id: i64,
    weight_kg: f64,
    measured_at: i64,
) -> Result<(), String> {
    db(&state).update_measurement(id, weight_kg, measured_at)
}

#[tauri::command]
fn delete_measurement(state: tauri::State<Db>, id: i64) -> Result<(), String> {
    db(&state).delete_measurement(id)
}

#[tauri::command]
fn get_settings(state: tauri::State<Db>) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let d = db(&state);
    let mut map = serde_json::Map::new();
    for key in [
        "language",
        "units",
        "target_weight_kg",
        "weekly_rate_kg",
        "max_healthy_rate_kg",
    ] {
        if let Some(v) = d.get_setting(key)? {
            map.insert(key.to_string(), serde_json::Value::String(v));
        }
    }
    Ok(map)
}

#[tauri::command]
fn set_setting(state: tauri::State<Db>, key: String, value: String) -> Result<(), String> {
    db(&state).set_setting(&key, &value)
}

#[tauri::command]
fn get_dashboard(state: tauri::State<Db>) -> Result<Dashboard, String> {
    build_dashboard(&state)
}

#[tauri::command]
fn get_plan(state: tauri::State<Db>) -> Result<Option<Plan>, String> {
    let d = db(&state);
    let target = parse_target(&state)?;
    let current = d.list_measurements()?.last().map(|m| m.weight_kg);
    let rate: f64 = d
        .get_setting("weekly_rate_kg")?
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.5);
    let max_healthy: f64 = d
        .get_setting("max_healthy_rate_kg")?
        .and_then(|v| v.parse().ok())
        .unwrap_or(1.0);
    Ok(match (current, target) {
        (Some(c), Some(t)) => Some(generate_plan(c, t, rate, max_healthy)),
        _ => None,
    })
}

#[tauri::command]
fn export_csv(state: tauri::State<Db>, path: String) -> Result<(), String> {
    let d = db(&state);
    let measurements = d.list_measurements()?;
    let mut out = String::from("id,measured_at,weight_kg\n");
    for m in measurements {
        out.push_str(&format!("{},{},{}\n", m.id, m.measured_at, m.weight_kg));
    }
    std::fs::write(&path, out).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct ImportResult {
    imported: usize,
    skipped: usize,
}

/// Import measurements from a CSV with the same format as export_csv:
/// `id,measured_at,weight_kg` (header row required). The id column is
/// ignored; rows with duplicate timestamps or invalid values are skipped.
#[tauri::command]
fn import_csv(state: tauri::State<Db>, path: String) -> Result<ImportResult, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut imported = 0usize;
    let mut skipped = 0usize;
    for (i, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || (i == 0 && line.starts_with("id,")) {
            continue;
        }
        let cols: Vec<&str> = line.split(',').map(|c| c.trim()).collect();
        if cols.len() < 3 {
            skipped += 1;
            continue;
        }
        let measured_at: i64 = match cols[1].parse() {
            Ok(v) => v,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        let weight_kg: f64 = match cols[2].parse() {
            Ok(v) => v,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        match db(&state).add_measurement(weight_kg, measured_at) {
            Ok(_) => imported += 1,
            Err(_) => skipped += 1,
        }
    }
    Ok(ImportResult { imported, skipped })
}

#[tauri::command]
fn backup_db(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<Db>();
    let src = state.db_path();
    // Checkpoint WAL so the copy is self-contained.
    {
        let conn = state.conn.lock().unwrap();
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(|e| e.to_string())?;
    }
    std::fs::copy(&src, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn restore_db(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let dst = app.state::<Db>().db_path();
    std::fs::copy(&path, &dst).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- Multi-user support: one SQLite file per user ----------

#[derive(Serialize)]
struct UserEntry {
    slug: String,
    name: String,
    current: bool,
}

fn users_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("app data dir")
        .join("users")
}

fn current_user_file(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("app data dir")
        .join("current_user.txt")
}

fn valid_slug(slug: &str) -> bool {
    !slug.is_empty()
        && slug.len() <= 32
        && slug
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
        && slug.chars().next().unwrap().is_ascii_alphanumeric()
}

fn slugify(name: &str) -> String {
    let mut s: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    while s.contains("--") {
        s = s.replace("--", "-");
    }
    let s = s.trim_matches('-').chars().take(32).collect::<String>();
    if s.is_empty() {
        "user".to_string()
    } else {
        s
    }
}

fn read_current_slug(app: &tauri::AppHandle) -> String {
    std::fs::read_to_string(current_user_file(app))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| valid_slug(s))
        .unwrap_or_else(|| "default".to_string())
}

fn write_current_slug(app: &tauri::AppHandle, slug: &str) -> Result<(), String> {
    std::fs::write(current_user_file(app), slug).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_users(app: tauri::AppHandle) -> Result<Vec<UserEntry>, String> {
    let dir = users_dir(&app);
    let current = read_current_slug(&app);
    let mut users = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.extension().map(|x| x == "db").unwrap_or(false) {
                let slug = p.file_stem().unwrap().to_string_lossy().to_string();
                // Best-effort: read the display name from the profile row.
                let name = Connection::open(&p)
                    .and_then(|c| {
                        c.query_row("SELECT name FROM profile WHERE id = 1", [], |r| {
                            r.get::<_, String>(0)
                        })
                    })
                    .unwrap_or_default();
                users.push(UserEntry {
                    name: if name.is_empty() { slug.clone() } else { name },
                    current: slug == current,
                    slug,
                });
            }
        }
    }
    users.sort_by(|a, b| a.slug.cmp(&b.slug));
    Ok(users)
}

#[tauri::command]
fn current_user(app: tauri::AppHandle) -> Result<String, String> {
    Ok(read_current_slug(&app))
}

#[tauri::command]
fn switch_user(app: tauri::AppHandle, slug: String) -> Result<(), String> {
    if !valid_slug(&slug) {
        return Err("Invalid user name".into());
    }
    let path = users_dir(&app).join(format!("{slug}.db"));
    app.state::<Db>().switch(&path)?;
    write_current_slug(&app, &slug)
}

#[tauri::command]
fn create_user(app: tauri::AppHandle, name: String) -> Result<String, String> {
    let base = slugify(&name);
    let dir = users_dir(&app);
    // Ensure uniqueness: user, user-2, user-3, ...
    let mut slug = base.clone();
    for i in 2.. {
        if !dir.join(format!("{slug}.db")).exists() {
            break;
        }
        slug = format!("{base}-{i}");
    }
    switch_user(app, slug.clone())?;
    Ok(slug)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().expect("app data dir");
            let udir = users_dir(app.handle());
            std::fs::create_dir_all(&udir).map_err(|e| e.to_string())?;
            // One-time migration: move the legacy single-user DB into users/.
            let legacy = data_dir.join("weight_watcher.db");
            let is_empty = std::fs::read_dir(&udir)
                .map(|mut d| d.next().is_none())
                .unwrap_or(true);
            if legacy.exists() && is_empty {
                std::fs::rename(&legacy, udir.join("default.db"))
                    .map_err(|e| e.to_string())?;
            }
            let slug = read_current_slug(app.handle());
            let path = udir.join(format!("{slug}.db"));
            let database = Db::open(&path)?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_profile,
            save_profile,
            list_measurements,
            add_measurement,
            update_measurement,
            delete_measurement,
            get_settings,
            set_setting,
            get_dashboard,
            get_plan,
            export_csv,
            import_csv,
            backup_db,
            restore_db,
            list_users,
            current_user,
            switch_user,
            create_user,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Weight Watcher");
}
