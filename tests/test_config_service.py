from unittest.mock import MagicMock, patch
from api.services.config_service import get_app_config


class TestGetAppConfig:
    def test_get_app_config_found(self):
        """Should return config value when key exists."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = ("test_value",)
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        
        result = get_app_config(mock_conn, "google_service_account_json")
        assert result == "test_value"
        mock_cursor.execute.assert_called_once()

    def test_get_app_config_not_found(self):
        """Should return None when key doesn't exist."""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        
        result = get_app_config(mock_conn, "non_existent_key")
        assert result is None

    def test_get_app_config_exception(self):
        """Should return None on database error."""
        mock_conn = MagicMock()
        mock_conn.cursor.side_effect = Exception("DB Error")
        
        result = get_app_config(mock_conn, "any_key")
        assert result is None
