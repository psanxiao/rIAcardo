import datetime
from unittest.mock import MagicMock, patch

import pytest


class TestWeeklyDayStatus:
    """Tests for the _weekly_day_status helper."""

    def test_no_plan_no_activity_is_rest(self):
        from api.services.coach_service import _weekly_day_status
        assert _weekly_day_status(False, 0, False, 0) == "rest"

    def test_planned_but_not_done_is_missed(self):
        from api.services.coach_service import _weekly_day_status
        assert _weekly_day_status(True, 60, False, 0) == "missed"

    def test_planned_rest_day_is_rest(self):
        from api.services.coach_service import _weekly_day_status
        assert _weekly_day_status(True, 0, False, 0) == "rest"

    def test_activity_without_plan_is_extra(self):
        from api.services.coach_service import _weekly_day_status
        assert _weekly_day_status(False, 0, True, 45) == "extra"

    def test_matching_load_is_completed(self):
        from api.services.coach_service import _weekly_day_status
        assert _weekly_day_status(True, 100, True, 90) == "completed"

    def test_low_load_is_partial(self):
        from api.services.coach_service import _weekly_day_status
        assert _weekly_day_status(True, 100, True, 40) == "partial"

    def test_doing_something_on_planned_rest_is_extra(self):
        from api.services.coach_service import _weekly_day_status
        assert _weekly_day_status(True, 0, True, 30) == "extra"


class TestWeeklyBalance:
    """Tests for the _weekly_balance helper."""

    def test_counts_rest_days_and_monotony(self):
        from api.services.coach_service import _weekly_balance
        balance = _weekly_balance([50, 0, 80, 0, 60, 100, 0])
        assert balance["rest_days"] == 3
        assert balance["monotony"] is not None

    def test_empty_series(self):
        from api.services.coach_service import _weekly_balance
        assert _weekly_balance([]) == {"rest_days": 0, "monotony": None}

    def test_zero_stddev_has_no_monotony(self):
        from api.services.coach_service import _weekly_balance
        balance = _weekly_balance([0, 0, 0, 0, 0, 0, 0])
        assert balance["rest_days"] == 7
        assert balance["monotony"] is None


class TestGetWeeklySummary:
    """Tests for the get_weekly_summary aggregation function."""

    def _mock_conn(self, planned_rows):
        cursor = MagicMock()
        cursor.fetchall.return_value = planned_rows
        conn = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cursor
        return conn

    @patch('api.services.coach_service.get_training_load')
    @patch('api.services.analysis_service.get_activities_list')
    def test_aggregates_plan_and_activity(self, mock_activities, mock_load):
        """Should merge planned workouts and real activities day by day."""
        # Week of Monday 2026-10-12 (target date 2026-10-14, a Wednesday).
        planned_rows = [
            (datetime.date(2026, 10, 12), "Rodaje suave", "60 min Z2", "ride", 60, 50),
            (datetime.date(2026, 10, 13), "Series", "5x3'", "run", 45, 70),
        ]
        activities = [
            {"activity_id": 1, "date": "2026-10-12", "start_time": "2026-10-12T09:00:00",
             "sport": "Ride", "tss": 55, "distance_km": 30.0, "duration_min": 62, "ascent_m": 200},
            {"activity_id": 2, "date": "2026-10-14", "start_time": "2026-10-14T18:00:00",
             "sport": "Run", "tss": 40, "distance_km": 8.0, "duration_min": 40, "ascent_m": 50},
        ]
        mock_activities.return_value = activities
        mock_load.return_value = {
            "dates": ["2026-10-12", "2026-10-13", "2026-10-14"],
            "ctl": [70.0, 70.5, 71.0],
            "atl": [60.0, 61.0, 59.0],
            "tsb": [-5.0, -6.0, -3.0],
        }

        from api.services.coach_service import get_weekly_summary
        conn = self._mock_conn(planned_rows)
        result = get_weekly_summary(conn, "user-1", "2026-10-14")

        assert result["start_date"] == "2026-10-12"
        assert result["end_date"] == "2026-10-18"
        assert result["planned_tss"] == 120
        assert result["actual_tss"] == 95
        assert result["compliance_pct"] == pytest.approx(79.2, abs=0.1)
        assert len(result["days"]) == 7

        monday = result["days"][0]
        assert monday["weekday"] == "lunes"
        assert monday["status"] == "completed"
        assert len(monday["planned"]) == 1
        assert len(monday["actual"]) == 1

        # Tuesday was planned but not done.
        assert result["days"][1]["status"] == "missed"
        # Wednesday had an unplanned session.
        assert result["days"][2]["status"] == "extra"

        assert result["totals"]["sessions"] == 2
        assert result["totals"]["distance_km"] == 38.0
        assert result["balance"]["rest_days"] == 5
        assert result["load"]["ctl_change"] == pytest.approx(1.0)
        assert result["load"]["tsb_end"] == -3.0
        assert "cycling" in result["sport_breakdown"]

    @patch('api.services.coach_service.get_training_load')
    @patch('api.services.analysis_service.get_activities_list')
    def test_empty_week_is_safe(self, mock_activities, mock_load):
        """Should return a coherent summary even with no plan or activities."""
        mock_activities.return_value = []
        mock_load.return_value = {"dates": [], "ctl": [], "atl": [], "tsb": []}

        from api.services.coach_service import get_weekly_summary
        conn = self._mock_conn([])
        result = get_weekly_summary(conn, "user-1", "2026-10-14")

        assert result["planned_tss"] == 0
        assert result["actual_tss"] == 0
        assert result["compliance_pct"] == 0
        assert result["totals"]["sessions"] == 0
        assert all(day["status"] == "rest" for day in result["days"])
        assert result["load"] is None

    @patch('api.services.coach_service.get_training_load')
    @patch('api.services.analysis_service.get_activities_list')
    def test_load_context_failure_is_swallowed(self, mock_activities, mock_load):
        """A failing load calculation should not break the summary."""
        mock_activities.return_value = []
        mock_load.side_effect = RuntimeError("boom")

        from api.services.coach_service import get_weekly_summary
        conn = self._mock_conn([])
        result = get_weekly_summary(conn, "user-1", "2026-10-14")

        assert result["load"] is None
        assert result["start_date"] == "2026-10-12"
