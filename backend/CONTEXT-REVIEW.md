# Context, evidence review and scoped briefs

**Owner:** Mert  
**Interface decision:** 8 November 2026, 03:27 America/New_York / 08:27 UTC  
**Status:** Additive version 1.0 interfaces agreed for implementation. Core worker 1.1 and measurement 1.0 remain unchanged.

**Review implementation checkpoint (8 November 2026, 03:35 America/New_York / 08:35 UTC):** Durable annotation-only storage, bounded public reads, local signed-session/CSRF handlers and thin routes are implemented. Three focused audit/target/corruption/authentication checks and backend type checking pass. The safe `retained_measurement_minutes` navigation index exposes complete retained minutes within 24 hours and current support, allowing an explicit dated selection after the producer stops. It never substitutes older data into the reporting hour. Review UI, external context, enriched/scoped brief and browser acceptance remain in progress.

## Review 1.0

`GET /api/reviews?camera=222&mode=live&from=UTC&to=UTC` returns `{review_version:'1.0',camera_id,mode,from,to,items,events,write_available}`. Paired optional boundaries use the measurement reader's strict complete-minute selection; the default is its reporting hour. Items identify an opaque review UUID, camera/mode, safe aggregate target `{kind:'measurement'|'traffic',reference,minute}`, issue (`classification`, `camera_view`, `coverage`, `timing`, `other`), note, state (`open`, `investigating`, `resolved`), author (`Mert` or `Carter`) and UTC timestamps. Measurement targets retain a safe source-batch aggregate reference plus the original derivation reference; traffic targets retain camera/mode/minute only. No traversal/session identity or private path is public.

`POST /api/reviews` accepts either `{action:'create',camera_id,mode,target,issue,note,author}` or `{action:'update',review_id,state,note,author}`. Every successful action appends a UUID/UTC audit event to a separately configured private atomic file (`EMISSION_LENS_REVIEW_PATH`). Original observations, prior notes and events remain intact; resolving a review grants no scientific approval and rewrites no measurement, factor, geometry or numeric value. Unknown or out-of-window targets cannot create reviews. Existing annotations survive later derivation replacement/retraction; their original reference and timestamp remain visible.

Browser writes require explicit `EMISSION_LENS_REVIEW_WRITE_ENABLED=1`, a private random `EMISSION_LENS_REVIEW_SESSION_SECRET` of at least 32 characters, and a loopback application origin. A same-origin `POST /api/reviews/session` with same-origin Fetch Metadata grants an eight-hour signed HttpOnly SameSite=Strict session cookie plus a session-bound CSRF token. Writes require that cookie, token, exact Origin and same-origin Fetch Metadata. This authenticates the opted-in local browser operator, not a remote/public user account; hosted editing stays disabled until real user authentication exists. The worker token is never read or exposed. Request sizes/fields/notes, event count and file size are bounded; corruption fails closed.

## Context 1.0

`GET /api/context?camera=222&mode=live&from=UTC&to=UTC` returns `{context_version:'1.0',camera_id,mode,from,to,weather,limitations}`. Weather includes `state:'available'|'stale'|'unavailable'`, source/data/documentation links, `retrieved_at`, `applicable_at`, values and units. Open-Meteo's keyless Forecast API supplies hourly temperature, relative humidity and wind for the selected Torrance coordinate, UTC and a bounded recent history. A server cache (optional private `EMISSION_LENS_CONTEXT_CACHE_PATH`) deduplicates requests; network timeouts and stale cached results remain explicit. The selected hour must overlap the requested interval; synthetic mode never receives current weather. Replay time uses its estimated playback source clock, not verified original capture time. Weather is model context, not a sensor reading, dispersion model or emissions input. Stored 70°F/60% RH assumptions remain unchanged. No school/exposure claim is invented when an authoritative layer is not connected.

Source: [Open-Meteo Forecast API](https://open-meteo.com/en/docs). Its hourly values and current model-data distinction were checked before implementation.

## Scoped brief 1.0

`draft_brief` gains paired optional `from`/`to`, validated by `read_measurement_window` with unchanged ≤60-minute, complete-minute, last-24-hour and exclusive-end rules. Explicit drafts use only that selected cohort/traffic interval, include missing-minute/null limitations and never borrow reporting-hour totals. Default-hour drafts retain their current behavior. A separate enriched draft adds timestamped weather/context and review annotations for exactly that scope, factor version/process/units, retained fleet/calibration/meteorology assumptions and evidence references. Export returns the exact displayed text. No external sending, approval or observed-value rewrite occurs.

## Acceptance

Meaningful focused checks cover reload/audit immutability, invalid targets and write denial, cookie/CSRF/origin expiry, malformed/corrupt files, camera/mode scope, weather selection/cache/failure, explicit brief boundaries/nulls and exact export. Isolated application/browser verification follows implementation; this interface record is not a completion claim.
