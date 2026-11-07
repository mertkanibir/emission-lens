-- Draft access policy. Not applied.
-- Service credentials stay on the server. This repository does not contain them.
-- Anonymous clients can read enabled camera metadata only.
-- Writes, worker rows, and briefs stay closed until a reviewed role exists.

alter table cameras enable row level security;
alter table camera_calibrations enable row level security;
alter table worker_runs enable row level security;
alter table camera_status enable row level security;
alter table traffic_minutes enable row level security;
alter table emissions_minutes enable row level security;
alter table context_snapshots enable row level security;
alter table scenario_results enable row level security;
alter table reviews enable row level security;
alter table briefs enable row level security;

create policy cameras_public_read on cameras
  for select
  using (enabled);

-- No insert, update, or delete policies are defined for the public role.
-- Absence of a policy denies those operations when row level security is on.
