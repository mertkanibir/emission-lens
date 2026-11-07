# Backend

**Owner:** Mert  
**Updated:** 7 November 2026, 14:40 America/New_York (19:40 UTC)

Read path for camera status, traffic windows, estimated emissions, scenarios, investigation priorities, and draft briefs. The store is the fixture set in `@emission-lens/contracts`. `db/` is a Postgres draft and has not been applied.

Live and replay windows are empty on purpose. The synthetic minute is labeled and is excluded from live totals. Emissions estimates stay null until Carter’s factor table is loaded. Invalid or missing calibration suppresses speed.

The assistant tools are `get_camera_status`, `get_traffic_window`, `get_emissions_window`, `get_context`, `compare_scenario`, `rank_investigation_priorities`, and `draft_brief`. There is no send tool.

Run the checks with `npm test` from the repository root after install.
