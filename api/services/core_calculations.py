"""
Core cycling performance calculations.
Pure calculation functions for performance analysis.
so they can be reused without importing plotly/dash dependencies.
"""
from datetime import timedelta
import numpy as np

# --- Default Configuration ---
DEFAULT_FTP = 272
DEFAULT_HR_MAX = 196
DEFAULT_LTHR = 165
DEFAULT_HR_ZONES = {
    "Z1": (0, 114), "Z2": (115, 138), "Z3": (139, 153),
    "Z4": (154, 173), "Z5": (174, 196)
}
DEFAULT_POWER_ZONES = {
    "Z1": (0, 150), "Z2": (151, 204), "Z3": (205, 245),
    "Z4": (246, 286), "Z5": (287, 327), "Z6": (328, 411), "Z7": (412, 99999)
}
DEFAULT_CTL_TC = 42
DEFAULT_ATL_TC = 7
DEFAULT_NP_ROLLING_SECONDS = 30
DEFAULT_THRESHOLD_PACE = 3.7 # Default Threshold Pace in m/s (approx 4:30 min/km)

# Default zones in list format (matching Settings.jsx structure)
DEFAULT_POWER_ZONES_LIST = [
    {"name": "Z1", "label": "Recuperación Activa", "min": 0, "max": 150},
    {"name": "Z2", "label": "Resistencia", "min": 151, "max": 204},
    {"name": "Z3", "label": "Tempo", "min": 205, "max": 245},
    {"name": "Z4", "label": "Umbral Lactato", "min": 246, "max": 286},
    {"name": "Z5", "label": "VO2 Máx", "min": 287, "max": 327},
    {"name": "Z6", "label": "Capacidad Anaeróbica", "min": 328, "max": 411},
    {"name": "Z7", "label": "Neuromuscular", "min": 412, "max": 9999},
]

DEFAULT_HR_ZONES_LIST = [
    {"name": "Z1", "label": "Recuperación Activa", "min": 0, "max": 114},
    {"name": "Z2", "label": "Aeróbico", "min": 115, "max": 138},
    {"name": "Z3", "label": "Tempo", "min": 139, "max": 153},
    {"name": "Z4", "label": "Sub-Umbral", "min": 154, "max": 173},
    {"name": "Z5", "label": "Umbral / Anaeróbico", "min": 174, "max": 250},
]

MMP_DURATIONS = [
    1, 2, 5, 10, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200
]


# --- Interval Calculations ---

def calculate_best_intervals(series, window_seconds):
    """Calculates the maximum average value for a given window size in seconds."""
    if len(series) < window_seconds:
        return np.nan
    return series.rolling(window=window_seconds).mean().max()


def get_mmp_curve(power_series):
    """Calculates the MMP (Mean Maximal Power) curve for a power series."""
    mmp = {}
    for d in MMP_DURATIONS:
        val = calculate_best_intervals(power_series, d)
        if not np.isnan(val):
            mmp[d] = int(val)
    return mmp


def estimate_w_prime(mmp_data, ftp):
    """
    Estimates W' (anaerobic capacity in Joules) based on MMP data and FTP.
    Uses the 1-min and 5-min efforts to find the average above-FTP capacity.
    Falls back to a default if MMP data is insufficient or unreliable.
    """
    if not mmp_data or ftp <= 0:
        return DEFAULT_W_PRIME

    p1 = mmp_data.get(60) or mmp_data.get('60')
    p2 = mmp_data.get(300) or mmp_data.get('300')

    if not p1 or not p2:
        return DEFAULT_W_PRIME

    w1 = max(0, (p1 - ftp)) * 60
    w2 = max(0, (p2 - ftp)) * 300

    estimated_w = (w1 + w2) / 2
    # If both efforts are below FTP (endurance ride), use default
    if estimated_w < 2000:
        return DEFAULT_W_PRIME
    return int(estimated_w)


DEFAULT_W_PRIME = 20000


def calculate_w_bal(power_series, ftp, w_prime=None):
    """
    Calculates W'bal (W-prime balance) second-by-second using the Skiba model.

    When power > FTP: W' depletes linearly (power - FTP) per second.
    When power < FTP: W' recovers exponentially — tau scales with how far below FTP.

    Args:
        power_series: list/array of power values (per-second, may contain None)
        ftp: FTP in watts
        w_prime: W' capacity in Joules (defaults to 20000 if None)

    Returns:
        list of W'bal values in Joules (same length as power_series)
    """
    import numpy as np

    if w_prime is None:
        w_prime = DEFAULT_W_PRIME
    if ftp <= 0 or w_prime <= 0:
        return []

    w_bal = float(w_prime)
    result = []

    for i, p in enumerate(power_series):
        if p is None or (isinstance(p, float) and np.isnan(p)):
            p = 0

        if p > ftp:
            # Deplete: energy above FTP drains W'
            w_bal -= (p - ftp)
        elif p < ftp and p > 0:
            # Recover: exponential model
            # Below CP recovery tau (Skiba): tau = (546 * exp(-0.04 * DCP)) + 316
            # where DCP = FTP - power (below-CP delta)
            dcp = ftp - p
            tau = 546 * np.exp(-0.04 * dcp) + 316
            w_prime_remaining = w_bal
            # Exponential recovery toward full W'
            w_bal = w_prime - (w_prime - w_prime_remaining) * np.exp(-1.0 / tau)
        elif p == 0:
            # Zero power (coasting): faster recovery
            dcp = ftp
            tau = 546 * np.exp(-0.04 * dcp) + 316
            w_bal = w_prime - (w_prime - w_bal) * np.exp(-1.0 / tau)

        # Clamp
        if w_bal < 0:
            w_bal = 0
        if w_bal > w_prime:
            w_bal = float(w_prime)

        result.append(round(w_bal))

    return result


