-- rIAcardo 3.0 Database Schema
-- Complete schema for PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    
    -- Garmin Connect integration
    garmin_email VARCHAR(255),
    garmin_password TEXT,  -- encrypted
    garmin_connected BOOLEAN DEFAULT FALSE,
    
    -- Google Calendar integration
    google_calendar_id VARCHAR(255),
    
    -- Sync status
    sync_status VARCHAR(50) DEFAULT 'IDLE',  -- IDLE, SYNCING, RATE_LIMITED, ERROR
    sync_error TEXT,
    history_synced BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ACTIVITIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.activities (
    activity_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    
    -- Activity source identifiers
    garmin_activity_id VARCHAR(255),
    
    -- Basic info
    filename VARCHAR(255),
    file_type VARCHAR(50),
    manufacturer VARCHAR(255),
    product_name VARCHAR(255),
    serial_number VARCHAR(255),
    
    -- Timing
    time_created TIMESTAMP WITH TIME ZONE,
    start_time TIMESTAMP WITH TIME ZONE,
    start_date_local TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50),
    total_elapsed_time DOUBLE PRECISION,
    moving_time DOUBLE PRECISION,
    
    -- Sport
    sport VARCHAR(50),
    sub_sport VARCHAR(50),
    
    -- Metrics
    total_distance DOUBLE PRECISION,
    total_calories DOUBLE PRECISION,
    avg_speed DOUBLE PRECISION,
    max_speed DOUBLE PRECISION,
    avg_heart_rate DOUBLE PRECISION,
    max_heart_rate DOUBLE PRECISION,
    total_ascent DOUBLE PRECISION,
    total_descent DOUBLE PRECISION,
    
    -- Raw data
    session_data JSONB,
    
    -- AI and analysis
    coach_analysis TEXT,
    detected_metrics JSONB,
    mmp_data JSONB,
    ignore_mmp BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_garmin_id ON public.activities(garmin_activity_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_time ON public.activities(start_time);

-- ============================================================================
-- RECORDS TABLE (performance streams)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.records (
    record_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL REFERENCES public.activities(activity_id) ON DELETE CASCADE,
    
    -- Timing
    time INTEGER,  -- seconds from start
    timestamp TIMESTAMP WITH TIME ZONE,
    
    -- Metrics
    heart_rate INTEGER,
    cadence INTEGER,
    distance DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    watts INTEGER,
    power INTEGER,
    position_lat DOUBLE PRECISION,
    position_lng DOUBLE PRECISION
);

-- Unique index to prevent duplicate records for the same second in an activity
CREATE UNIQUE INDEX IF NOT EXISTS records_act_ts_idx ON public.records (activity_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON public.records(user_id);

-- ============================================================================
-- LAPS TABLE (per-lap splits of an activity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.laps (
    lap_id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL REFERENCES public.activities(activity_id) ON DELETE CASCADE,

    lap_number INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE,
    start_time TIMESTAMP WITH TIME ZONE,
    total_elapsed_time DOUBLE PRECISION,
    total_distance DOUBLE PRECISION,
    avg_speed DOUBLE PRECISION,
    max_speed DOUBLE PRECISION,
    avg_heart_rate DOUBLE PRECISION,
    max_heart_rate DOUBLE PRECISION,
    lap_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_laps_activity_id ON public.laps(activity_id);
CREATE INDEX IF NOT EXISTS idx_laps_user_id ON public.laps(user_id);

-- ============================================================================
-- USER PREFERENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    preference_key VARCHAR(255) NOT NULL,
    preference_value TEXT NOT NULL,
    UNIQUE (user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- ============================================================================
-- FTP HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ftp_history (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    ftp_value DOUBLE PRECISION NOT NULL,
    start_date DATE NOT NULL,
    UNIQUE (user_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_ftp_history_user_id ON public.ftp_history(user_id);

-- ============================================================================
-- APP CONFIG TABLE (global settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- COACH REPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.coach_reports (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    report_markdown TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_reports_user_id ON public.coach_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_reports_created_at ON public.coach_reports(created_at DESC);

-- ============================================================================
-- PLANNED WORKOUTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.planned_workouts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    title VARCHAR(255),
    description TEXT,
    workout_type VARCHAR(50),  -- ride, run, strength, rest
    duration_min INTEGER,
    tss_planned DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planned_workouts_user_id ON public.planned_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_planned_workouts_date ON public.planned_workouts(date);

-- ============================================================================
-- INITIAL DATA
-- ============================================================================
-- Insert default app config if needed
-- INSERT INTO public.app_config (config_key, config_value) VALUES ('example_key', 'example_value');
