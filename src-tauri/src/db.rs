//! SQLite persistence layer (rusqlite, bundled).

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub height_cm: f64,
    pub age: i64,
    pub gender: String,
    pub initial_weight_kg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Measurement {
    pub id: i64,
    pub weight_kg: f64,
    pub measured_at: i64, // unix seconds
}

pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS profile (
               id INTEGER PRIMARY KEY CHECK (id = 1),
               height_cm REAL NOT NULL,
               age INTEGER NOT NULL,
               gender TEXT NOT NULL,
               initial_weight_kg REAL NOT NULL DEFAULT 0
             );
             CREATE TABLE IF NOT EXISTS measurements (
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               weight_kg REAL NOT NULL CHECK (weight_kg BETWEEN 20.0 AND 400.0),
               measured_at INTEGER NOT NULL UNIQUE
             );
             CREATE TABLE IF NOT EXISTS settings (
               key TEXT PRIMARY KEY,
               value TEXT NOT NULL
             );",
        )
        .map_err(|e| e.to_string())?;
        Ok(Db(Mutex::new(conn)))
    }

    pub fn get_profile(&self) -> Result<Option<Profile>, String> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT height_cm, age, gender, initial_weight_kg FROM profile WHERE id = 1",
            [],
            |r| {
                Ok(Profile {
                    height_cm: r.get(0)?,
                    age: r.get(1)?,
                    gender: r.get(2)?,
                    initial_weight_kg: r.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn save_profile(&self, p: &Profile) -> Result<(), String> {
        let conn = self.0.lock().unwrap();
        let existing: Option<f64> = conn
            .query_row(
                "SELECT initial_weight_kg FROM profile WHERE id = 1",
                [],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO profile (id, height_cm, age, gender, initial_weight_kg)
             VALUES (1, ?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET height_cm = ?1, age = ?2, gender = ?3",
            params![p.height_cm, p.age, p.gender, p.initial_weight_kg],
        )
        .map_err(|e| e.to_string())?;
        // Keep the original initial weight once set (initial = first profile weight).
        if existing.is_none() {
            let latest: Option<f64> = conn
                .query_row(
                    "SELECT weight_kg FROM measurements ORDER BY measured_at LIMIT 1",
                    [],
                    |r| r.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?;
            let initial = latest.unwrap_or(p.initial_weight_kg);
            conn.execute(
                "UPDATE profile SET initial_weight_kg = ?1 WHERE id = 1",
                params![initial],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn list_measurements(&self) -> Result<Vec<Measurement>, String> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT id, weight_kg, measured_at FROM measurements ORDER BY measured_at")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok(Measurement {
                    id: r.get(0)?,
                    weight_kg: r.get(1)?,
                    measured_at: r.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn add_measurement(&self, weight_kg: f64, measured_at: i64) -> Result<i64, String> {
        if !(20.0..=400.0).contains(&weight_kg) {
            return Err("Weight must be between 20 and 400 kg".into());
        }
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO measurements (weight_kg, measured_at) VALUES (?1, ?2)",
            params![weight_kg, measured_at],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE") {
                "A measurement already exists at this date/time".into()
            } else {
                e.to_string()
            }
        })?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_measurement(&self, id: i64, weight_kg: f64, measured_at: i64) -> Result<(), String> {
        if !(20.0..=400.0).contains(&weight_kg) {
            return Err("Weight must be between 20 and 400 kg".into());
        }
        let conn = self.0.lock().unwrap();
        let n = conn
            .execute(
                "UPDATE measurements SET weight_kg = ?1, measured_at = ?2 WHERE id = ?3",
                params![weight_kg, measured_at, id],
            )
            .map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("Measurement not found".into());
        }
        Ok(())
    }

    pub fn delete_measurement(&self, id: i64) -> Result<(), String> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM measurements WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.0.lock().unwrap();
        conn.query_row("SELECT value FROM settings WHERE key = ?1", params![key], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
