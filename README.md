# Weight Watcher

Cross-platform desktop app (Windows/macOS/Linux) to track weight, BMI, trends, and a
weight-loss plan. Built with **Tauri 2 + React + TypeScript + SQLite** per
`../Weight Watcher.md`.

## Requirements

- Node.js 20+
- Rust toolchain (stable)
- On Linux: WebKitGTK dev packages (`webkit2gtk-4.1`, etc.)

## Develop

```bash
npm install
npm run dev          # frontend only (uses in-browser mock data)
npm run tauri dev    # full desktop app
```

## Test

```bash
npm test                              # Vitest (unit conversions, UI logic)
cargo test --manifest-path src-tauri/Cargo.toml   # domain logic (BMI, trends, plan)
```

## Build installers

```bash
npm run tauri build
```

Produces `.msi` (Windows), `.dmg` (macOS), `.AppImage`/`.deb` (Linux) under
`src-tauri/target/release/bundle/`. Add app icons under `src-tauri/icons/` and
list them in `tauri.conf.json` before release packaging.

## Notes

- All data is stored locally in a SQLite database in the OS app-data directory.
  No network calls are made.
- SEC-01 (encryption at rest): the bundled rusqlite build does not include
  SQLCipher. Options: build rusqlite against SQLCipher, or rely on OS full-disk
  encryption. Flagged as a deferred decision in the spec.
- Backup/restore copies the database file (WAL-checkpointed first).
