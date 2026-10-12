-- One-time fix: running cadence was stored per leg (half of the real strides
-- per minute). This doubles cadence for running activities only.
--
-- Idempotent: guarded by an app_config flag, so running it twice is a no-op.
-- Cycling cadence is intentionally left untouched (stored as rpm).

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.app_config WHERE config_key = 'running_cadence_fixed_v1'
    ) THEN
        UPDATE public.records r
        SET cadence = r.cadence * 2
        FROM public.activities a
        WHERE r.activity_id = a.activity_id
          AND r.cadence IS NOT NULL
          AND r.cadence > 0
          AND (
              lower(a.sport) LIKE '%run%'
              OR lower(a.sport) LIKE '%trail%'
              OR lower(a.sport) LIKE '%carrera%'
          );

        INSERT INTO public.app_config (config_key, config_value)
        VALUES ('running_cadence_fixed_v1', NOW()::text);
    END IF;
END $$;