# --- TrainingPeaks Calculations ---

def classify_zone(value, zones_upper_bounds):
    for i, upper_bound in enumerate(zones_upper_bounds):
        if value <= upper_bound:
            return f"Z{i+1}"
    return f"Z{len(zones_upper_bounds)}+"


def calculate_normalized_power(power_data, interval_seconds):
    """Calculates Normalized Power (NP) using the standard 30s rolling average method."""
    if len(power_data) < interval_seconds:
        return np.nan
    power_data_filled = power_data.fillna(0)
    rolling_avg_power = power_data_filled.rolling(window=interval_seconds, min_periods=1).mean()
    rolling_avg_power_4th = rolling_avg_power**4
    mean_4th_power = rolling_avg_power_4th.mean()
    np_val = mean_4th_power**(1/4)
    return np_val


def calculate_tss(activity_duration_seconds, np_watts, ftp_watts):
    """Calculates Training Stress Score (TSS) from NP and FTP."""
    if ftp_watts == 0 or np.isnan(np_watts):
        return np.nan
    if_val = np_watts / ftp_watts
    tss = (activity_duration_seconds * (if_val**2)) / 3600 * 100
    return tss


def calculate_hrtss(activity_duration_seconds, avg_hr, lthr):
    """Calculates Heart Rate TSS (hrTSS) based on simple intensity factor."""
    if lthr == 0 or np.isnan(avg_hr):
        return np.nan
    if_val = avg_hr / lthr
    tss = (activity_duration_seconds * (if_val**2)) / 3600 * 100
    return tss


def calculate_rtss(activity_duration_seconds, avg_speed, threshold_pace):
    """Calculates Run TSS (rTSS) based on pace/speed."""
    if threshold_pace == 0 or np.isnan(avg_speed):
        return np.nan
    if_val = avg_speed / threshold_pace
    tss = (activity_duration_seconds * (if_val**2)) / 3600 * 100
    return tss


def calculate_cardiac_drift(df_activity_records, total_elapsed_time, metric_col=None):
    """
    Calculates cardiac drift (aerobic decoupling) as the percentage change in
    the work/HR ratio between the first and second half of the activity.

    metric_col defaults to 'power' when it has data (cycling) and falls back to
    'speed' (running pace-based decoupling). Returns NaN when the required
    columns are missing or there is not enough data.
    """
    import pandas as pd

    df = df_activity_records.copy()
    if 'hr' in df.columns and 'heart_rate' not in df.columns:
        df = df.rename(columns={'hr': 'heart_rate'})

    if metric_col is None:
        if 'power' in df.columns and df['power'].notna().any():
            metric_col = 'power'
        elif 'speed' in df.columns and df['speed'].notna().any():
            metric_col = 'speed'
        else:
            return np.nan

    if metric_col not in df.columns or 'heart_rate' not in df.columns:
        return np.nan

    # Handle timestamp column name variants
    ts_col = 'timestamp'
    if 'timestamp' not in df.columns:
        if 'time' in df.columns:
            ts_col = 'time'
        else:
            return np.nan

    df_clean = df.dropna(subset=[metric_col, 'heart_rate']).copy()
    df_clean = df_clean[df_clean['heart_rate'] > 0]
    if df_clean.empty or len(df_clean) < 2:
        return np.nan

    # Ensure timestamp is datetime
    if not pd.api.types.is_datetime64_any_dtype(df_clean[ts_col]):
        df_clean[ts_col] = pd.to_datetime(df_clean[ts_col], errors='coerce')
    df_clean = df_clean.dropna(subset=[ts_col])
    if df_clean.empty:
        return np.nan

    df_clean['metric_hr_ratio'] = df_clean[metric_col] / df_clean['heart_rate']

    midpoint_time = total_elapsed_time / 2
    start_ts = df_clean[ts_col].min()

    first_half = df_clean[df_clean[ts_col] <= start_ts + timedelta(seconds=midpoint_time)]
    second_half = df_clean[df_clean[ts_col] > start_ts + timedelta(seconds=midpoint_time)]

    if first_half.empty or second_half.empty:
        return np.nan

    avg_1st = first_half['metric_hr_ratio'].mean()
    avg_2nd = second_half['metric_hr_ratio'].mean()

    if avg_1st == 0 or np.isnan(avg_1st) or np.isnan(avg_2nd):
        return np.nan

    return ((avg_1st - avg_2nd) / avg_1st) * 100


