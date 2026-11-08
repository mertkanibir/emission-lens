# Licence decision for Mert and Carter

**Owner:** Mert
**Updated:** 8 November 2026, 00:36 America/New_York / 05:36 UTC
**Decision:** **A accepted.** Mert explicitly approved the AGPL-3.0 open-source route for covered project code. The first-party covered source is now licensed **AGPL-3.0-only** through [LICENSE](../LICENSE) and [NOTICE](../NOTICE). No purchase, vendor contact or runtime change is authorized by this decision.

The project-code licensing decision is implemented. [Source availability](./SOURCE-AVAILABILITY.md) and [third-party notices](./THIRD-PARTY-NOTICES.md) distinguish completed documentation from pending version-specific network/source, model and binary obligations. Choices B/C below remain alternatives for future decisions; neither is selected.

## Current position

| Checked component | Position at this checkpoint |
|---|---|
| Mert/Carter project code | The full root [LICENSE](../LICENSE) and [NOTICE](../NOTICE) now declare AGPL-3.0-only for first-party covered source. Workspace manifest metadata and the visible source link are coordinated with their owners; no manifest or app was edited by this lane. Public visibility alone was not the licence grant. [GitHub explanation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) |
| Active detector/tracker stack | [Worker requirements](../worker/requirements.txt) pin Ultralytics **8.4.206**; its [versioned upstream LICENSE](https://github.com/ultralytics/ultralytics/blob/v8.4.206/LICENSE) contains AGPL version 3. The worker uses its detector/ByteTrack implementation and pretrained YOLO11n weights. [Ultralytics' stated licensing position](https://www.ultralytics.com/license) covers code, models and trained models through AGPL-3.0 or Enterprise terms. No Enterprise entitlement is established by the inspected release evidence; any existing private entitlement needs confirmation. |
| Locked web dependencies | [Lockfile](../package-lock.json): Next **16.4.5**, React/React DOM **19.3.1** and Phosphor **2.1.10** identify MIT; MapLibre **6.17.0** identifies BSD-3-Clause; TypeScript **5.9.3** identifies Apache-2.0. Preserve upstream notices. These direct entries are not a full transitive/binary distribution audit. |
| Other pinned Python packages | [lap 0.5.14](https://pypi.org/project/lap/0.5.14/) identifies BSD-2-Clause; [PyYAML 6.0.3](https://pypi.org/project/PyYAML/6.0.3/) and [pytest 9.2.0](https://pypi.org/project/pytest/9.2.0/) identify MIT. The recorded [PyTorch 2.7.1 runtime](../evaluation/README.md) uses [BSD-3-Clause terms](https://github.com/pytorch/pytorch/blob/v2.7.1/LICENSE). These notices remain applicable. |
| OpenCV and bundled binaries | [opencv-python 5.0.0.93 documentation](https://pypi.org/project/opencv-python/5.0.0.93/) identifies Apache-2.0 for OpenCV and MIT for packaging, plus LGPL-2.1 FFmpeg and LGPL-3.0 Qt5 in applicable non-headless Linux wheels. Review the actual exported wheel/binary notices. Standalone FFmpeg build options and CUDA redistribution are not cleared by this inventory. |
| Fonts, map, factors and media | Manrope/Lora OFL notices are present. Map data/tile credits, CARB provenance and Caltrans media/source terms remain separately applicable; a project licence cannot relicense third-party material. Exact paths and primary links are in the [inventory](./README.md#source-and-licence-inventory). |

The licence text distinguishes an independent aggregate from a combined covered work (§5), defines corresponding source (§1), and addresses modified network versions (§13). The exact application boundary needs review; process separation alone is not a demonstrated exemption. AGPL permits charging for copies (§4), so **commercial use alone is not a blanket prohibition or an automatic reason to buy a licence**. Keep the licence text distinct from the vendor's broader published compliance guidance. [Versioned terms](https://github.com/ultralytics/ultralytics/blob/v8.4.206/LICENSE)

## Feasible choices

| Choice | What Mert and Carter would decide | Work needed before claiming it complete |
|---|---|---|
| **A — AGPL route with the current stack** | Agree to release the covered integrated work under AGPL v3 and meet the applicable obligations. This keeps the demonstrated runtime. | Confirm both contributors' authority; define the covered release scope; add the correct full licence, copyright/change notices and third-party inventory; make the matching corresponding source/build/run instructions available and provide the applicable source offer/notices to recipients/network users. Review pretrained-weight download/redistribution and relevant model materials against upstream terms. A root licence file alone is insufficient. |
| **B — Appropriate Enterprise rights** | Use a confirmed existing grant, or separately authorize obtaining an agreement covering the actual team, software/models and intended distribution/deployment. | Review the actual executed agreement and scope, then choose the licence for Mert/Carter-owned code consistently with it. Upstream dependency/data notices still apply. Price, coverage and acquisition time are not established. No purchase or contact has been made. [Published Enterprise terms](https://www.ultralytics.com/legal/enterprise-software-license) |
| **C — Replace the affected dependency and weights later** | Separately authorize a detector/tracker/weights stack with compatible verified rights, then reassess the project licence. | Check code, weights and training-data terms; replace integrations; rerun held-out crossing/tracking and delivery checks; update evidence and claims. This is future implementation scope, not a same-runtime paperwork fix or a completed hackathon option. |

The approved route does not relicense upstream components or certify prior use. Omitting weights from Git or adding an attribution line alone does not settle the remaining obligations.

## Decision record and completion gate

**Recorded choice: A; AGPL-3.0-only for Mert/Carter first-party covered source.** Complete licence text, project notice, selected direct dependency notices and source/build/run guidance are published. The [source-availability checklist](./SOURCE-AVAILABILITY.md#release-completion-checks) leaves exact deployed-version links, remaining corresponding-source/model materials and artifact-specific transitive/binary checks open. The separate [submission checklist](./README.md#final-submission-checklist) does not treat the project licence decision as blanket compliance or submission completion.

For any path, keep secrets, service credentials, private identities and raw camera footage out of public source. Prepare lawful, reproducible configuration templates and instructions rather than publishing operational credentials. Determine which non-secret build/run/model materials the chosen terms require; if required materials cannot be lawfully supplied, do not label that release compliant. Public factor/media attribution and map/font notices remain separate from code licensing and from honest AI-use disclosure.
