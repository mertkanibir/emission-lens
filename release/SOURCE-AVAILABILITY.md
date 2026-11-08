# Project licence and source availability

**Owner:** Mert
**Updated:** 8 November 2026, 00:36 America/New_York / 05:36 UTC
**Status:** Approved AGPL route implemented for first-party covered source. Version-specific source offers, deployment links and remaining third-party/model/binary checks require verification.

Copyright (C) 2026 Mert and Carter. Emission Lens first-party covered source code is licensed under the **GNU Affero General Public License, version 3 only (AGPL-3.0-only)**. Read the full [LICENSE](../LICENSE), [project NOTICE](../NOTICE) and [third-party notices](./THIRD-PARTY-NOTICES.md). The licence grants code rights and includes warranty/liability terms; it does not certify scientific accuracy or relicense upstream data, weights, fonts or media.

## Obtain the source

The public source is [mertkanibir/emission-lens](https://github.com/mertkanibir/emission-lens). Each commit can be browsed, cloned and downloaded as source. To reproduce a particular release or running build, use its **exact source commit** recorded in the deployment/run evidence, not simply the latest branch head:

```sh
git clone https://github.com/mertkanibir/emission-lens.git
cd emission-lens
git checkout <the-exact-source-commit-from-the-build-or-run-receipt>
```

This repository supplies the project worker, backend, contracts, emissions calculation/import tools, frontend, integration/evaluation code, tests and non-secret configuration/examples. Build/install/run instructions are in [frontend](../frontend/README.md), [backend ingestion](../backend/INGESTION.md), [measurement ingestion](../backend/MEASUREMENT-INGESTION.md), [worker setup](../worker/README.md), [measurement runtime](../worker/RUNTIME-MEASUREMENTS.md) and [factor provenance](../emissions/README.md). The root [.env.example](../.env.example) and [disabled measurement example](../config/cameras/measurement.example.json) are templates, not credentials or camera approvals. Node dependencies resolve through the lockfile; worker requirements are pinned separately. Choose the documented CPU/CUDA environment for the actual target.

Application credentials, private identities, raw footage and private operational evidence are not made public by licensing the source. A recipient can use their own authorized inputs and credentials. Supply the non-secret configuration and build/run materials actually required for the covered version; if material needed to meet corresponding-source obligations cannot be lawfully provided, do not certify the release as complete. Model weights have their own upstream requirements; merely excluding weight binaries from Git does not settle them.

## Match a source offer to the running version

Mert approved the AGPL route after the current production build was frozen. Adding these documents does not update that running build or automatically add a visible source link to it. The application owner must review and add a readily accessible **Licence and source** link using the deployed version's exact source reference and these notices, with the applicable licence/no-warranty information. A modified covered version offered over a network must satisfy the AGPL source-offer provisions for that version. A generic link to a later branch revision must not substitute for the required corresponding source of the running version. See [AGPL §§1, 4–6 and 13](../LICENSE).

Requests to the Project Manager/application owner cover the visible link, exact-version mapping and workspace manifest licence metadata. This lane changes no app component, manifest, active process, GPU job or deployment. No source offer is claimed to have been visually verified in production yet.

## Release completion checks

- [x] Record the approved project code licence and retain its complete text and project notice.
- [x] Publish the source repository/build-instruction index and selected direct-package notices with byte hashes.
- [ ] Bind each distributed/deployed artifact to its exact source, non-secret required configuration and applicable source offer; check the visible application link/notices with its owner.
- [ ] Verify weights/acquisition/redistribution and required model materials for the actual artifact; preserve source and modification notices.
- [ ] Review the actual transitive packages, FFmpeg/OpenCV/Qt and CUDA/binary distribution choices, plus map/font/factor/media terms. Preserve any additional required notices/source offers.

The first two checks are implemented project licensing and documentation. The remaining checks prevent a blanket dependency, binary or network-use compliance claim. No Enterprise purchase or contact is part of the selected AGPL route.
