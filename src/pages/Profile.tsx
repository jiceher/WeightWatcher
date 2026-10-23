import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Profile } from "../api";
import { useApp } from "../App";
import { displayToCm, displayToKg, kgToDisplay, weightUnit } from "../units";

export default function ProfilePage({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation();
  const { units } = useApp();
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  const [weight, setWeight] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getProfile().then((p) => {
      if (p) {
        setHeight(displayToCm(p.height_cm, units).toFixed(0));
        setAge(String(p.age));
        setGender(p.gender);
      }
    });
    api.getDashboard().then((d) => {
      if (d.current_weight_kg != null) {
        setWeight(kgToDisplay(d.current_weight_kg, units).toFixed(1));
      }
    });
  }, [units]);

  const submit = async () => {
    setError("");
    const p: Profile = {
      height_cm: displayToCm(parseFloat(height), units),
      age: parseInt(age, 10),
      gender,
      initial_weight_kg: displayToKg(parseFloat(weight || "0"), units),
    };
    try {
      await api.saveProfile(p);
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <section>
      <h2>{t("profile.title")}</h2>
      {error && <div className="warn">{t("errors.generic", { message: error })}</div>}
      <div className="form-row">
        <label>
          {units === "imperial" ? t("profile.height").replace("(cm)", "(in)") : t("profile.height")}
        </label>
        <input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />

        <label>{t("profile.age")}</label>
        <input type="number" value={age} onChange={(e) => setAge(e.target.value)} />

        <label>{t("profile.gender")}</label>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="male">{t("profile.male")}</option>
          <option value="female">{t("profile.female")}</option>
          <option value="other">{t("profile.other")}</option>
        </select>

        <label>{t("profile.weight")} ({weightUnit(units)})</label>
        <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: 20 }}>
        <button className="primary" onClick={submit} disabled={!height || !age}>
          {t("profile.save")}
        </button>
        {saved && <span className="muted">{t("profile.saved")}</span>}
      </div>
    </section>
  );
}
