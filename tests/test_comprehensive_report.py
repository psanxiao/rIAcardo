import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

class TestGetComprehensiveReportData:
    """Tests for the new get_comprehensive_report_data function."""
    
    @patch('api.services.analysis_service.get_training_load')
    @patch('api.services.analysis_service.get_mmp_data')
    @patch('api.services.analysis_service.get_efficiency_factor')
    @patch('api.services.analysis_service.get_vo2max_history')
    @patch('api.services.analysis_service.get_volume_analysis')
    @patch('api.services.analysis_service.get_period_intensity_distribution')
    @patch('api.services.coach_service.get_weekly_tss_comparison')
    def test_success_all_data(
        self, mock_compliance, mock_intensity, mock_volume, 
        mock_vo2, mock_ef, mock_mmp, mock_load
    ):
        """Should return comprehensive data structure."""
        # Setup mocks
        mock_load.return_value = {
            "dates": ["2026-01-01"], "ctl": [85], "atl": [75], 
            "tsb": [10], "current_ctl": 85, "current_atl": 75,
            "current_tsb": 10, "current_vo2max": 52.5,
            "activities": [{"activity_id": 1, "tss": 85, "sport": "Ride"}]
        }
        mock_mmp.return_value = {
            "mmp_curve": {"1min": 320}, "all_time_curve": {"1min": 330},
            "w_prime_kj": 20.5
        }
        mock_ef.return_value = {
            "dates": ["2026-01-01"], "values": [2.1], "trend": [2.1]
        }
        mock_vo2.return_value = {
            "dates": ["2026-01-01"], "values": [52.5], "current": 52.5
        }
        mock_volume.return_value = {
            "labels": ["W1 Jan"], "tss": [500], "hours": [8.5]
        }
        mock_intensity.return_value = {
            "power": {"Z1": {"min": 400, "pct": 60}},
            "hr": {"Z1": {"min": 300, "pct": 55}}
        }
        mock_compliance.return_value = {
            "start_date": "2026-01-01", "end_date": "2026-01-07",
            "planned_tss": 500, "actual_tss": 450, "compliance_pct": 90.0
        }
        
        from api.services.analysis_service import get_comprehensive_report_data
        from api.dependencies.database import get_db_connection
        
        conn = get_db_connection()
        try:
            result = get_comprehensive_report_data(conn, "test-user-id", months=3)
            
            assert "training_load" in result
            assert "mmp_curve" in result
            assert "efficiency_factor" in result
            assert "vo2max_history" in result
            assert "volume" in result
            assert "intensity_distribution" in result
            assert "recent_activities" in result
            assert "compliance" in result
            assert len(result["compliance"]) <= 4  # Last 4 weeks
        finally:
            conn.close()
    
    def test_no_activities(self):
        """Should return data even with no activities."""
        import uuid
        with patch('api.services.analysis_service.get_training_load') as mock_load:
            mock_load.return_value = {
                "dates": [], "ctl": [], "atl": [], "tsb": [],
                "activities": []
            }
            
            from api.services.analysis_service import get_comprehensive_report_data
            from api.dependencies.database import get_db_connection
            
            conn = get_db_connection()
            try:
                result = get_comprehensive_report_data(conn, str(uuid.uuid4()), months=3)
                assert "training_load" in result
                assert result["recent_activities"] == []
            finally:
                conn.close()
