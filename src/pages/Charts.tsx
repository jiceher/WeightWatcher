import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, Measurement } from "../api";
import { useApp } from "../App";
import { kgToDisplay, weightUnit } from "../units";

type Range = "all" | "year" | "month" | "fromMax";

export default function ChartsPage() {
  const { t, i18n } = useTranslation();
  const { units } = useApp();
  const [items, setItems] = useState<Measurement[]>([]);
  const [range, setRange] = useState<Range>("all");

  useEffect(() => {
    api.listMeasurements().then(setItems);
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now() / 1000;
    const d = new Date();
    switch (range) {
      case "month": {
        const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000;
        return items.filter((m) => m.measured_at >= start);
      }
      case "year": {
        const start = new Date(d.getFullYear(), 0, 1).getTime() / 1000;
        return items.filter((m) => m.measured_at >= start);
      }
      case "fromMax": {
        if (items.length === 0) return [];
        const max = Math.max(...items.map((m) => m.weight_kg));
        const firstMax = items.find((m) => m.weight_kg === max)!;
        return items.filter((m) => m.measured_at >= firstMax.measured_at);
      }
      default:
        return items.filter((m) => m.measured_at <= now);
    }
  }, [items, range]);

  const data = filtered.map((m) => ({
    t: m.measured_at * 1000,
    w: Number(kgToDisplay(m.weight_kg, units).toFixed(1)),
  }));

  const fmtTick = (ts: number) =>
    new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" }).format(ts);

  return (
    <section>
      <h2>{t("charts.title")}</h2>
      <div className="row" style={{ marginBottom: 16 }}>
        {(["all", "year", "month", "fromMax"] as Range[]).map((r) => (
          <button
            key={r}
            className={range === r ? "primary" : "ghost"}
            onClick={() => setRange(r)}
          >
            {t(`charts.${r}`)}
          </button>
        ))}
      </div>
      <div style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#2a2e3d" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              tickFormatter={fmtTick}
              stroke="#9aa0b0"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
            />
            <YAxis
              dataKey="w"
              stroke="#9aa0b0"
              domain={["auto", "auto"]}
              unit={` ${weightUnit(units)}`}
              width={90}
            />
            <Tooltip
              labelFormatter={(ts) =>
                new Intl.DateTimeFormat(i18n.language, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(ts as number)
              }
              formatter={(v) => [`${v} ${weightUnit(units)}`, t("measurements.weight")]}
              contentStyle={{ background: "#1a1d27", border: "1px solid #2a2e3d" }}
            />
            <Line type="monotone" dataKey="w" stroke="#5b7fff" dot={{ r: 3 }} strokeWidth={2} />
            <Brush dataKey="t" height={24} stroke="#5b7fff" tickFormatter={fmtTick} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
