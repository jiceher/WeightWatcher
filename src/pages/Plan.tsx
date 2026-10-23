import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Plan } from "../api";
import { useApp } from "../App";
import { displayToKg, fmtWeight, kgToDisplay, weightUnit } from "../units";

export default function PlanPage() {
  const { t, i18n } = useTranslation();
  const { units, settings, refreshSettings } = useApp();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [target, setTarget] = useState("");
  const [rate, setRate] = useState("0.5");
  const [initialized, setInitialized] = useState(false);

  const reload = useCallback(() => api.getPlan().then(setPlan), []);

  useEffect(() => {
    if (!initialized) {
      setTarget(settings.target_weight_kg ?? "");
      setRate(settings.weekly_rate_kg ?? "0.5");
      setInitialized(true);
    }
    reload();
  }, [settings, initialized, reload]);

  const save = async () => {
    const kg = displayToKg(parseFloat(target), units);
    // Rate is entered in the display unit; store as kg/week.
    const rateKg = displayToKg(parseFloat(rate), units);
    await api.setSetting("target_weight_kg", String(kg));
    await api.setSetting("weekly_rate_kg", String(rateKg));
    await refreshSettings();
    reload();
  };

  const estDate =
    plan &&
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(
      Date.now() + plan.estimated_days * 86400 * 1000
    );

  const displayTarget = (kg: number) => fmtWeight(kg, units);

  return (
    <section>
      <h2>{t("plan.title")}</h2>
      <div className="row">
        <div className="form-row">
          <label>{t("plan.target")} ({weightUnit(units)})</label>
          <input type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="form-row">
          <label>{t("plan.weeklyRate")} ({weightUnit(units)}/week)</label>
          <input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <button className="primary" style={{ alignSelf: "end" }} onClick={save} disabled={!target}>
          {t("plan.save")}
        </button>
      </div>

      {plan?.exceeds_healthy_rate && (
        <div className="warn">
          {t("plan.warning", { max: kgToDisplay(1.0, units).toFixed(1) })}
        </div>
      )}

      {!plan ? (
        <p className="muted">{t("plan.setTarget")}</p>
      ) : (
        <div className="cards" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="label">{t("plan.weeksNeeded")}</div>
            <div className="value">{plan.weeks_needed.toFixed(1)}</div>
          </div>
          <div className="card">
            <div className="label">{t("plan.estimatedDate")}</div>
            <div className="value" style={{ fontSize: 18 }}>{estDate}</div>
          </div>
          <div className="card">
            <div className="label">{t("plan.milestones")}</div>
            <div className="sub">
              {plan.milestones.map((m, i) => (
                <div key={i}>{[25, 50, 75, 100][i]}% → {displayTarget(m)}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
