# Weight Watcher

## Concept

**Weight Watcher** is an application that helps users monitor and manage their weight.

It takes the user's initial weight, height, age, and gender as input.

Based on this information, it calculates the user's current BMI (Body Mass Index), IMC in French.

The user can define a target weight as their goal.

The user then regularly records their weight.

The application provides weight trends, updates the BMI accordingly, and displays charts showing weight evolution:

- from the initial weight,
- over the current year,
- over the current month,
- and from the maximum recorded weight.

Finally, the application generates a realistic weight-loss plan to help the user achieve their target weight.

## Product Overview

The **Weight Watcher** application shall enable users to monitor their weight evolution, track progress toward a target weight, and receive guidance through a realistic weight-loss plan.

The application shall be available on **Windows, macOS, and Linux** and support both **English and French** user interfaces.

## 1. Functional Requirements

<style>
a {
 text-decoration: none;
 color: #464feb;
}
tr th, tr td {
 border: 1px solid #e6e6e6;
}
tr th {
 background-color: #f5f5f5;
}
</style>

### FR-01 User Profile Management

The application shall allow the user to create and maintain a **single** personal profile containing:

- Current weight
- Height
- Age (or year of birth)
- Gender

The application shall allow the user to modify these values at any time.

Support for multiple profiles is a future enhancement (Section 7).

---

### FR-02 BMI Calculation

The application shall automatically calculate the user's Body Mass Index (BMI) using:

```
BMI = weight_kg / (height_m)^2
```

where weight is the latest recorded weight (or profile weight if none recorded) and height comes from the profile.

The application shall update the BMI each time a new weight measurement is entered.

The application shall display:

- Current BMI value (rounded to 1 decimal)
- BMI category per WHO thresholds:

| Category       | BMI range        |
|----------------|------------------|
| Underweight    | < 18.5           |
| Normal Weight  | 18.5 – 24.9      |
| Overweight     | 25.0 – 29.9      |
| Obese          | ≥ 30.0           |

---

### FR-03 Target Weight Definition

The application shall allow the user to define a target weight.

The application shall display:

- Weight remaining to achieve the target
- Progress percentage toward the target, defined as:

```
progress % = (initial_weight - current_weight) / (initial_weight - target_weight) * 100
```

when the target is below the initial weight (and the symmetric formula for weight gain). Progress shall be clamped to 0–100% for display.

---

### FR-04 Weight Recording

The application shall allow users to record weight measurements.

Each measurement shall include:

- Weight value
- Measurement date and time

The application shall support modification and deletion of previously recorded measurements.

Validation rules:

- Weight shall be within a plausible range of **20.0 – 400.0 kg** (or the imperial equivalent).
- Duplicate measurement timestamps shall not be allowed.
- Back-dated entries shall be permitted.

---

### FR-05 Weight Trend Analysis

The application shall analyze weight evolution based on recorded data.

The application shall calculate:

- Total weight change (latest weight − first recorded weight)
- Average weight change per week — computed as linear regression slope over the last 7 days if ≥ 2 measurements exist, otherwise as the delta over the period
- Average weight change per month — same method over the last 30 days

Trends shall only be displayed when at least 2 measurements exist in the relevant period; otherwise the UI shall indicate insufficient data.

---

### FR-06 Data Visualization

The application shall provide graphical representations of weight evolution including:

- Weight history since first measurement
- Current month evolution
- Current year evolution
- Evolution from the maximum recorded weight

Graphs shall support zooming and data point inspection (tooltip showing date and exact weight).

---

### FR-07 Weight-Loss Planning

The application shall generate a realistic weight-loss plan based on:

- Current weight
- Target weight
- Height
- Age
- Gender

The plan shall include:

- Estimated target date, computed from the weight delta and the configured weekly rate
- Weekly weight-loss objective
- Progress milestones at 25%, 50%, 75%, and 100% of the goal

The default healthy weight-loss rate shall be **0.5 kg/week**, with a maximum recommended rate of **1.0 kg/week**. Both values shall be configurable.

The application shall warn the user when the requested weight-loss rate exceeds the configured healthy threshold.

---

### FR-08 Dashboard

The application shall provide a dashboard displaying:

- Current weight
- Target weight
- Current BMI and category
- Weight difference to target
- Weekly trend
- Monthly trend

---

### FR-09 Data Persistence

The application shall automatically save user data.

User data shall remain available after application restart.

The database schema shall include at minimum:

- **profile**: height, age/year of birth, gender, unit preference
- **measurements**: weight, measured_at timestamp
- **settings**: language, units, healthy-loss threshold, target weight
- **plan**: target weight, weekly rate, estimated target date

---

### FR-10 Data Export

The application shall allow users to export data in:

- CSV format
- PDF format

Exported reports shall include charts and statistics.

---

### FR-11 Units

The application shall support:

- Metric units (kg, cm)
- Imperial units (lb, in)

The user shall be able to switch units in settings. All weights shall be stored internally in metric (kg) and converted for display.

## 2. Internationalization Requirements

### INT-01 Language Support

The application shall support:

- English
- French

The user shall be able to switch language without restarting the application.

---

### INT-02 Localization

The application shall display:

- Dates
- Numbers
- Units

according to the selected language and regional settings.

## 3. Platform Requirements

### SYS-01 Supported Operating Systems

The application shall run on:

- Microsoft Windows 11 and later
- macOS 13 (Ventura) and later
- Linux distributions with WebKitGTK 2.40+ (GTK graphical environments)

---

### SYS-02 Cross-Platform Consistency

The application shall provide a consistent user experience across all supported operating systems.

---

### SYS-03 Installation

The application shall provide:

- Windows installer (.msi or .exe)
- macOS package (.dmg)
- Linux package (.AppImage, .deb, or .rpm)

## 4. Performance Requirements

### NFR-01 Startup Time

The application shall start within 3 seconds on a standard personal computer.

---

### NFR-02 Graph Rendering

Weight evolution charts shall be displayed within 1 second after selection.

---

### NFR-03 Data Volume

The application shall remain responsive with up to 10,000 recorded measurements.

## 5. Security and Privacy Requirements

### SEC-01 Local Data Protection

User data shall be stored locally in an encrypted format (e.g. SQLCipher-encrypted SQLite database, or application-level field encryption).

---

### SEC-02 Privacy

The application shall not transmit user data to external servers unless explicitly enabled by the user.

---

### SEC-03 Backup

The application shall provide a data backup and restore mechanism. Backups shall be a single portable file; restoring shall replace current data after user confirmation.

## 6. Technical Architecture

- **Framework:** Tauri 2.x (Rust backend) + React + TypeScript + Vite
- **Charts:** Recharts (zoom, tooltips)
- **Database:** SQLite via `rusqlite` (optionally SQLCipher build for SEC-01)
- **Localization:** i18next / react-i18next (EN/FR), `Intl` API for dates/numbers/units
- **Export:** CSV in Rust; PDF via `jspdf` with chart canvas snapshots
- **Packaging:** Tauri bundler — .msi (Windows), .dmg (macOS), .AppImage/.deb (Linux)
- **Testing:** `cargo test` (domain logic), Vitest + React Testing Library (UI)

## 7. Future Enhancements (Optional)

- Multiple user profiles
- Cloud synchronization
- Health data import from Apple Health
- Integration with Google Fit
- Integration with Garmin Connect
- Nutrition tracking
- Calorie expenditure tracking
- Goal reminders and notifications
- AI-based coaching and recommendations
