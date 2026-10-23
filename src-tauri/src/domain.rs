//! Pure domain logic: BMI, trends, and weight-loss plan calculations.
//! All functions operate on plain values so they are trivially testable.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BmiCategory {
    Underweight,
    Normal,
    Overweight,
    Obese,
}

/// BMI = weight_kg / height_m^2. Returns None for non-positive height.
pub fn bmi(weight_kg: f64, height_cm: f64) -> Option<f64> {
    if height_cm <= 0.0 {
        return None;
    }
    let h = height_cm / 100.0;
    Some(weight_kg / (h * h))
}

pub fn bmi_category(bmi: f64) -> BmiCategory {
    if bmi < 18.5 {
        BmiCategory::Underweight
    } else if bmi < 25.0 {
        BmiCategory::Normal
    } else if bmi < 30.0 {
        BmiCategory::Overweight
    } else {
        BmiCategory::Obese
    }
}

/// (unix_seconds, weight_kg) pairs sorted by time -> kg/day slope via
/// least-squares linear regression. Returns None with < 2 distinct points.
pub fn regression_slope_per_day(points: &[(i64, f64)]) -> Option<f64> {
    if points.len() < 2 {
        return None;
    }
    let n = points.len() as f64;
    let (sx, sy, sxx, sxy) = points.iter().fold((0.0, 0.0, 0.0, 0.0), |(sx, sy, sxx, sxy), (t, w)| {
        let x = *t as f64 / 86_400.0;
        (sx + x, sy + w, sxx + x * x, sxy + x * w)
    });
    let denom = n * sxx - sx * sx;
    if denom.abs() < f64::EPSILON {
        return None;
    }
    Some((n * sxy - sx * sy) / denom)
}

/// Average weight change per week over `points` (kg/week). Falls back to the
/// total delta scaled by elapsed time when regression is not possible.
pub fn weekly_trend(points: &[(i64, f64)]) -> Option<f64> {
    if let Some(slope) = regression_slope_per_day(points) {
        return Some(slope * 7.0);
    }
    if points.len() == 2 {
        let (t0, w0) = points[0];
        let (t1, w1) = points[1];
        let days = (t1 - t0) as f64 / 86_400.0;
        if days > f64::EPSILON {
            return Some((w1 - w0) / days * 7.0);
        }
    }
    None
}

/// Progress toward target clamped to [0, 100]. Works for loss and gain goals.
pub fn progress_percent(initial: f64, current: f64, target: f64) -> f64 {
    let total = initial - target;
    if total.abs() < f64::EPSILON {
        return 100.0;
    }
    (((initial - current) / total) * 100.0).clamp(0.0, 100.0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    pub target_weight_kg: f64,
    pub weekly_rate_kg: f64,
    pub weeks_needed: f64,
    pub estimated_days: i64,
    pub milestones: Vec<f64>,
    pub exceeds_healthy_rate: bool,
}

/// Generate a plan from current -> target at `weekly_rate_kg` (positive =
/// loss per week). `max_healthy` is the configurable healthy threshold.
pub fn generate_plan(
    current_kg: f64,
    target_kg: f64,
    weekly_rate_kg: f64,
    max_healthy_kg: f64,
) -> Plan {
    let delta = (current_kg - target_kg).abs();
    let rate = weekly_rate_kg.max(0.05); // avoid div-by-zero; floor at 50 g/week
    let weeks = delta / rate;
    Plan {
        target_weight_kg: target_kg,
        weekly_rate_kg,
        weeks_needed: weeks,
        estimated_days: (weeks * 7.0).round() as i64,
        milestones: [0.25, 0.5, 0.75, 1.0]
            .iter()
            .map(|f| current_kg + (target_kg - current_kg) * f)
            .collect(),
        exceeds_healthy_rate: weekly_rate_kg > max_healthy_kg,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bmi_calculation() {
        assert_eq!(bmi(70.0, 175.0).unwrap().round(), 23.0);
        assert!(bmi(70.0, 0.0).is_none());
    }

    #[test]
    fn categories() {
        assert_eq!(bmi_category(18.4), BmiCategory::Underweight);
        assert_eq!(bmi_category(18.5), BmiCategory::Normal);
        assert_eq!(bmi_category(24.9), BmiCategory::Normal);
        assert_eq!(bmi_category(25.0), BmiCategory::Overweight);
        assert_eq!(bmi_category(29.9), BmiCategory::Overweight);
        assert_eq!(bmi_category(30.0), BmiCategory::Obese);
    }

    #[test]
    fn slope_two_points() {
        // 1 kg loss over 7 days => -1 kg/week
        let pts = vec![(0i64, 80.0), (7 * 86_400, 79.0)];
        let w = weekly_trend(&pts).unwrap();
        assert!((w + 1.0).abs() < 1e-9);
    }

    #[test]
    fn slope_flat() {
        let pts = vec![(0i64, 80.0), (14 * 86_400, 80.0), (28 * 86_400, 80.0)];
        assert_eq!(weekly_trend(&pts).unwrap(), 0.0);
    }

    #[test]
    fn insufficient_points() {
        assert!(weekly_trend(&[]).is_none());
        assert!(weekly_trend(&[(0i64, 80.0)]).is_none());
    }

    #[test]
    fn progress() {
        assert_eq!(progress_percent(100.0, 90.0, 80.0), 50.0);
        assert_eq!(progress_percent(100.0, 70.0, 80.0), 100.0); // overshoot clamps
        assert_eq!(progress_percent(60.0, 65.0, 70.0), 50.0); // gain goal
        assert_eq!(progress_percent(80.0, 80.0, 80.0), 100.0);
    }

    #[test]
    fn plan_basic() {
        let p = generate_plan(90.0, 80.0, 0.5, 1.0);
        assert!((p.weeks_needed - 20.0).abs() < 1e-9);
        assert_eq!(p.estimated_days, 140);
        assert!(!p.exceeds_healthy_rate);
        assert_eq!(p.milestones.len(), 4);
        assert_eq!(p.milestones[0], 87.5);
        assert_eq!(p.milestones[3], 80.0);
    }

    #[test]
    fn plan_warns_on_fast_rate() {
        let p = generate_plan(90.0, 60.0, 1.5, 1.0);
        assert!(p.exceeds_healthy_rate);
    }

    #[test]
    fn plan_zero_rate_floors() {
        let p = generate_plan(90.0, 80.0, 0.0, 1.0);
        assert!(p.weeks_needed.is_finite());
    }
}
