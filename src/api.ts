import { invoke } from "@tauri-apps/api/core";

export interface Profile {
  height_cm: number;
  age: number;
  gender: string;
  initial_weight_kg: number;
}

export interface Measurement {
  id: number;
  weight_kg: number;
  measured_at: number; // unix seconds
}

export interface Dashboard {
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  bmi: number | null;
  bmi_category: string | null;
  delta_to_target_kg: number | null;
  progress_percent: number | null;
  weekly_trend_kg: number | null;
  monthly_trend_kg: number | null;
  total_change_kg: number | null;
  measurement_count: number;
}

export interface Plan {
  target_weight_kg: number;
  weekly_rate_kg: number;
  weeks_needed: number;
  estimated_days: number;
  milestones: number[];
  exceeds_healthy_rate: boolean;
}

export type Settings = Record<string, string>;

// In dev (plain vite, no Tauri runtime) fall back to in-memory mocks so the UI
// can still be developed and tested in a browser.
const hasTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let mockMeasurements: Measurement[] = [
  { id: 1, weight_kg: 92.0, measured_at: Date.now() / 1000 - 90 * 86400 },
  { id: 2, weight_kg: 90.5, measured_at: Date.now() / 1000 - 60 * 86400 },
  { id: 3, weight_kg: 89.0, measured_at: Date.now() / 1000 - 30 * 86400 },
  { id: 4, weight_kg: 88.2, measured_at: Date.now() / 1000 - 7 * 86400 },
];
let mockProfile: Profile | null = {
  height_cm: 178,
  age: 40,
  gender: "male",
  initial_weight_kg: 92.0,
};
let mockSettings: Settings = { target_weight_kg: "80", weekly_rate_kg: "0.5" };

function slope(points: [number, number][], days: number): number | null {
  const pts = points.filter(([t]) => t >= Date.now() / 1000 - days * 86400);
  if (pts.length < 2) return null;
  const d = (pts[pts.length - 1][0] - pts[0][0]) / 86400;
  return d > 0 ? ((pts[pts.length - 1][1] - pts[0][1]) / d) * 7 : null;
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (hasTauri) return invoke<T>(cmd, args);
  switch (cmd) {
    case "get_profile":
      return mockProfile as T;
    case "save_profile":
      mockProfile = args?.profile as Profile;
      return undefined as T;
    case "list_measurements":
      return [...mockMeasurements] as T;
    case "add_measurement": {
      const m = {
        id: Math.max(0, ...mockMeasurements.map((x) => x.id)) + 1,
        weight_kg: args!.weightKg as number,
        measured_at: args!.measuredAt as number,
      };
      mockMeasurements.push(m);
      mockMeasurements.sort((a, b) => a.measured_at - b.measured_at);
      return m.id as T;
    }
    case "update_measurement": {
      const m = mockMeasurements.find((x) => x.id === args!.id);
      if (m) {
        m.weight_kg = args!.weightKg as number;
        m.measured_at = args!.measuredAt as number;
      }
      return undefined as T;
    }
    case "delete_measurement":
      mockMeasurements = mockMeasurements.filter((x) => x.id !== args!.id);
      return undefined as T;
    case "get_settings":
      return { ...mockSettings } as T;
    case "set_setting":
      mockSettings[args!.key as string] = args!.value as string;
      return undefined as T;
    case "get_dashboard": {
      const cur = mockMeasurements.at(-1)?.weight_kg ?? null;
      const tgt = parseFloat(mockSettings.target_weight_kg ?? "");
      const b = cur && mockProfile ? cur / (mockProfile.height_cm / 100) ** 2 : null;
      const pts = mockMeasurements.map((m) => [m.measured_at, m.weight_kg] as [number, number]);
      return {
        current_weight_kg: cur,
        target_weight_kg: isNaN(tgt) ? null : tgt,
        bmi: b,
        bmi_category: b == null ? null : b < 18.5 ? "Underweight" : b < 25 ? "Normal" : b < 30 ? "Overweight" : "Obese",
        delta_to_target_kg: cur != null && !isNaN(tgt) ? cur - tgt : null,
        progress_percent:
          cur != null && !isNaN(tgt) && mockProfile
            ? Math.min(100, Math.max(0, ((mockProfile.initial_weight_kg - cur) / (mockProfile.initial_weight_kg - tgt)) * 100))
            : null,
        weekly_trend_kg: slope(pts, 7),
        monthly_trend_kg: slope(pts, 30),
        total_change_kg:
          mockMeasurements.length > 1 && cur != null ? cur - mockMeasurements[0].weight_kg : null,
        measurement_count: mockMeasurements.length,
      } as T;
    }
    case "get_plan": {
      const cur = mockMeasurements.at(-1)?.weight_kg;
      const tgt = parseFloat(mockSettings.target_weight_kg ?? "");
      if (cur == null || isNaN(tgt)) return null as T;
      const rate = parseFloat(mockSettings.weekly_rate_kg ?? "0.5") || 0.5;
      const weeks = Math.abs(cur - tgt) / rate;
      return {
        target_weight_kg: tgt,
        weekly_rate_kg: rate,
        weeks_needed: weeks,
        estimated_days: Math.round(weeks * 7),
        milestones: [0.25, 0.5, 0.75, 1].map((f) => cur + (tgt - cur) * f),
        exceeds_healthy_rate: rate > 1.0,
      } as T;
    }
    default:
      return undefined as T;
  }
}

export const api = {
  getProfile: () => call<Profile | null>("get_profile"),
  saveProfile: (profile: Profile) => call<void>("save_profile", { profile }),
  listMeasurements: () => call<Measurement[]>("list_measurements"),
  addMeasurement: (weightKg: number, measuredAt: number) =>
    call<number>("add_measurement", { weightKg, measuredAt }),
  updateMeasurement: (id: number, weightKg: number, measuredAt: number) =>
    call<void>("update_measurement", { id, weightKg, measuredAt }),
  deleteMeasurement: (id: number) => call<void>("delete_measurement", { id }),
  getSettings: () => call<Settings>("get_settings"),
  setSetting: (key: string, value: string) => call<void>("set_setting", { key, value }),
  getDashboard: () => call<Dashboard>("get_dashboard"),
  getPlan: () => call<Plan | null>("get_plan"),
  exportCsv: (path: string) => call<void>("export_csv", { path }),
  backupDb: (path: string) => call<void>("backup_db", { path }),
  restoreDb: (path: string) => call<void>("restore_db", { path }),
};

export const isTauri = hasTauri;
