import numpy as np
import pandas as pd
from api.services.core_calculations import (
    calculate_normalized_power,
    calculate_tss,
    calculate_hrtss,
    calculate_rtss,
    calculate_ctl_atl_tsb,
    get_mmp_curve,
    estimate_w_prime,
    calculate_cardiac_drift,
    calculate_activity_tss,
    calculate_best_intervals,
    MMP_DURATIONS,
    DEFAULT_FTP
)


class TestNormalizedPower:
    def test_basic_calculation(self):
        """NP for constant power should equal the power value."""
        power_data = pd.Series([200] * 100)
        np_val = calculate_normalized_power(power_data, 30)
        assert abs(np_val - 200) < 1

    def test_variable_power(self):
        """NP should be higher than average for variable power."""
        power_data = pd.Series([100] * 50 + [300] * 50)
        np_val = calculate_normalized_power(power_data, 30)
        avg = power_data.mean()
        assert np_val > avg

    def test_short_series(self):
        """Short series should return NaN."""
        power_data = pd.Series([100, 200])
        np_val = calculate_normalized_power(power_data, 30)
        assert np.isnan(np_val)


class TestTSS:
    def test_calculate_tss(self):
        """TSS for 1hr at FTP should be 100."""
        tss = calculate_tss(3600, 200, 200)  # 1 hour, NP=200, FTP=200
        assert abs(tss - 100) < 1

    def test_tss_half_ftp(self):
        """TSS for 1hr at half FTP should be ~25."""
        tss = calculate_tss(3600, 100, 200)
        assert abs(tss - 25) < 1

    def test_zero_ftp(self):
        """TSS with zero FTP should return NaN."""
        tss = calculate_tss(3600, 200, 0)
        assert np.isnan(tss)


class TestCTLATLTSB:
    def test_basic_calculation(self):
        """Should return DataFrame with CTL, ATL, TSB columns."""
        daily_tss = pd.Series(
            [100, 150, 200, 100, 50],
            index=pd.date_range('2026-01-01', periods=5)
        )
        result = calculate_ctl_atl_tsb(daily_tss, 42, 7)
        assert 'CTL' in result.columns
        assert 'ATL' in result.columns
        assert 'TSB' in result.columns
        assert len(result) == 5

    def test_tsb_calculation(self):
        """TSB should equal CTL minus ATL."""
        daily_tss = pd.Series(
            [100, 100, 100, 100, 100],
            index=pd.date_range('2026-01-01', periods=5)
        )
        result = calculate_ctl_atl_tsb(daily_tss, 42, 7)
        for i in range(len(result)):
            expected_tsb = result['CTL'].iloc[i] - result['ATL'].iloc[i]
            assert abs(result['TSB'].iloc[i] - expected_tsb) < 0.01


class TestMMPCurve:
    def test_basic_mmp(self):
        """MMP curve should contain values for standard durations."""
        power_series = pd.Series([200] * 1000)
        mmp = get_mmp_curve(power_series)
        assert 60 in mmp or '60' in mmp  # 1 minute
        assert 300 in mmp or '300' in mmp  # 5 minutes

    def test_empty_series(self):
        """MMP for empty series should return empty dict."""
        power_series = pd.Series(dtype=float)
        mmp = get_mmp_curve(power_series)
        assert mmp == {} or len(mmp) == 0


class TestEstimateWPrime:
    def test_basic_estimate(self):
        """W' should be estimated from MMP data and FTP."""
        mmp_data = {60: 300, 300: 250}  # 1min=300W, 5min=250W
        ftp = 200
        w_prime = estimate_w_prime(mmp_data, ftp)
        assert w_prime > 1000
        assert w_prime < 50000

    def test_zero_ftp(self):
        """W' with zero FTP should return default."""
        w_prime = estimate_w_prime({60: 300}, 0)
        assert w_prime == 20000


class TestCardiacDrift:
    def test_no_drift(self):
        """Constant power and HR should result in minimal drift."""
        df = pd.DataFrame({
            'power': [200] * 100,
            'heart_rate': [150] * 100,
            'timestamp': pd.date_range('2026-01-01', periods=100, freq='s')
        })
        drift = calculate_cardiac_drift(df, 100)
        assert abs(drift) < 5

    def test_insufficient_data(self):
        """Should return NaN with missing columns."""
        df = pd.DataFrame({'power': [200]})
        drift = calculate_cardiac_drift(df, 1)
        assert np.isnan(drift)

    def test_running_uses_speed_when_no_power(self):
        """Running records (speed + hr, no power data) should still yield drift."""
        df = pd.DataFrame({
            'speed': [3.5] * 100,
            'hr': [150] * 100,
            'time': pd.date_range('2026-01-01', periods=100, freq='s')
        })
        drift = calculate_cardiac_drift(df, 100)
        assert not np.isnan(drift)
        assert abs(drift) < 5

    def test_power_preferred_over_speed(self):
        """When both power and speed exist, power drives the drift."""
        df = pd.DataFrame({
            'power': [200] * 100,
            'speed': [0] * 100,
            'hr': [150] * 100,
            'timestamp': pd.date_range('2026-01-01', periods=100, freq='s')
        })
        drift = calculate_cardiac_drift(df, 100)
        assert abs(drift) < 5


class TestHRtss:
    def test_basic_calculation(self):
        """hrTSS should be calculated from duration, avg_hr and LTHR."""
        tss = calculate_hrtss(3600, 150, 150)  # 1hr at LTHR
        assert abs(tss - 100) < 1

    def test_zero_lthr(self):
        """hrTSS with zero LTHR should return NaN."""
        tss = calculate_hrtss(3600, 150, 0)
        assert np.isnan(tss)


class TestRTSS:
    def test_basic_calculation(self):
        """rTSS should be calculated from duration, speed and threshold pace."""
        tss = calculate_rtss(3600, 3.7, 3.7)  # 1hr at threshold pace
        assert abs(tss - 100) < 1


class TestBestIntervals:
    def test_basic_calculation(self):
        """Should return max average of rolling window."""
        # Series: [100, 200, 300, 200, 100], window=3
        # Rolling means: (100+200+300)/3=200, (200+300+200)/3=233.33, (300+200+100)/3=200
        # Max should be ~233.33
        series = pd.Series([100, 200, 300, 200, 100])
        result = calculate_best_intervals(series, 3)
        assert abs(result - 233.33) < 1

    def test_short_series(self):
        """Should return NaN for series shorter than window."""
        series = pd.Series([100, 200])
        result = calculate_best_intervals(series, 30)
        assert np.isnan(result)


class TestCalculateActivityTSS:
    def test_cycling_with_power(self):
        """Cycling with power should use TSS formula."""
        tss = calculate_activity_tss(3600, 'Ride', np_val=200, ftp=200)
        assert abs(tss - 100) < 1

    def test_cycling_no_power_with_hr(self):
        """Cycling without power should use hrTSS."""
        tss = calculate_activity_tss(3600, 'Ride', avg_hr=150, lthr=150)
        assert tss > 0

    def test_running(self):
        """Running should use rTSS or hrTSS."""
        tss = calculate_activity_tss(3600, 'Run', avg_speed=3.0, threshold_pace=3.0)
        assert tss > 0
