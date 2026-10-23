import { useState } from "react";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import { api, isTauri } from "../api";
import { useApp } from "../App";
import { fmtWeight, weightUnit } from "../units";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { units, settings, refreshSettings } = useApp();
  const [msg, setMsg] = useState("");

  const set = async (key: string, value: string) => {
    await api.setSetting(key, value);
    await refreshSettings();
  };

  const pickSavePath = async (filters: { name: string; extensions: string[] }[]) => {
    if (!isTauri) return null;
    const { save } = await import("@tauri-apps/plugin-dialog");
    return save({ filters });
  };

  const pickOpenPath = async (filters: { name: string; extensions: string[] }[]) => {
    if (!isTauri) return null;
    const { open } = await import("@tauri-apps/plugin-dialog");
    return open({ filters, multiple: false });
  };

  const exportCsv = async () => {
    const path = await pickSavePath([{ name: "CSV", extensions: ["csv"] }]);
    if (path) {
      await api.exportCsv(path);
      setMsg(t("settings.done"));
    }
  };

  const exportPdf = async () => {
    const [dash, measurements] = await Promise.all([api.getDashboard(), api.listMeasurements()]);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(t("appTitle"), 14, 18);
    doc.setFontSize(11);
    let y = 30;
    const line = (label: string, value: string) => {
      doc.text(`${label}: ${value}`, 14, y);
      y += 7;
    };
    line(t("dashboard.currentWeight"), fmtWeight(dash.current_weight_kg, units));
    line(t("dashboard.targetWeight"), fmtWeight(dash.target_weight_kg, units));
    line(t("dashboard.bmi"), dash.bmi?.toFixed(1) ?? "—");
    line(t("dashboard.weeklyTrend"), fmtWeight(dash.weekly_trend_kg, units));
    line(t("dashboard.totalChange"), fmtWeight(dash.total_change_kg, units));

    // Simple embedded line chart of the weight history.
    if (measurements.length > 1) {
      const x0 = 14, y0 = y + 60, w = 180, h = 50;
      const ws = measurements.map((m) => m.weight_kg);
      const ts = measurements.map((m) => m.measured_at);
      const [wMin, wMax] = [Math.min(...ws), Math.max(...ws)];
      const [tMin, tMax] = [Math.min(...ts), Math.max(...ts)];
      const px = (tt: number) => x0 + ((tt - tMin) / Math.max(1, tMax - tMin)) * w;
      const py = (ww: number) => y0 - ((ww - wMin) / Math.max(0.001, wMax - wMin)) * h;
      doc.rect(x0, y0 - h, w, h);
      doc.setDrawColor(91, 127, 255);
      doc.setLineWidth(0.8);
      for (let i = 1; i < measurements.length; i++) {
        doc.line(
          px(ts[i - 1]), py(ws[i - 1]),
          px(ts[i]), py(ws[i])
        );
      }
      doc.setFontSize(9);
      doc.text(`${wMin.toFixed(1)} / ${wMax.toFixed(1)} ${weightUnit(units)}`, x0, y0 + 5);
    }

    doc.save("weight-watcher-report.pdf");
    setMsg(t("settings.done"));
  };

  const backup = async () => {
    const path = await pickSavePath([{ name: "Backup", extensions: ["db"] }]);
    if (path) {
      await api.backupDb(path);
      setMsg(t("settings.done"));
    }
  };

  const restore = async () => {
    if (!window.confirm(t("settings.restoreConfirm"))) return;
    const path = await pickOpenPath([{ name: "Backup", extensions: ["db"] }]);
    if (path) {
      await api.restoreDb(path);
      setMsg(t("settings.done"));
    }
  };

  return (
    <section>
      <h2>{t("settings.title")}</h2>
      {msg && <p className="muted">{msg}</p>}

      <div className="form-row">
        <label>{t("settings.language")}</label>
        <select
          value={i18n.language}
          onChange={(e) => {
            i18n.changeLanguage(e.target.value);
            set("language", e.target.value);
          }}
        >
          <option value="en">English</option>
          <option value="fr">Français</option>
        </select>

        <label>{t("settings.units")}</label>
        <select value={units} onChange={(e) => set("units", e.target.value)}>
          <option value="metric">{t("settings.metric")}</option>
          <option value="imperial">{t("settings.imperial")}</option>
        </select>

        <label>{t("settings.maxRate")}</label>
        <input
          type="number"
          step="0.1"
          defaultValue={settings.max_healthy_rate_kg ?? "1.0"}
          onBlur={(e) => set("max_healthy_rate_kg", e.target.value)}
        />
      </div>

      <h3 style={{ marginTop: 32 }}>{t("settings.export")}</h3>
      <div className="row">
        <button className="ghost" onClick={exportCsv}>{t("settings.exportCsv")}</button>
        <button className="ghost" onClick={exportPdf}>{t("settings.exportPdf")}</button>
      </div>

      <h3 style={{ marginTop: 32 }}>{t("settings.backup")}</h3>
      <div className="row">
        <button className="ghost" onClick={backup}>{t("settings.backupNow")}</button>
        <button className="ghost" onClick={restore}>{t("settings.restore")}</button>
      </div>
    </section>
  );
}
