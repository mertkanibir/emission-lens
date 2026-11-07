-- Contract 1.0 draft for a future Postgres store.
-- Not applied to a hosted database. Do not treat this file as a completed migration.

create table cameras (
  id text primary key,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  stream_url text not null,
  road_region jsonb,
  enabled boolean not null
);

create table camera_calibrations (
  camera_id text not null references cameras (id),
  version text not null,
  gates jsonb,
  reference_measurements jsonb,
  transform jsonb,
  validation_status text not null check (validation_status in ('valid', 'invalid', 'missing')),
  primary key (camera_id, version)
);

create table worker_runs (
  run_id text primary key,
  model_version text,
  device text,
  started_at timestamptz,
  ended_at timestamptz,
  mode text not null check (mode in ('live', 'replay', 'synthetic'))
);

create table camera_status (
  camera_id text not null references cameras (id),
  mode text not null check (mode in ('live', 'replay', 'synthetic')),
  heartbeat_at timestamptz,
  last_source_timestamp timestamptz,
  processing_delay_ms integer,
  fps double precision,
  state text not null check (state in ('live', 'degraded', 'offline')),
  primary key (camera_id, mode)
);

create table traffic_minutes (
  camera_id text not null references cameras (id),
  minute timestamptz not null,
  run_id text references worker_runs (run_id),
  vehicle_class text not null check (vehicle_class in ('car', 'truck', 'bus', 'motorcycle', 'unknown')),
  mode text not null check (mode in ('live', 'replay', 'synthetic')),
  count integer,
  completed_traversals integer,
  stopped_vehicle_seconds double precision,
  traversal_time_s double precision,
  distance_m double precision,
  queue_count integer,
  queue_length_m double precision,
  coverage double precision,
  primary key (camera_id, minute, vehicle_class, mode),
  check (count is null or count >= 0),
  check (completed_traversals is null or completed_traversals >= 0),
  check (stopped_vehicle_seconds is null or stopped_vehicle_seconds >= 0),
  check (traversal_time_s is null or traversal_time_s >= 0),
  check (distance_m is null or distance_m >= 0),
  check (queue_count is null or queue_count >= 0),
  check (queue_length_m is null or queue_length_m >= 0),
  check (coverage is null or (coverage >= 0 and coverage <= 1))
);

create table emissions_minutes (
  camera_id text not null references cameras (id),
  minute timestamptz not null,
  pollutant text not null check (pollutant in ('co2', 'nox')),
  mode text not null check (mode in ('live', 'replay', 'synthetic')),
  estimate_g double precision,
  range_low_g double precision,
  range_high_g double precision,
  factor_version text,
  method_version text,
  quality_state text not null check (
    quality_state in ('ok', 'insufficient_evidence', 'unavailable', 'calibration_invalid')
  ),
  primary key (camera_id, minute, pollutant, mode),
  check (
    quality_state not in ('unavailable', 'insufficient_evidence', 'calibration_invalid')
    or (estimate_g is null and range_low_g is null and range_high_g is null)
  ),
  check (quality_state <> 'ok' or estimate_g is not null)
);

create table context_snapshots (
  id bigint generated always as identity primary key,
  camera_id text references cameras (id),
  region text,
  source text not null,
  retrieved_at timestamptz,
  applicable_at timestamptz,
  mode text not null check (mode in ('live', 'replay', 'synthetic')),
  values jsonb
);

create table scenario_results (
  id bigint generated always as identity primary key,
  camera_id text not null references cameras (id),
  mode text not null check (mode in ('live', 'replay', 'synthetic')),
  window_start timestamptz,
  window_end timestamptz,
  assumptions jsonb not null,
  baseline jsonb not null,
  scenario jsonb not null,
  limitations jsonb not null,
  contract_version text not null
);

create table reviews (
  id bigint generated always as identity primary key,
  evidence_reference text not null,
  issue text not null,
  correction text,
  status text not null check (status in ('open', 'accepted', 'rejected')),
  recorded_at timestamptz not null
);

create table briefs (
  id bigint generated always as identity primary key,
  camera_id text references cameras (id),
  mode text not null check (mode in ('live', 'replay', 'synthetic')),
  evidence_references jsonb not null,
  body text not null,
  model text,
  review_status text not null
);
