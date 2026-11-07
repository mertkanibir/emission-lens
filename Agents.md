# Agents.md — Emission Lens

Guidance for coding agents and teammates working in this repository.

**Authority:** [Plan.md](./Plan.md) is the master plan. This file summarizes work-package boundaries and agent rules. If anything conflicts, follow `Plan.md` and propose an update before changing scope.

**Coordination:** Mert coordinates project decisions, data/product/dashboard work, and implementation agents. Carter’s proposed ownership is vision and emissions unless the team changes that.

**Last updated:** 7 November 2026, 14:28 America/New_York (19:28 UTC). Added every-turn logging, teammate attribution, and push rules.

---

## Every turn

Do these three things on every turn that changes the repository, before the turn ends.

### 1. Timestamp the work

Update the markdown that this turn actually changed, and append one entry to [Worklog.md](./Worklog.md).

Each entry must include:

- Local time in America/New_York and the matching UTC time.
- Who: **Mert** or **Carter**.
- What was done.
- What is now completed.
- What is still open.

If `Plan.md`, this file, `README.md`, or a package document changed status or instructions, put a short dated note in that file as well. Do not leave the running record only in chat.

### 2. Speak as Mert and Carter

Repository files, commit messages, pull requests, dashboard copy, briefs, and messages to teammates name **Mert** and **Carter** only.

Do not name the coding tool or model. That includes Codex, Claude, Cursor, GPT, Gemini, and similar product names. Do not sign work as an assistant, bot, or tool. When a note needs an author, use Mert or Carter, matching who directed or owns that work. Mert coordinates implementation. Carter owns the proposed vision and emissions work unless the team changes that.

### 3. Push when nothing looks broken

If the turn changed tracked files, commit and push to the current remote branch before ending the turn.

Push when the change is coherent and nothing you ran looks broken. Hold the push when a check you ran failed, the app or worker no longer starts, the change would commit a secret, or the tree is left in a state you know is unsafe to share. Say that clearly in `Worklog.md`.

Do not force-push unless Mert or Carter explicitly asks. Do not skip a push because the change feels small.

---

## Before you start

1. Read `Plan.md` and any current contracts under `contracts/`.
2. Confirm which work package you own.
3. Identify dependencies and blockers early.
4. Propose contract changes **before** implementing incompatible ones.
5. Never put passwords, tokens, scratch codes, or personal credentials in source control, logs, or shared prompts.
6. Do not claim measured accuracy, latency, savings, or environmental impact until tested.

---

## Suggested repository layout

```text
Plan.md
Agents.md
Worklog.md
contracts/
config/cameras/
worker/
emissions/
backend/
frontend/
infra/
tests/
evaluation/
```

Stay inside your assigned directories unless coordination explicitly expands scope.

---

## Work packages

| Work package | Paths (typical) | Ownership | Acceptance |
|---|---|---|---|
| Contracts / backend | `contracts/`, `backend/` | Schema, migrations, APIs, access policies | Fixtures and real writes use the same validated contract |
| Vision | `worker/`, `config/cameras/` | Ingestion, GPU detector, tracking, calibration, metrics | No frame-count inflation; reconnect and four-camera isolation work |
| Emissions | `emissions/` | Factor table, mappings, units, uncertainty, scenarios | No ordinary-idle double-counting; calculations reproducible |
| Frontend | `frontend/` | Map, details, timeline, simulator, review | Handles null, stale, replay, and degraded states |
| Assistant | Assistant tools / brief generation (backend + frontend as agreed) | Evidence queries, brief generation | Numbers trace to records; no invented claims or sending tools |
| Integration / evaluation | `tests/`, `evaluation/`, `infra/` | Complete flow, benchmarks, demo | Live GPU-to-dashboard path demonstrated and limitations recorded |

Agent messages are **proposals**, not automatic changes to project scope. Avoid broad rewrites of another work package.

---

## Hard product rules (do not “helpfully” violate)

### Scientific framing

- Label outputs **estimated emissions**, never measured AQI or pollutant concentration.
- EMFAC running-exhaust factors already include ordinary driving-cycle idling. Do **not** add the separate idle process to every stopped car (double-counting).
- For queues with no completed calibrated traversals: report insufficient evidence or a separately documented estimate — **never silently substitute zero**.
- Scenario ranges are not statistical confidence intervals unless independently justified.

### Vision and cameras

- Independent state per camera; do not track identities between cameras.
- Count line crossings, not detections per frame.
- Do not report a camera as live merely because its last frame remains visible.
- Invalid calibration: retain counts / image-based queue observations; suppress unsupported speeds and distance-based emissions.
- Call the observation **stopped time**. Video generally cannot establish whether an engine is running.

### Privacy and demo media

- No plate recognition, facial identification, or person tracking.
- Temporary vehicle IDs only, scoped to a camera session.
- No raw footage committed to this public repository.
- Replay must be visibly labeled and pass through the same processing pipeline.
- External communication: drafts and exports only; **no automatic messages or government contact**.

### Data contract

- Contract version starts at `1.0` (see `Plan.md` §14).
- Timestamps stored in UTC; display local time explicitly.
- `null` means unavailable; zero means a supported zero.
- Separate `live`, `replay`, and `synthetic` modes; do not mix replay into live totals.
- Keep service credentials server-side.

---

## Reporting after a change

The every-turn rules above are mandatory. In addition, every completion report should include:

1. What changed (paths and intent).
2. Verification performed (commands, fixtures, manual checks).
3. Remaining limitations and blockers.
4. Any proposed contract or scope changes (not silently applied).

---

## Immediate unresolved items (from Plan.md)

1. Obtain usable CARB factors and confirm class/process mappings.
2. Verify Empire AI environment, networking, and sustained inference.
3. Choose relay transport if required.
4. Configure and validate each camera’s road region and gates.
5. Finalize schemas and service ownership.
6. Benchmark four-camera performance.
7. Select the minimum contextual layer that adds demonstrated value.

---

## Build-order reminder

Prefer: one camera end-to-end → calibration/queues/factors → four cameras + status → emissions timeline/uncertainty → scenarios + brief → evaluation/replay → feature freeze.

Do not make late fine-tuning the critical path. Keep the working pretrained model unless a replacement demonstrably improves held-out results.
