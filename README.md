# rIAcardo — Cycling & Running Performance Analytics

Platform for cycling and running performance analysis with an AI coach (Groq).

**🌐 [English](README.md) · [Español](README.es.md)**

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 16+ (or use Docker)

### Steps

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd rIAcardo
   ```

2. **Set up the Python virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
   For development (tests):
   ```bash
   pip install -r requirements-dev.txt
   ```

3. **Start the database**:
   ```bash
   docker compose up -d db
   ```
   This creates PostgreSQL on `localhost:5432` with the `riacardo` database
   (defaults; you can change them in `.env`).

4. **Initialize the DB schema**:
   ```bash
   psql -h localhost -p 5432 -U postgres -d riacardo -f db/schema.sql
   ```

5. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in:
   - `POSTGRES_*`: database connection
   - `ENCRYPTION_KEY`: generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - `JWT_SECRET_KEY`: generate with `openssl rand -hex 32`
   - `GROQ_API_KEY`: get one at [Groq Cloud](https://console.groq.com/)
   - `ALLOWED_ORIGINS`: optional, extra CORS origins for local network use

6. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   cd ..
   ```

7. **Run the application**:
   - **Development mode** (backend + frontend separately):
     ```bash
     ./run_network.sh
     ```
   - **Production mode** (FastAPI serves the compiled frontend):
     ```bash
     cd frontend && npm run build && cd ..
     ./run_service.sh
     ```

The app will be available at `http://localhost:9000` (production) or `http://localhost:5173` (dev frontend).

---

## Deployment

For persistent deployment (e.g., on a server or a Tailscale-connected Mac mini),
see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## Google Calendar Setup (optional)

If you want rIAcardo to sync planned workouts with Google Calendar, you need to
create your own Google **Service Account**.

### Steps

1. **Create a project in Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (e.g. `riacardo-calendar`)

2. **Enable the Google Calendar API**:
   - APIs and Services → Library
   - Search for "Google Calendar API" and enable it

3. **Create a Service Account**:
   - IAM & Admin → Service Accounts → Create
   - Give it a name (e.g. `riacardo-bot`)
   - Note the generated email: `xxx@yyy.iam.gserviceaccount.com`

4. **Generate a JSON key**:
   - In the service account → "Keys" tab → Add key → JSON
   - A file `riacardo-bot-xxx.json` will be downloaded
   - **Do NOT upload this file to the repository** (it is already in `.gitignore`)
   - Save it as `google_service_account.json` in the project root

5. **Share your calendar with the Service Account**:
   - Open Google Calendar in your browser
   - Calendar settings → "Share with specific people"
   - Add the service account email (`xxx@yyy.iam.gserviceaccount.com`)
   - Permissions: "Make changes to events and manage sharing"

6. **Insert the service account into the DB**:
   ```bash
   psql -h localhost -p 5432 -U postgres -d riacardo -c \
     "INSERT INTO public.app_config (config_key, config_value)
      VALUES ('google_service_account_json', '$(cat google_service_account.json)');"
   ```

7. **Connect your calendar in the app**:
   - In rIAcardo, go to Settings → Google Calendar
   - Enter the `calendar_id` of your calendar (found in the calendar settings in Google Calendar)
   - The `calendar_id` is stored in `users.google_calendar_id`

---

## Data Flow

