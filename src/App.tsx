import { useCallback, useEffect, useState, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { api, Settings } from "./api";
import { Units } from "./units";
import DashboardPage from "./pages/Dashboard";
import MeasurementsPage from "./pages/Measurements";
import ChartsPage from "./pages/Charts";
import PlanPage from "./pages/Plan";
import ProfilePage from "./pages/Profile";
import SettingsPage from "./pages/Settings";

export interface AppCtx {
  units: Units;
  settings: Settings;
  refreshSettings: () => Promise<void>;
}

const Ctx = createContext<AppCtx>({ units: "metric", settings: {}, refreshSettings: async () => {} });
export const useApp = () => useContext(Ctx);

type Page = "dashboard" | "measurements" | "charts" | "plan" | "profile" | "settings";

export default function App() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState<Page>("dashboard");
  const [settings, setSettings] = useState<Settings>({});
  const [profileExists, setProfileExists] = useState<boolean | null>(null);

  const refreshSettings = useCallback(async () => {
    const s = await api.getSettings();
    setSettings(s);
    if (s.language && s.language !== i18n.language) i18n.changeLanguage(s.language);
  }, [i18n]);

  useEffect(() => {
    refreshSettings();
    api.getProfile().then((p) => setProfileExists(p !== null));
  }, [refreshSettings]);

  const units: Units = settings.units === "imperial" ? "imperial" : "metric";
  const ctx: AppCtx = { units, settings, refreshSettings };

  if (profileExists === null) return null;

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <DashboardPage />,
    measurements: <MeasurementsPage />,
    charts: <ChartsPage />,
    plan: <PlanPage />,
    profile: <ProfilePage onSaved={() => setProfileExists(true)} />,
    settings: <SettingsPage />,
  };

  if (!profileExists) {
    return (
      <Ctx.Provider value={ctx}>
        <main className="container">
          <h1>{t("appTitle")}</h1>
          <ProfilePage onSaved={() => setProfileExists(true)} />
        </main>
      </Ctx.Provider>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <nav className="sidebar">
          <h1>{t("appTitle")}</h1>
          {(Object.keys(pages) as Page[]).map((p) => (
            <button
              key={p}
              className={page === p ? "nav-btn active" : "nav-btn"}
              onClick={() => setPage(p)}
            >
              {t(`nav.${p}`)}
            </button>
          ))}
        </nav>
        <main className="content">{pages[page]}</main>
      </div>
    </Ctx.Provider>
  );
}
