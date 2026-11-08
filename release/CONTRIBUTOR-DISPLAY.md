# Contributor display refresh

**Owner:** Mert
**Updated:** 8 November 2026, 02:45 America/New_York / 07:45 UTC
**Status:** Requested default-branch rename/restore completed; visible contributor list contains Mert and Carter only. The numeric contributor badge still displays 4 and remains a GitHub-side cache discrepancy.

Mert explicitly authorized the previously held branch operation after the local application deployment checkpoint. The authenticated repository-admin account was Mert's accepted GitHub account. The operation used GitHub's branch rename API, verified the temporary default/ref, allowed over 60 seconds for processing, then restored `main`. The same commit `d2ff1738d03a477f017e1a8fc14786c6e7919d74` was present before and after the round trip. No existing commit was rewritten and no force push, visibility change, collaborator change or history replacement occurred.

## Verified result

- Remote default branch is `main`; its actual Git ref points to the captured pre-operation SHA. The temporary ref is absent.
- Local branch/upstream remain `main` → `origin/main`; `origin/HEAD` points to `main`.
- Existing branch-protection/ruleset state is unchanged. The preflight found no open PRs, draft releases, Pages deployment or webhooks requiring retargeting; workflows have no branch-specific trigger or checkout dependency.
- The contributor API names only Mert and Carter. The loaded authenticated repository sidebar also lists only their two profiles, after reload and direct visual inspection. The two unwanted cached profiles are absent.
- The sidebar's numeric badge still says 4 despite those two visible profiles. This remaining counter discrepancy is recorded rather than reported as a complete refresh of every GitHub cache. No repeated rename, support message or polling schedule was created to pursue it.
- Running application source 685dc72, live workers, private registries/media/evidence and existing services were not changed or restarted by this operation.

Private before/after repo/ref/API snapshots, the operation receipt and browser screenshot are retained outside source control. Public source history and existing scientific evidence remain intact.

## References

[GitHub branch rename API](https://docs.github.com/en/rest/branches/branches#rename-a-branch) documents background processing; [rename behavior](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch) describes retargeting and local tracking. GitHub's [published contributor troubleshooting discussion](https://github.com/orgs/community/discussions/209302) links the rename-and-restore workaround. A successful rename is distinct from proof that every contributor cache has updated.
