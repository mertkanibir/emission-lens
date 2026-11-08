# Isolated local preview consumer

**Owner:** Mert
**Updated:** 8 November 2026, 03:27 America/New_York / 8 November 2026, 08:27 UTC

A separately built dashboard may read the existing authoritative worker store without replacing its healthy producer application. Set server-only `EMISSION_LENS_PREVIEW_ORIGIN=http://127.0.0.1:<producer-port>` to read the same producer's ephemeral processed previews. Leave it unset for the original in-process preview handler.

The adapter permits only a fixed HTTP loopback origin, rejects credentials/path/query/self-proxy configuration, follows no redirect, forwards no request credentials and projects only the existing public preview fields. Reads are bounded to 2.5 seconds and 1.5 MB. Camera/mode and 60-second freshness must match; upstream absence, timeout, stale imagery or invalid data stays unavailable. It never writes frames or changes processing state. This adds deployment configuration only; core 1.1 and measurement 1.0 are unchanged.

The consumer still requires the same private authoritative store and matching registry. Preview availability depends on the original producer process; sharing a disk store does not share in-memory frames. A later producer shutdown leaves honest unavailable previews and retained dated evidence. No public hosting or cross-host transport is implied.

Verification: focused preview test covers disabled mode, fixed replay target, no credential forwarding, safe field projection, mode mismatch, stale rejection and forbidden origins; frontend TypeScript passes. Actual two-process/browser verification belongs to the candidate acceptance.
