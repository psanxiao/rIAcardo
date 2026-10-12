from unittest.mock import MagicMock, patch

from api.services.sync_service import _is_running_sport, _normalize_cadence


class TestCadenceNormalization:
    def test_is_running_sport(self):
        assert _is_running_sport("running") is True
        assert _is_running_sport("Run") is True
        assert _is_running_sport("trail_running") is True
        assert _is_running_sport("carrera") is True
        assert _is_running_sport("ride") is False
        assert _is_running_sport(None) is False

    def test_running_cadence_is_doubled(self):
        assert _normalize_cadence("running", 82) == 164
        assert _normalize_cadence("Run", 80) == 160

    def test_cycling_cadence_unchanged(self):
        assert _normalize_cadence("ride", 85) == 85
        assert _normalize_cadence("virtualride", 90) == 90

    def test_none_cadence(self):
        assert _normalize_cadence("running", None) is None


class TestInsertRecordsFromDetailCadence:
    def _detail(self):
        return {
            "metricDescriptors": [
                {"key": "directTimestamp", "metricsIndex": 0},
                {"key": "directRunCadence", "metricsIndex": 1},
            ],
            "activityDetailMetrics": [
                {"metrics": [1700000000000, 82]},
                {"metrics": [1700000001000, 84]},
            ],
        }

    @patch('api.services.sync_service._get_activity_sport', return_value='running')
    def test_running_records_doubled(self, mock_sport):
        from api.services.sync_service import insert_records_from_detail

        cursor = MagicMock()
        conn = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cursor

        insert_records_from_detail(conn, "user", 1, self._detail())

        assert cursor.executemany.called
        rows = cursor.executemany.call_args[0][1]
        cadences = [r[5] for r in rows]
        assert cadences == [164, 168]

    @patch('api.services.sync_service._get_activity_sport', return_value='ride')
    def test_cycling_records_unchanged(self, mock_sport):
        from api.services.sync_service import insert_records_from_detail

        cursor = MagicMock()
        conn = MagicMock()
        conn.cursor.return_value.__enter__.return_value = cursor

        insert_records_from_detail(conn, "user", 1, self._detail())

        rows = cursor.executemany.call_args[0][1]
        cadences = [r[5] for r in rows]
        assert cadences == [82, 84]
