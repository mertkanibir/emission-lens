# Application licence and source links

**Owner:** Mert  
**Updated:** 8 November 2026, 00:40 America/New_York / 8 November 2026, 05:40 UTC

The shared footer exposes **Licence · AGPL-3.0** and **Source repository**. The existing How it works menu adds the project-code **AGPL-3.0-only**, no-warranty and upstream-terms note, plus links to the published project notice and source-availability instructions. Read the full [licence](../LICENSE), [notice](../NOTICE) and [source guidance](../release/SOURCE-AVAILABILITY.md). These links do not claim completion of every third-party, model, binary or corresponding-source obligation.

## Exact web-build handoff

The server-side optional `EMISSION_LENS_WEB_SOURCE_REVISION` setting accepts a full 40-character hexadecimal source commit. A valid setting changes the link to `https://github.com/mertkanibir/emission-lens/tree/<revision>` and its label to **Source for this build**. Missing, abbreviated, malformed or branch-name values retain **Source repository**. No current Git checkout, latest branch, GPU/worker metadata or historical application revision is inferred.

The build/application owner must verify the supplied commit against the **same frozen web-application source** and its build/launch receipt before setting it. Shape validation is not source attestation. Publish the source and required non-secret build materials, retain the private receipt/archive hash, and verify the rendered exact URL after a coordinated application launch. Leave the setting absent when that correspondence is unknown; a repository fallback does not certify exact-version source availability. A separate worker can have a different source revision.

This checkpoint does not configure this setting or restart production 3138, isolated integration 3139, or GPU job 176075. A future compatible build freeze/launch is owned by Mert's integration stream. Known older 3138/3139 revisions were not inserted into the modified acceptance build.

## Verification

The private 3142 copy passes all **47 frontend tests**, nonincremental frontend TypeScript and its production build. Three new tests cover absent-receipt wording, full immutable revisions/case normalization, and branch/short/path/arbitrary/whitespace input rejection. Browser checks verify default repository wording, both footer destinations, visible keyboard focus, the no-warranty/source-notice help content and Escape dismissal. At 354 × 790 the help panel lies at x=38–338 within the 354 px viewport and y=62–526; the footer stacks using the existing design. Published licence, notice and source-guidance files were independently resolved through the repository API after their licensing checkpoint.

No new client bundle, request, data contract, scientific input, availability policy, CSS or measurement-scope copy is introduced. The React component review retains event-driven clipboard work, derives updated-draft feedback during rendering, keeps the environment read server-side and uses semantic navigation/links with the existing focus styling. Exact running-version link installation remains an integration acceptance item.
