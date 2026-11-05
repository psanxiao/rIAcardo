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


class TestCoachHelpersAndPayload:
    """Tests for coach persona loading, zone compaction, and non-redundant activity payload."""

    def test_compact_zones_drops_empty(self):
        from api.services.coach_service import _compact_zones
        zones = {
            "Z1": {"min": 12.5, "pct": 25.0},
            "Z2": {"min": 37.5, "pct": 75.0},
            "Z3": {"min": 0, "pct": 0},
            "Z4": {"min": 0.0, "pct": 0.0},
        }
        compacted = _compact_zones(zones)
        assert list(compacted.keys()) == ["Z1", "Z2"]
        assert _compact_zones({"Z1": {"min": 0, "pct": 0}}) is None

    def test_load_coach_persona_reads_file(self):
        from api.services.coach_service import _load_coach_persona
        persona = _load_coach_persona()
        assert "rIAcardo" in persona
        assert "Habla como un entrenador en la vida real" in persona

    @patch('api.services.coach_service._call_groq', new_callable=AsyncMock)
    @patch('api.services.coach_service.fetch_user_preferences')
    @patch('api.services.coach_service.get_activity_detail')
    @patch('api.services.coach_service.get_training_load')
    def test_running_payload_prunes_duplicates_and_includes_plan(
        self, mock_get_load, mock_get_detail, mock_fetch_prefs, mock_call_groq
    ):
        from api.services.coach_service import analyze_single_activity
        import uuid

        mock_get_detail.return_value = {
            "activity": {
                "activity_id": 456,
                "name": "Rodaje Z2",
                "start_time": "2026-11-05 08:00:00",
                "sport": "running",
                "duration_sec": 3000,
                "moving_time": 3000,
                "distance_km": 10.0,
                "avg_speed_ms": 3.3333,
                "avg_hr": 145,
                "max_hr": 160,
                "avg_cadence": 174,
                "tss": 62,
                "if": 0.82,
                "ascent_m": 80,
            },
            "records": [],
            "time_in_hr_zones": {"Z1": {"min": 5, "pct": 10}, "Z2": {"min": 45, "pct": 90}, "Z3": {"min": 0, "pct": 0}},
            "hr_zone_ranges": {"Z1": [0, 135], "Z2": [136, 152]},
            "cardiac_drift_pct": 2.4,
            "enriched_context": {
                "temperature_avg_c": 16,
                "run_cadence_spm": 174,
                "stride_length_m": 1.15,
                "steps": 8700,
                "device_lthr": 168,
            },
            "laps": [
                {"number": 1, "duration_min": 25.0, "distance_km": 5.0, "avg_speed": 12.0, "avg_hr": 143},
                {"number": 2, "duration_min": 25.0, "distance_km": 5.0, "avg_speed": 12.0, "avg_hr": 147},
            ],
        }
        mock_get_load.return_value = {"current_ctl": 55, "current_atl": 60, "current_tsb": -5}
        mock_fetch_prefs.return_value = {
            "lthr": 168,
            "threshold_pace": 4.0,  # 4 m/s -> 4:10/km
            "athlete_context": "Disponibilidad lunes a viernes...",
            "athlete_goal": "Sub 40 en 10K",
        }
        mock_call_groq.return_value = "**Rodaje aeróbico bien controlado.**\n- Clave 1\n**Próxima sesión:** Descanso."

        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = ("Rodaje suave 50m", "Mantener Z2", "run", 50, 55)
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor

        res = asyncio.run(analyze_single_activity(mock_conn, str(uuid.uuid4()), 456))
        assert res["status"] == "ok"

        sent_messages = mock_call_groq.call_args.kwargs["messages"]
        user_prompt = sent_messages[1]["content"]
        json_part = user_prompt.split("DATOS DE LA ACTIVIDAD (JSON):\n")[1]
        payload = json.loads(json_part)

        # Planned workout is included
        assert payload["planned_workout"]["title"] == "Rodaje suave 50m"
        # No duplicate keys
        assert "zone_ranges" not in payload
        assert "cardiac_drift_pct" not in payload  # only inside summary_stats
        assert payload["summary_stats"]["cardiac_drift_pct"] == 2.4
        assert "avg_pace_sec_per_km" not in payload["summary_stats"]
        assert "moving_time_min" not in payload["summary_stats"]  # equal to duration_min
        assert "run_cadence_spm" not in payload.get("enriched_context", {})
        assert "device_lthr" not in payload.get("enriched_context", {})
        assert payload["enriched_context"]["temperature_avg_c"] == 16
        # Laps have avg_pace for running instead of avg_speed_kmh
        assert payload["laps"][0]["avg_pace"] == "5:00"
        assert "avg_speed_kmh" not in payload["laps"][0]
        # Empty Z3 zone dropped
        assert "Z3" not in payload["zone_distribution"]["hr"]
        # Weekly availability bio omitted from single activity context
        assert "athlete_profile" not in payload["athlete_context"]
        assert payload["athlete_context"]["threshold_pace"] == "4:10"
