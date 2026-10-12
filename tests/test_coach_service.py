import asyncio
import pytest
from unittest.mock import MagicMock, patch, PropertyMock, AsyncMock
import json

class TestAnalyzeSingleActivity:
    """Tests for the analyze_single_activity function."""

    @patch('api.services.coach_service._call_groq', new_callable=AsyncMock)
    @patch('builtins.open', new_callable=PropertyMock)
    @patch('api.services.coach_service.os.path.exists')
    @patch('api.services.coach_service.fetch_user_preferences')
    @patch('api.services.coach_service.get_activity_detail')
    @patch('api.services.coach_service.get_training_load')
    def test_analyze_single_activity_success(
        self, mock_get_load, mock_get_detail, 
        mock_fetch_prefs, mock_exists, mock_open, mock_call_groq
    ):
        """Should successfully analyze an activity and return markdown."""
        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = "Eres un entrenador..."

        mock_get_detail.return_value = {
            "activity": {
                "activity_id": 123,
                "raw_data": {"name": "Test Ride", "mmp_data": {"60": 210, "300": 180}},
                "sport": "Ride",
                "duration_sec": 3600,
                "distance_km": 30.0,
                "avg_power": 200,
                "np": 210,
                "if": 0.95,
                "tss": 95,
                "avg_hr": 150,
                "max_hr": 175,
                "avg_cadence": 85,
                "avg_speed": 28.0,
                "ascent_m": 300,
            },
            "records": [
                {"time": "2026-01-01T10:00:00", "power": 200, "hr": 150, "cadence": 85},
                {"time": "2026-01-01T10:01:00", "power": 210, "hr": 152, "cadence": 86},
            ],
            "time_in_power_zones": {"Z1": {"min": 0, "pct": 10}, "Z2": {"min": 5, "pct": 5}},
            "time_in_hr_zones": {"Z1": {"min": 0, "pct": 5}},
            "power_zone_ranges": {"Z1": [0, 150]},
            "hr_zone_ranges": {"Z1": [0, 120]},
            "laps": [{"number": 1, "duration_min": 60}]
        }
        mock_get_load.return_value = {
            "current_ctl": 85, "current_atl": 75, "current_tsb": 10
        }
        mock_fetch_prefs.return_value = {"ftp": 220, "lthr": 160}

        mock_call_groq.return_value = "Buen entrenamiento!..."

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        from api.services.coach_service import analyze_single_activity
        import uuid

        result = asyncio.run(analyze_single_activity(mock_conn, str(uuid.uuid4()), 123))
        assert "error" not in result
        assert "analysis" in result
        assert result["analysis"] == "Buen entrenamiento!..."

    @patch('api.services.coach_service.get_activity_detail')
    def test_activity_not_found(self, mock_get_detail):
        """Should return error if activity not found."""
        mock_get_detail.return_value = {"error": "Activity not found"}

        from api.services.coach_service import analyze_single_activity

        mock_conn = MagicMock()
        result = asyncio.run(analyze_single_activity(mock_conn, "test-user-id", 999))
        assert "error" in result

    @patch('api.services.coach_service.get_training_load')
    @patch('api.services.coach_service.get_activity_detail')
    @patch('api.services.coach_service.fetch_user_preferences')
    @patch('api.services.coach_service.os.path.exists')
    @patch('builtins.open', new_callable=PropertyMock)
    def test_missing_groq_key(
        self, mock_open, mock_exists, mock_fetch_prefs, 
        mock_get_detail, mock_get_load
    ):
        """Should return error if GROQ_API_KEY is not set."""
        import os
        original_key = os.environ.get("GROQ_API_KEY")
        os.environ.pop("GROQ_API_KEY", None)

        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = "Instrucciones..."
        mock_get_detail.return_value = {
            "activity": {"activity_id": 123, "sport": "Ride"},
            "records": []
        }
        mock_get_load.return_value = {}
        mock_fetch_prefs.return_value = {}

        from api.services.coach_service import analyze_single_activity
        import uuid

        mock_conn = MagicMock()
        try:
            with patch('api.services.coach_service.GROQ_API_KEY', None):
                result = asyncio.run(analyze_single_activity(mock_conn, str(uuid.uuid4()), 123))
                assert "error" in result
                assert "GROQ_API_KEY is not configured" in result["error"]
        finally:
            if original_key:
                os.environ["GROQ_API_KEY"] = original_key