1.  **Data Ingestion**: Activity data is extracted from `.fit` files (Garmin Connect) and stored in a PostgreSQL database.
2.  **Performance Analysis**: The system calculates performance metrics (NP, TSS, CTL, ATL, TSB, MMP, W', etc.) and generates AI analysis (Groq).
3.  **Visualization**: Results are presented in an interactive dashboard (React + Chart.js) with performance charts, a training calendar and an AI coach.

## Performance Calculations & Algorithms

The main performance metrics and how they are computed are detailed below.

### 1. Normalized Power (NP)

Normalized Power is an estimate of the power a cyclist could have sustained for the same physiological cost had their power output been perfectly constant. It provides a better measure of the true effort of a workout than average power.

**Algorithm:**
1.  A 30-second moving average of the power data of the activity is computed.
2.  The values of this moving average are raised to the fourth power.
3.  The mean of the values obtained in the previous step is computed.
4.  Normalized Power is the fourth root of this mean.

```python
def calculate_normalized_power(power_data, interval_seconds=30):
    rolling_avg_power = power_data.fillna(0).rolling(window=interval_seconds, min_periods=1).mean()
    rolling_avg_power_4th = rolling_avg_power**4
    mean_4th_power = rolling_avg_power_4th.mean()
    np_val = mean_4th_power**(1/4)
    return np_val
```

### 2. Training Stress Score (TSS)

TSS is a metric that quantifies the training load of an activity. It takes into account both duration and intensity of the session.

**Algorithm:**
TSS is calculated using Normalized Power (NP), Intensity Factor (IF) and activity duration. IF is simply the ratio between NP and the athlete's Functional Threshold Power (FTP).

-   `IF = NP / FTP`
-   `TSS = (Duration_seconds * NP * IF) / (FTP * 3600) * 100`

The simplified formula used in the code is:

```python
def calculate_tss(activity_duration_seconds, np_watts, ftp_watts):
    if_val = np_watts / ftp_watts
    tss = (activity_duration_seconds * (if_val**2)) / 3600 * 100
    return tss
```

### 3. Training Load Metrics (CTL, ATL, TSB)

These metrics, popularized by TrainingPeaks, help manage training load over time.

-   **CTL (Chronic Training Load)**: Represents the athlete's "fitness". It is an exponentially weighted moving average of daily TSS values over the last 42 days. A rising CTL indicates increased training load and, therefore, better fitness.

-   **ATL (Acute Training Load)**: Represents short-term "fatigue". It is an exponentially weighted moving average of daily TSS values over the last 7 days. A rising ATL indicates accumulated fatigue.

-   **TSB (Training Stress Balance)**: Represents the athlete's "form" or "freshness". It is calculated as the difference between CTL and ATL (`TSB = CTL - ATL`).
    -   A positive TSB suggests the athlete is rested and in good shape to compete.
    -   A negative TSB indicates the athlete is fatigued and may need rest.

**Algorithm:**
These metrics are computed iteratively for each day, using time constants (TC) of 42 days for CTL and 7 days for ATL.

```python
def calculate_ctl_atl_tsb(daily_tss):
    CTL_TC = 42
    ATL_TC = 7
    current_ctl = 0
    current_atl = 0

    for date, tss in daily_tss.items():
        current_ctl = current_ctl + (tss - current_ctl) / CTL_TC
        current_atl = current_atl + (tss - current_atl) / ATL_TC
        tsb = current_ctl - current_atl
        # ... los valores se almacenan para cada día
```

### 4. Cardiac Drift

Cardiac drift measures the decrease in efficiency as an activity progresses, generally caused by fatigue, dehydration or heat. It manifests as an increase in heart rate to maintain the same power, or a decrease in power for the same heart rate.

**Algorithm:**
It is calculated for activities longer than 90 minutes.
1.  The power-to-heart-rate ratio (`Power / HR`) is computed for each data point of the activity.
2.  The activity is split into two halves (by time).
3.  The mean of this ratio is computed for the first and the second half.
4.  Cardiac drift is the percentage drop of this ratio from the first half to the second half.

```python
def calculate_cardiac_drift(df_activity_records, total_elapsed_time):
    df_clean['power_hr_ratio'] = df_clean['power'] / df_clean['heart_rate']

    # ... división en dos mitades ...

    avg_power_hr_ratio_1st_half = first_half_records['power_hr_ratio'].mean()
    avg_power_hr_ratio_2nd_half = second_half_records['power_hr_ratio'].mean()

    cardiac_drift = ((avg_power_hr_ratio_1st_half - avg_power_hr_ratio_2nd_half) / avg_power_hr_ratio_1st_half) * 100
    return cardiac_drift
```
A low value (close to 0 or negative) indicates good aerobic efficiency, while a high value (typically > 5-10%) may indicate a lack of aerobic base, fatigue or poor nutrition/hydration management.

### 5. Power Zones (Coggan Zones)

Power zones are calculated as fixed percentages of the athlete's Functional Threshold Power (FTP). This project uses the standard 7-zone model proposed by Andrew Coggan.

| Zone | Name | Range (% of FTP) |
| :--- | :--- | :--- |
| **Z1** | Active Recovery | < 55% |
| **Z2** | Endurance | 56% - 75% |
| **Z3** | Tempo | 76% - 90% |
| **Z4** | Lactate Threshold | 91% - 105% |
| **Z5** | VO2 Max | 106% - 120% |
| **Z6** | Anaerobic Capacity | 121% - 150% |
| **Z7** | Neuromuscular Power | > 150% |

**Algorithm:**
```python
def calculate_power_zones(ftp):
    return {
        "Z1": [0, int(ftp * 0.55)],
        "Z2": [int(ftp * 0.56), int(ftp * 0.75)],
        "Z3": [int(ftp * 0.76), int(ftp * 0.90)],
        "Z4": [int(ftp * 0.91), int(ftp * 1.05)],
        "Z5": [int(ftp * 1.06), int(ftp * 1.20)],
        "Z6": [int(ftp * 1.21), int(ftp * 1.50)],
        "Z7": [int(ftp * 1.51), 9999]
    }
```

### 6. Heart Rate Zones (Friel Zones)

Heart rate zones are calculated as percentages of the athlete's Lactate Threshold Heart Rate (LTHR) using the methodology of Joe Friel.

| Zone | Name | Range (% of LTHR) |
| :--- | :--- | :--- |
| **Z1** | Recovery | < 85% |
| **Z2** | Endurance (Base) | 85% - 89% |
| **Z3** | Tempo | 90% - 94% |
| **Z4** | Threshold | 95% - 100% |
| **Z5** | Aerobic Capacity (VO2 Max) | > 100% |

**Algorithm:**
```python
def calculate_hr_zones(lthr):
    return {
        "Z1": [0, int(lthr * 0.84)],
        "Z2": [int(lthr * 0.85), int(lthr * 0.89)],
        "Z3": [int(lthr * 0.90), int(lthr * 0.94)],
        "Z4": [int(lthr * 0.95), int(lthr * 1.00)],
        "Z5": [int(lthr * 1.01), 250]
    }
```

### 7. Automatic Threshold Improvement Detection

The system analyzes each activity looking for performances that suggest an improvement over the athlete's configured thresholds (FTP, LTHR and Threshold Pace).

**Detection Algorithm:**
1.  **FTP (Cycling):** It looks for the 20-minute block with the highest average power.
    *   `Suggestion = Best 20 min Power * 0.95`
2.  **LTHR (Heart Rate):** It looks for the 20-minute block with the highest average heart rate.
    *   `Suggestion = Best 20 min Average HR`
3.  **Threshold Pace (Running):** It looks for the 20-minute block with the highest average speed.
    *   `Suggestion = Best 20 min Average Speed`

**Implementation:**
The system uses a rolling window of 1200 seconds (20 minutes) over the activity records:
```python
def calculate_best_intervals(series, window_seconds):
    return series.rolling(window=window_seconds).mean().max()
```
If the computed value (after applying the 0.95 correction factor in the case of FTP) is higher than the current value in the user's preferences, a notification is triggered in the interface.

### 8. Zone Distribution (Heart Rate and Power)

Time-in-zone analysis allows evaluating whether training aligns with the objectives (e.g., base training in Z2, high-intensity intervals in Z4/Z5).

**Algorithm:**
1.  The user's Heart Rate and Power zones are defined with their upper limits.
2.  For each data point of the activity (recorded every second), it is classified into a zone by comparing the HR or power value with the defined limits.
3.  The total time (in seconds/minutes) spent in each zone is summed over the whole analysis period.

### 9. Power Curve (Mean Maximal Power - MMP)

The MMP curve represents the best average power values the athlete has been able to sustain for different durations (from 1 second to several hours).

**Algorithm:**
1.  Key durations are defined (1s, 5s, 1m, 5m, 20m, 60m, etc.).
2.  For each activity, the maximum of the rolling mean is computed for each duration.
3.  A historical record of these maxima is kept in the database (`mmp_data`).
4.  The visualization compares the current period curve with the historical records (All-time).

### 10. Aerobic Efficiency (Efficiency Factor - EF)

EF measures the relationship between the work done (Normalized Power) and the physiological cost (Average Heart Rate). It is the key metric to monitor the development of the aerobic base.

**Algorithm:**
-   `EF = Normalized Power (NP) / Average Heart Rate`
-   For the analysis to be valid, cycling activities longer than 60 minutes with stable power and HR data are filtered.
-   A rising EF indicates that the athlete is producing more power per heartbeat (better economy).

### 11. Variability Index (VI)

VI indicates how constant or "stochastic" the effort of an activity has been.

**Algorithm:**
-   `VI = Normalized Power (NP) / Average Power`
-   A value close to 1.0 (e.g. 1.02-1.05) indicates a very constant effort (like a time trial or a trainer ride).
-   High values (> 1.15) indicate efforts with many pace changes (intervals, races with attacks, very broken terrain).

### 12. Anaerobic Capacity (W-Prime - W')

W' represents the amount of energy (in Joules) an athlete can expend above their FTP before reaching exhaustion. It is visualized as an "anaerobic battery".

**Algorithm:**
-   **Estimation:** It is calculated by analyzing the historical power curve (MMP), comparing short-duration records (1-5 min) with the current FTP.
-   **Balance (W-bal):** It uses the **Skiba model (2012)** to compute the state of the battery second by second:
    -   **Expenditure:** When power > FTP, the battery depletes linearly.
    -   **Recovery:** When power < FTP, the battery recharges exponentially (the recharge is slower the closer to FTP).
-   **Interpretation:** A battery at 0% indicates imminent physiological exhaustion. It is useful for analyzing race attacks or the ability to repeat high-intensity efforts in interval sessions.

### 13. Training Volume

Total training volume is calculated aggregating the following metrics per week and per month:
-   **Total distance** (in km)
-   **Total time** (in hours)
-   **Total positive elevation gain** (in meters)

## Chart Visualizations

The calculations above are visualized with the following charts generated with **Chart.js** for interactivity:

-   **Weekly TSS**: Bar chart.
-   **Load Trends (CTL, ATL, TSB)**: Line chart.
-   **HR and Power Zone Distribution**: Pie charts.
-   **Weekly and Monthly Volume**: Bar charts showing distance with time and elevation details on hover.
-   **Power Curve (MMP)**: Line chart on a logarithmic scale comparing the current period with the historical records.
-   **Efficiency Evolution (EF)**: Scatter chart with trend line showing the improvement of the aerobic economy.
-   **Activity Performance Chart**: Time series of power, HR and cadence along the distance axis (km), including the **W' Balance** line (anaerobic battery).

## Glossary

*   **FTP (Functional Threshold Power):** The maximum average power a cyclist can theoretically sustain for one hour of constant effort. It is the reference value for calculating power zones.
*   **LTHR (Lactate Threshold Heart Rate):** The average heart rate sustained during a maximal effort of about 20-30 minutes. It defines the boundary between aerobic and anaerobic metabolism.
*   **NP (Normalized Power):** An estimate of the power that could have been sustained if the effort had been constant, compensating for changes in pace and terrain through a mathematical algorithm.
*   **IF (Intensity Factor):** The relationship between Normalized Power and FTP (`IF = NP / FTP`). It indicates how hard a session has been relative to current capacity.
*   **TSS (Training Stress Score):** A metric that quantifies the total load of a session combining intensity (IF) and duration.
*   **CTL (Chronic Training Load):** Chronic Training Load. Represents "Fitness" or physical condition. It is an average of the load accumulated over the last 42 days.
*   **ATL (Acute Training Load):** Short-term "Fatigue". It is an average of the load over the last 7 days.
*   **TSB (Training Stress Balance):** "Form" or "Freshness". It is calculated as `CTL - ATL`. A positive value indicates rest; a very negative one indicates deep fatigue.
*   **EF (Efficiency Factor):** Ratio between NP and Average HR. It measures the aerobic economy.
*   **VI (Variability Index):** Ratio between NP and Average Power. It measures the irregularity of the effort.
*   **W' (W-Prime):** Anaerobic capacity. The amount of energy available for efforts above the FTP (measured in Joules).
*   **VAM (Average Ascent Velocity):** Vertical meters climbed per hour.
*   **Cardiac Drift:** The rise in heart rate over time while maintaining constant power, indicative of cardiovascular fatigue or dehydration.
*   **MMP (Mean Maximal Power):** The maximum power value you have been able to sustain for a given duration (e.g.: MMP 20 min).

## References

The algorithms and metrics used in this project are based on well-established concepts in sports science and endurance training. The main references are:

-   **Allen, H., & Coggan, A. (2010). *Training and Racing with a Power Meter*. VeloPress.**
    -   This book is the fundamental reference for power-based training. It explains in detail the concepts of Normalized Power (NP), Intensity Factor (IF) and Training Stress Score (TSS). Dr. Andrew Coggan is the creator of these metrics.

-   **Friel, J. (2016). *The Cyclist's Training Bible*. VeloPress.**
    -   Joe Friel is a renowned coach who has popularized many of the training planning and periodization concepts. His book explains how to use load metrics (CTL, ATL, TSB) to guide training and peak at the right moment.

-   **Skiba, P. (2012). *Scientific Training for Endurance Athletes*.**
    -   This book delves into the mathematical models of human performance, including the impulse-response model on which the CTL, ATL and TSB metrics are based (originally proposed by Dr. E. W. Banister).

-   **Coyle, E. F. (1995). "Cardiovascular drift during prolonged exercise and the effects of dehydration." *International Journal of Sports Medicine*.**
    -   This and other works by Dr. Coyle are fundamental for understanding the concept of cardiac drift and its relationship with dehydration, core temperature rise and cardiovascular efficiency during prolonged exercise.

## License

© 2026 Pablo Sanxiao. Licensed under the [GNU AGPL-3.0](LICENSE).