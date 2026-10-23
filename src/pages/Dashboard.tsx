import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Dashboard } from "../api";
import { useApp } from "../App";
import { fmtSigned, fmtWeight } from "../units";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { units } = useApp();
  const [d, setD] = useState<Dashboard | null>(null);

  useEffect(() => {
    api.getDashboard().then(setD);
  }, []);

  if (!d) return null;

  if (d.measurement_count === 0) {
    return (
      <section>
        <h2>{t("nav.dashboard")}</h2>
        <p className="muted">{t("dashboard.noData")}</p>
      </section>
    );
  }

  const trend = (v: number | null, per: string) =>
    v == null ? t("dashboard.insufficient") : `${fmtSigned(v, units)} ${t(per, { unit: "" })}`;

  return (
    <section>
      <h2>{t("nav.dashboard")}</h2>
      <div className="cards">
        <div className="card">
          <div className="label">{t("dashboard.currentWeight")}</div>
          <div className="value">{fmtWeight(d.current_weight_kg, units)}</div>
          <div className="sub">{t("dashboard.totalChange")}: {fmtSigned(d.total_change_kg, units)}</div>
        </div>
        <div className="card">
          <div className="label">{t("dashboard.targetWeight")}</div>
          <div className="value">{fmtWeight(d.target_weight_kg, units)}</div>
          <div className="sub">{t("dashboard.deltaToTarget")}: {fmtSigned(d.delta_to_target_kg, units)}</div>
        </div>
        <div className="card">
          <div className="label">{t("dashboard.bmi")}</div>
          <div className="value">{d.bmi == null ? "—" : d.bmi.toFixed(1)}</div>
          <div className="sub">{d.bmi_category ? t(`bmi.${d.bmi_category}`) : ""}</div>
        </div>
        <div className="card">
          <div className="label">{t("dashboard.weeklyTrend")}</div>
          <div className="value">{trend(d.weekly_trend_kg, "units.perWeek")}</div>
        </div>
        <div className="card">
          <div className="label">{t("dashboard.monthlyTrend")}</div>
          <div className="value">{trend(d.monthly_trend_kg, "units.perMonth")}</div>
        </div>
        <div className="card">
          <div className="label">{t("dashboard.progress")}</div>
          <div className="value">
            {d.progress_percent == null ? "—" : `${d.progress_percent.toFixed(0)}%`}
          </div>
          {d.progress_percent != null && (
            <div className="progress-bar">
              <div style={{ width: `${d.progress_percent}%` }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
