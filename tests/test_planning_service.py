"""Tests for the automatic planning schedule logic (preferences + due dates)."""

from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest

from api.services.planning_service import (
    PlanningValidationError,
    generation_hour,
    get_plan_schedule,
    is_due,
    next_run_date,
    update_plan_schedule,
)

MONDAY = date(2024, 1, 1)  # 2024-01-01 was a Monday


def _monday(weeks=0):
    return MONDAY + timedelta(weeks=weeks)


class TestIsDue:
    def test_first_run_waits_for_the_chosen_weekday(self):
        assert is_due("weekly", 0, None, MONDAY) is True
        assert is_due("weekly", 0, None, MONDAY + timedelta(days=1)) is False

    def test_weekly_due_after_full_week(self):
        assert is_due("weekly", 0, _monday(0), _monday(1)) is True
        assert is_due("weekly", 0, _monday(0), _monday(0)) is False

    def test_weekly_catch_up_when_run_was_missed(self):
        # Last run two Mondays ago, today is Wednesday: it should catch up.
        assert is_due("weekly", 0, MONDAY - timedelta(days=7), MONDAY + timedelta(days=2)) is True

    def test_biweekly_not_due_after_one_week(self):
        assert is_due("biweekly", 0, _monday(0), _monday(1)) is False

    def test_biweekly_due_after_two_weeks(self):
        assert is_due("biweekly", 0, _monday(0), _monday(2)) is True


class TestNextRunDate:
    def test_never_run_picks_upcoming_weekday(self):
        assert next_run_date("weekly", 0, None, MONDAY) == MONDAY
        assert next_run_date("weekly", 0, None, MONDAY + timedelta(days=1)) == _monday(1)

    def test_weekly_is_due_today_after_a_week(self):
        assert next_run_date("weekly", 0, _monday(0), _monday(1)) == _monday(1)

    def test_weekly_next_week_when_just_generated(self):
        assert next_run_date("weekly", 0, MONDAY, MONDAY) == _monday(1)

    def test_biweekly_skips_one_week(self):
        assert next_run_date("biweekly", 0, _monday(0), _monday(1)) == _monday(2)


class TestPreferences:
    def _mock_conn(self, rows):
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = rows
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        return mock_conn, mock_cursor

    def test_get_plan_schedule_defaults(self):
        conn, _ = self._mock_conn([])
        schedule = get_plan_schedule(conn, "user-1")
        assert schedule["enabled"] is False
        assert schedule["cadence"] == "weekly"
        assert schedule["day"] == 0
        assert schedule["day_name"] == "Lunes"
        assert schedule["hour"] == 6
        assert schedule["last_run"] is None

    def test_get_plan_schedule_reads_stored_values(self):
        conn, _ = self._mock_conn([
            ("plan_enabled", "true"),
            ("plan_cadence", "biweekly"),
            ("plan_day", "2"),
            ("plan_last_run", "2024-01-01T06:00:00"),
        ])
        schedule = get_plan_schedule(conn, "user-1")
        assert schedule["enabled"] is True
        assert schedule["cadence"] == "biweekly"
        assert schedule["day"] == 2
        assert schedule["day_name"] == "Miércoles"
        assert schedule["last_run"] == "2024-01-01"

    def test_get_plan_schedule_ignores_corrupt_values(self):
        conn, _ = self._mock_conn([
            ("plan_cadence", "hourly"),
            ("plan_day", "99"),
            ("plan_last_run", "not-a-date"),
        ])
        schedule = get_plan_schedule(conn, "user-1")
        assert schedule["cadence"] == "weekly"
        assert schedule["day"] == 0
        assert schedule["last_run"] is None

    def test_update_plan_schedule_validates_payload(self):
        conn, _ = self._mock_conn([])
        with pytest.raises(PlanningValidationError):
            update_plan_schedule(conn, "user-1", {"enabled": "yes", "cadence": "weekly", "day": 0})
        with pytest.raises(PlanningValidationError):
            update_plan_schedule(conn, "user-1", {"enabled": True, "cadence": "hourly", "day": 0})
        with pytest.raises(PlanningValidationError):
            update_plan_schedule(conn, "user-1", {"enabled": True, "cadence": "weekly", "day": 9})

    def test_update_plan_schedule_persists_values(self):
        conn, cursor = self._mock_conn([])
        update_plan_schedule(conn, "user-1", {"enabled": True, "cadence": "biweekly", "day": 3})
        conn.commit.assert_called_once()
        inserted = {
            call.args[1][1]: call.args[1][2]
            for call in cursor.execute.call_args_list
            if "INSERT INTO" in call.args[0]
        }
        assert inserted["plan_enabled"] == "true"
        assert inserted["plan_cadence"] == "biweekly"
        assert inserted["plan_day"] == "3"


class TestGenerationHour:
    def test_defaults_to_six(self, monkeypatch):
        monkeypatch.delenv("PLAN_GENERATION_HOUR", raising=False)
        assert generation_hour() == 6

    def test_reads_env_and_clamps(self, monkeypatch):
        monkeypatch.setenv("PLAN_GENERATION_HOUR", "8")
        assert generation_hour() == 8
        monkeypatch.setenv("PLAN_GENERATION_HOUR", "99")
        assert generation_hour() == 23
        monkeypatch.setenv("PLAN_GENERATION_HOUR", "nonsense")
        assert generation_hour() == 6