def calculate_ctl_atl_tsb(daily_tss, ctl_tc, atl_tc):
    """Calculates CTL (Chronic Training Load), ATL (Acute Training Load), and TSB (Training Stress Balance)."""
    import pandas as pd

    daily_tss = daily_tss.sort_index()
    ctl_values = []
    atl_values = []
    tsb_values = []
    current_ctl = 0
    current_atl = 0

    for date, tss in daily_tss.items():
        current_ctl = current_ctl + (tss - current_ctl) / ctl_tc
        current_atl = current_atl + (tss - current_atl) / atl_tc
        ctl_values.append(current_ctl)
        atl_values.append(current_atl)
        tsb_values.append(current_ctl - current_atl)

    df_training_load = pd.DataFrame({
        'CTL': ctl_values,
        'ATL': atl_values,
        'TSB': tsb_values
    }, index=daily_tss.index)

    return df_training_load


def calculate_activity_tss(duration_sec, sport, np_val=None, ftp=None, avg_hr=None, lthr=None, avg_speed=None, threshold_pace=None):
    """
    Unified function to calculate TSS based on available data and sport.
    Priority:
    1. Cycling: Power (TSS) > HR (hrTSS)
    2. Running: Pace (rTSS) > HR (hrTSS)
    3. Other: HR (hrTSS)
    """
    tss = 0
    sport = sport.lower() if sport else ""
    
    cycling_sports = ['ride', 'cycling', 'virtualride', 'road_biking', 'gravel_cycling', 'mountain_biking', 'indoor_cycling', 'virtual_ride', 'e_bike_ride', 'mountain_bike']
    if sport in cycling_sports:
        if np_val is not None and ftp and ftp > 0:
            tss = calculate_tss(duration_sec, np_val, ftp)
        elif avg_hr is not None and lthr and lthr > 0:
            tss = calculate_hrtss(duration_sec, avg_hr, lthr)
    elif sport in ['run', 'running', 'virtualrun']:
        if avg_speed is not None and threshold_pace and threshold_pace > 0:
            tss = calculate_rtss(duration_sec, avg_speed, threshold_pace)
        elif avg_hr is not None and lthr and lthr > 0:
            tss = calculate_hrtss(duration_sec, avg_hr, lthr)
    else:
        if avg_hr is not None and lthr and lthr > 0:
            tss = calculate_hrtss(duration_sec, avg_hr, lthr)
            
    return tss if tss and not np.isnan(tss) else 0


def calculate_race_predictions(ftp, threshold_pace, w_prime=None):
    """
    Predicts performance for key durations/distances using the Critical Power
    model (cycling) and Riegel formula (running).

    Cycling: P(t) = FTP + W'/t
    Running: T2 = T1 * (D2/D1)^1.06  (Riegel exponent)

    Args:
        ftp: FTP in watts (cycling)
        threshold_pace: threshold pace in m/s (running)
        w_prime: W' in Joules (defaults to 20000)

    Returns:
        dict with cycling_predictions and running_predictions
    """
    if w_prime is None:
        w_prime = DEFAULT_W_PRIME

    result = {"cycling": [], "running": []}

    # --- Cycling: Critical Power model ---
    if ftp and ftp > 0:
        for label, seconds in [("1 min", 60), ("5 min", 300), ("20 min", 1200), ("60 min (FTP)", 3600)]:
            predicted_power = int(ftp + w_prime / seconds)
            if label.startswith("60"):
                predicted_power = int(ftp)
            result["cycling"].append({
                "duration_label": label,
                "predicted_power_w": predicted_power,
            })

    # --- Running: Riegel formula ---
    if threshold_pace and threshold_pace > 0:
        T1 = 3600.0  # threshold pace ~ 60min effort
        D1 = threshold_pace * T1  # meters covered in 60min
        riegel_exp = 1.06
        for label_dist, dist_m in [("5K", 5000), ("10K", 10000), ("Media Maratón", 21097.5), ("Maratón", 42195)]:
            if D1 <= 0:
                continue
            T2 = T1 * (dist_m / D1) ** riegel_exp
            pace_sec_per_km = T2 / (dist_m / 1000)
            hours = int(T2 // 3600)
            mins = int((T2 % 3600) // 60)
            secs = int(T2 % 60)
            time_str = f"{hours}:{mins:02d}:{secs:02d}" if hours > 0 else f"{mins}:{secs:02d}"
            pm = int(pace_sec_per_km // 60)
            ps = int(pace_sec_per_km % 60)
            pace_str = f"{pm}:{ps:02d} /km"
            result["running"].append({
                "distance_label": label_dist,
                "predicted_time": time_str,
                "predicted_pace": pace_str,
            })

    return result
