# Queue publication across operating systems

**Owner:** Mert
**Updated:** 7 November 2026, 21:37 America/New_York / 8 November 2026, 02:37 UTC
**Status:** macOS regression checks pass. Native Windows/Linux CI is prepared; its result is pending publication.

## Report and diagnosis

Carter reported 13 Windows `PermissionError` failures across `test_publish.py`, `test_measurement.py` and `test_measurement_runtime.py`, also on baseline `7b50d77`. Mert inspected new remote commit `b1a5edf`; its camera-222 count review does not change the queue/checkpoint writer. No model, tracker, camera acceptance, geometry bytes or media is changed by this fix.

The temporary files already use a closed-file sequence: create securely beside the target, write binary JSON, flush Python buffers, `fsync` the file, close the handle, then replace the target. The failure is the unconditional **parent-directory open/flush after replacement**, in both the queue and checkpoint paths. The Windows CRT reports `EACCES` when its file-open API receives a directory. A controlled macOS fault injection reproduced that failure after a complete queued file had been published; this is a simulation, not a native Windows run. See the [Microsoft CRT error contract](https://learn.microsoft.com/en-us/cpp/c-runtime-library/reference/open-wopen?view=msvc-170).

## Platform-specific publication

- **POSIX:** preserve file `fsync`, closed-file `os.replace`, parent-directory `fsync`, and directory sync after acknowledged removal. Access/flush errors still propagate; they are never interpreted as unsupported Windows behavior.
- **Windows CPython:** retain file flush/`fsync` and closed handles, then call Unicode `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH`. The source stays beside the target, with no cross-volume copy fallback. Do not try to obtain a POSIX directory descriptor through the CRT. Native rename, file flush and access failures propagate.
- **Windows acknowledgements:** after HTTP success, first retire the `.json` name through a write-through move to `.acked`, then remove that marker. A crash or denied unlink leaves an acknowledged payload outside the HTTP queue. Restart removes retained markers before sending later revisions; denied marker cleanup blocks delivery. A denied retirement move keeps the original exact queued bytes for a safe unchanged retry.

The Windows branch uses the same underlying move operation as CPython's replacement implementation, adding the documented write-through flag. [CPython implementation](https://github.com/python/cpython/blob/3.12/Modules/posixmodule.c), [Microsoft move flags](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw).

## Durability and privacy limits

The file-data flush, atomic complete-file replacement and pending-plan-before-enqueue / commit-before-HTTP protocol remain. Existing private `mkstemp` creation and `0700` directory requests remain; no broad chmod, catch-all permission suppression, sleep/retry loop or copy/delete replacement is introduced. Temporary handles are closed before replacement and unlink, and tests enforce that ordering. The POSIX `0600` assertion remains on POSIX; those mode bits do not represent Windows ACLs.

Use a private directory owned by the worker user. Python 3.12.4+ specifically applies a user/administrator access restriction for newly created Windows directories requested with mode `0700`; existing directory ACLs are not rewritten. Temp files and acknowledged markers retain the same private payload and never contain bearer credentials or raw imagery. [Python directory semantics](https://docs.python.org/3.12/library/os.html#os.mkdir), [secure temporary-file semantics](https://docs.python.org/3.12/library/tempfile.html#tempfile.mkstemp).

A write-through request is not a tested power-loss proof for every filesystem/controller or a Windows equivalent of the POSIX parent-directory flush. Microsoft states its explicit flush guarantee for copy/delete moves; this writer prohibits that fallback and requests write-through for same-volume replacement. Native tests verify normal filesystem operations, injected failures and process-level restart recovery. They do not simulate physical power loss, prove storage-controller behavior, validate network shares, or certify the Node server's POSIX snapshot store on Windows. [Microsoft durability contract](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw), [Python file fsync](https://docs.python.org/3.12/library/os.html#os.fsync).

## Verification

On macOS ARM64 with Python 3.12, the four queue/measurement files pass **53 tests plus 15 subtests**; the broader publish/runtime/aggregation/timing selection passes **87 tests plus 20 subtests**. Seven new portability regressions cover Windows-style directory denial while retaining file flush, closed complete-file publication, unchanged POSIX errors, denied file flush, old-checkpoint preservation before enqueue, denied acknowledgement retirement, marker cleanup/restart, and native error propagation. Existing tests retain exact retry bytes, FIFO revision ordering, bounded storage, real loopback HTTP, private payload boundaries, partial plan recovery and actual TypeScript conformance.

The read-only [queue portability workflow](../.github/workflows/queue-portability.yml) runs the focused four files on Windows and Linux with Python 3.12, pytest/PyYAML and only the contract/backend Node test dependencies. It downloads no detector, media or GPU runtime and requires no service credentials. A preflight requires the TypeScript parser runtime so conformance cannot silently skip. Native results will be recorded here once the published run finishes.
