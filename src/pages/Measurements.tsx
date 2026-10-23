import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Measurement } from "../api";
import { useApp } from "../App";
import { displayToKg, fmtWeight, kgToDisplay, weightUnit } from "../units";

function toLocalInput(unix: number): string {
  const d = new Date(unix * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): number {
  return Math.round(new Date(v).getTime() / 1000);
}

export default function MeasurementsPage() {
  const { t, i18n } = useTranslation();
  const { units } = useApp();
  const [items, setItems] = useState<Measurement[]>([]);
  const [weight, setWeight] = useState("");
  const [when, setWhen] = useState(toLocalInput(Date.now() / 1000));
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [error, setError] = useState("");

  const reload = () => api.listMeasurements().then(setItems);
  useEffect(() => {
    reload();
  }, []);

  const fmtDate = (unix: number) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(unix * 1000)
    );

  const submit = async () => {
    setError("");
    const kg = displayToKg(parseFloat(weight), units);
    try {
      if (editing) {
        await api.updateMeasurement(editing.id, kg, fromLocalInput(when));
      } else {
        await api.addMeasurement(kg, fromLocalInput(when));
      }
      setWeight("");
      setEditing(null);
      setWhen(toLocalInput(Date.now() / 1000));
      reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const startEdit = (m: Measurement) => {
    setEditing(m);
    setWeight(kgToDisplay(m.weight_kg, units).toFixed(1));
    setWhen(toLocalInput(m.measured_at));
  };

  const remove = async (id: number) => {
    await api.deleteMeasurement(id);
    reload();
  };

  return (
    <section>
      <h2>{t("measurements.title")}</h2>
      {error && <div className="warn">{t("errors.generic", { message: error })}</div>}
      <div className="row">
        <input
          type="number"
          step="0.1"
          placeholder={`${t("measurements.weight")} (${weightUnit(units)})`}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <button className="primary" onClick={submit} disabled={!weight || !when}>
          {editing ? t("measurements.save") : t("measurements.add")}
        </button>
        {editing && (
          <button className="ghost" onClick={() => setEditing(null)}>
            {t("measurements.cancel")}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="muted">{t("measurements.empty")}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t("measurements.date")}</th>
              <th>{t("measurements.weight")}</th>
              <th>{t("measurements.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {[...items].reverse().map((m) => (
              <tr key={m.id}>
                <td>{fmtDate(m.measured_at)}</td>
                <td>{fmtWeight(m.weight_kg, units)}</td>
                <td>
                  <button className="ghost" onClick={() => startEdit(m)}>
                    {t("measurements.edit")}
                  </button>{" "}
                  <button className="danger" onClick={() => remove(m.id)}>
                    {t("measurements.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