class TestGenerateCoachReport:
    """Tests for the generate_coach_report function."""

    @patch('api.services.coach_service._call_groq', new_callable=AsyncMock)
    @patch('builtins.open', new_callable=PropertyMock)
    @patch('api.services.coach_service.os.path.exists')
    @patch('api.services.coach_service.fetch_user_preferences')
    @patch('api.services.analysis_service.get_comprehensive_report_data')
    def test_generate_report_success(
        self, mock_get_comprehensive, mock_fetch_prefs, 
        mock_exists, mock_open, mock_call_groq
    ):
        """Should generate a report with comprehensive data."""
        import uuid
        mock_exists.return_value = True
        mock_open.return_value.__enter__.return_value.read.return_value = "Eres un entrenador..."
        mock_fetch_prefs.return_value = {
            "athlete_context": "CTL 85, ATL 75",
            "athlete_goal": "Completar una gran fondo"
        }
        mock_get_comprehensive.return_value = {
            "training_load": {"current_ctl": 85},
            "mmp_curve": {"mmp_curve": {}},
            "efficiency_factor": {"dates": []},
            "vo2max_history": {"current": 52.5},
            "volume": {"labels": []},
            "intensity_distribution": {"power": {}},
            "recent_activities": [],
            "sport_breakdown": {"cycling": {"sessions": 3, "tss": 300}},
            "load_balance": {"rest_days_last_28": 5, "weekly_monotony": 1.2},
            "thresholds": {"ftp_current": 300, "lthr": 165, "threshold_pace_ms": 3.5, "weight_kg": 80, "ftp_history": []},
            "recent_activity_analyses": [{"date": "2026-01-01", "sport": "Ride", "analysis": "Buen trabajo"}],
            "compliance": []
        }

        mock_call_groq.return_value = "# Informe semanal...\n<PLAN_UPDATE>[]</PLAN_UPDATE>"

        # Mock the DB connection and cursor
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = [None]  # No calendar_id
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        from api.services.coach_service import generate_coach_report

        result = asyncio.run(generate_coach_report(mock_conn, str(uuid.uuid4())))
        assert "error" not in result
        assert "report" in result


class TestCallGroq:
    """Tests for the _call_groq function and model fallback."""

    def test_call_groq_success(self):
        """Should return content when API returns 200 OK."""
        from api.services.coach_service import _call_groq
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "Respuesta exitosa"}}]
        }

        with patch('api.services.coach_service._get_http_client') as mock_client:
            mock_client.return_value.post = AsyncMock(return_value=mock_resp)
            res = asyncio.run(_call_groq([{"role": "user", "content": "hola"}]))
            assert res == "Respuesta exitosa"

    def test_call_groq_fallback_on_404(self):
        """Should fallback to next model when 404 model_not_found is returned."""
        from api.services.coach_service import _call_groq

        resp_404 = MagicMock()
        resp_404.status_code = 404
        resp_404.text = json.dumps({"error": {"message": "The model does not exist", "code": "model_not_found"}})

        resp_200 = MagicMock()
        resp_200.status_code = 200
        resp_200.json.return_value = {
            "choices": [{"message": {"content": "Respuesta desde fallback"}}]
        }

        with patch('api.services.coach_service._get_http_client') as mock_client:
            mock_client.return_value.post = AsyncMock(side_effect=[resp_404, resp_200])
            res = asyncio.run(_call_groq([{"role": "user", "content": "hola"}]))
            assert res == "Respuesta desde fallback"
