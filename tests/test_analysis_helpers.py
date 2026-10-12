from api.services.analysis_service import (
    _is_running_sport,
    _is_cycling_sport,
    _build_enriched_context,
    _cadence_stats,
    _best_efforts,
    _summarize_by_sport,
    _rest_and_monotony,
)


class TestSportDetection:
    def test_running(self):
        assert _is_running_sport("running")
        assert _is_running_sport("TrailRun")
        assert not _is_running_sport("ride")

    def test_cycling(self):
        assert _is_cycling_sport("ride")
        assert _is_cycling_sport("virtualride")
        assert _is_cycling_sport("gravel_cycling")
        assert not _is_cycling_sport("running")


class TestEnrichedContext:
    def test_running_fields(self):
        session = {
            "averageRunCadence": 164.3, "maxRunCadence": 213, "steps": 12188,
            "strideLength": 114.15, "averageTemperature": 24.7,
            "averageBikeCadence": 88,
        }
        out = _build_enriched_context(session, "running")
        assert out["run_cadence_spm"] == 164.3
        assert out["stride_length_m"] == 1.14  # cm -> m
        assert "avg_cadence_rpm" not in out  # cycling-only key excluded

    def test_cycling_fields(self):
        session = {
            "averageBikeCadence": 88, "averageSeatedPower": 200,
            "leftTorqueEffectiveness": 48.0, "averageRunCadence": 164,
        }
        out = _build_enriched_context(session, "ride")
        assert out["avg_cadence_rpm"] == 88
        assert out["avg_seated_power_w"] == 200
        assert "run_cadence_spm" not in out  # running-only key excluded

    def test_none_session(self):
        assert _build_enriched_context(None, "ride") == {}


class TestCadenceStats:
    def test_basic(self):
        stats = _cadence_stats([80, 90, 100])
        assert stats["avg"] == 90.0
        assert stats["max"] == 100

    def test_empty(self):
        assert _cadence_stats([]) == {}


class TestBestEfforts:
    def test_running_pace(self):
        records = [{"speed": 12.0} for _ in range(120)]  # 12 km/h -> 5:00/km
        out = _best_efforts(records, "running")
        assert out["1min_pace"] == "5:00"
        assert "1min_w" not in out

    def test_cycling_power(self):
        records = [{"power": 200} for _ in range(120)]
        out = _best_efforts(records, "ride")
        assert out["1min_w"] == 200
        assert "1min_pace" not in out

    def test_short_activity(self):
        records = [{"power": 200} for _ in range(10)]
        assert _best_efforts(records, "ride") == {}


class TestSportBreakdown:
    def test_groups(self):
        activities = [
            {"sport": "ride", "tss": 100, "duration_min": 60, "distance_km": 30},
            {"sport": "running", "tss": 80, "duration_min": 40, "distance_km": 8},
            {"sport": "weighttraining", "tss": 20, "duration_min": 30, "distance_km": 0},
        ]
        out = _summarize_by_sport(activities)
        assert out["cycling"]["sessions"] == 1
        assert out["running"]["tss"] == 80
        assert out["other"]["sessions"] == 1


class TestLoadBalance:
    def test_rest_and_monotony(self):
        daily = [50] * 7 + [0] * 21
        out = _rest_and_monotony(["d"] * 28, daily)
        assert out["rest_days_last_28"] == 21
        assert out["weekly_monotony"] is None  # last 7 days are all zero
