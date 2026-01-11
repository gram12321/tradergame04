-- ============================================
-- Monitor Automatic Tick System
-- ============================================

-- 1. Check current tick count
SELECT 'Current Game State' as info, tick_count, updated_at 
FROM game_state 
WHERE id = 'global';

-- 2. View scheduled jobs
SELECT 'Scheduled Jobs' as info, jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobid;

-- 3. Recent execution history
SELECT 
  'Recent Executions' as info,
  j.jobname,
  d.start_time,
  d.status,
  LEFT(d.return_message, 100) as message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
ORDER BY d.start_time DESC
LIMIT 10;

-- ============================================
-- Management Commands
-- ============================================

-- Remove test job (run after confirming it works):
-- SELECT cron.unschedule('game-tick-test');

-- Create hourly production job:
-- SELECT cron.schedule(
--   'game-tick-hourly',
--   '0 * * * *',
--   $$ SELECT public.http_post('https://mjeduinijotdaxshkarf.supabase.co/functions/v1/game-tick', '{}'::jsonb); $$
-- );
