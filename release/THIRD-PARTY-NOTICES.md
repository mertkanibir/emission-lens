# Third-party notices and release boundaries

**Owner:** Mert
**Updated:** 8 November 2026, 00:36 America/New_York / 05:36 UTC
**Status:** Selected notices retained; full distributed-artifact obligations remain under review.

The project [NOTICE](../NOTICE) and [AGPL-3.0 licence](../LICENSE) apply to first-party covered code. Upstream software, weights, data, fonts and media retain their own rights and conditions. This inventory neither relicenses them nor certifies the entire application/dependency distribution.

## Retained software notices

These exact notices were copied without editing from the installed packages whose versions match [package-lock.json](../package-lock.json). [The manifest](./licenses/manifest.json) records filenames, versions and SHA-256 digests. Preserve them with relevant distributed components; also retain notices from bundled/transitive components in the actual build.

| Package | Version / licence identified by the lockfile | Retained upstream text |
|---|---|---|
| Next.js | 16.4.5 / MIT | [Notice](./licenses/next-16.4.5.txt) |
| React | 19.3.1 / MIT | [Notice](./licenses/react-19.3.1.txt) |
| React DOM | 19.3.1 / MIT | [Notice](./licenses/react-dom-19.3.1.txt) |
| Phosphor React icons | 2.1.10 / MIT | [Notice](./licenses/phosphor-icons-react-2.1.10.txt) |
| MapLibre GL JS | 6.17.0 / BSD-3-Clause | [Notice](./licenses/maplibre-gl-6.17.0.txt) |
| TypeScript | 5.9.3 / Apache-2.0 | [Notice](./licenses/typescript-5.9.3.txt) |
| tsx | See manifest / MIT | [Notice](./licenses/manifest.json) identifies its exact retained text and version. |

The pinned Ultralytics **8.4.206** [upstream LICENSE](https://github.com/ultralytics/ultralytics/blob/v8.4.206/LICENSE) is AGPL v3; [the root copy](../LICENSE) retains that full licence text. The current detector uses pretrained YOLO11n and that package's ByteTrack implementation. Follow the [upstream model/code terms](https://www.ultralytics.com/license); the project choice is not a blanket permission for arbitrary weight redistribution. No Enterprise entitlement is asserted.

Other [pinned worker packages](../worker/requirements.txt) include lap 0.5.14 (BSD-2-Clause), PyYAML 6.0.3 (MIT), pytest 9.2.0 (MIT), and the separately installed recorded PyTorch 2.7.1 runtime (BSD-3-Clause). Their exact installed licence files and bundled notices must accompany any applicable distribution. [OpenCV's pinned wheel documentation](https://pypi.org/project/opencv-python/5.0.0.93/) identifies OpenCV Apache-2.0, packaging MIT, bundled FFmpeg LGPL-2.1 and Qt5 LGPL-3.0 in applicable Linux wheels. Audit the actual binary/build options; standalone FFmpeg/CUDA redistribution is not cleared by this source inventory.

## Fonts, map, data, media and compute

- Retain [Manrope OFL](../frontend/src/app/fonts/Manrope-OFL.txt) and [Lora OFL](../frontend/src/app/fonts/Lora-OFL.txt) with their supplied fonts; the [outlined wordmark](../branding/README.md) derives from Manrope. No trademark clearance is asserted.
- Preserve the visible [OpenFreeMap/OpenMapTiles](https://openfreemap.org/quick_start/) and [OpenStreetMap contributor/ODbL attribution](https://www.openstreetmap.org/copyright) in the map and relevant exported media.
- CARB EMFAC2025 v2.1.1 factors retain their [source receipt/checksums](../emissions/data/la-2026/receipt.json), [method/source notes](../emissions/README.md) and applicable source terms. Code licensing does not grant new rights in the source CSV or imply CARB endorsement.
- Public camera/metadata sources are [Caltrans/CWWP](https://dot.ca.gov/programs/traffic-operations/traveler-information/cwwp), subject to [source conditions and third-party exceptions](https://dot.ca.gov/conditions-of-use). No raw footage is licensed or supplied by this project package. Review incidental identifiers before publishing demo images/video.
- Credit Empire AI for the actual [documented GPU execution](../evaluation/README.md); availability of compute is not a model/data licence grant.
- A retained generated illustration is documented in [frontend notes](../frontend/README.md); it is not camera footage. Label any reuse accordingly.

Before exporting executable bundles, containers, model weights or a hosted service, bind the artifact/version and complete its own notice, corresponding-source and upstream permission checks. The [source-availability checklist](./SOURCE-AVAILABILITY.md) tracks what remains open; the [licensing decision](./LICENSING-DECISION.md) records the approved project path.
