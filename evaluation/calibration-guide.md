# Camera measurement setup

**Owner:** Mert
**Updated:** 7 November 2026, 18:20 America/New_York (23:20 UTC)

No real camera measurement geometry is enabled by this guide. `config/cameras/measurement.example.json` contains arbitrary illustrative coordinates and stays disabled and unvalidated. It is not a calibration for camera 222. The existing camera YAML files and shared calibration records remain unchanged.

## Image-space counting

`worker.metrics.MetricsConfig.from_dict` validates explicit road-region, excluded-region and finite gate geometry. `CameraMetrics(config).update(frame, tracked_vehicles)` consumes the existing reader/tracker outputs. It returns new crossing events plus cumulative per-session crossing totals. Temporary track IDs appear only in ephemeral crossing events: aggregate those events, then discard their identities before persistence. An update is not a complete minute of footage, and cumulative totals must not be published repeatedly as new minute counts.

For each real camera, Mert should inspect a recent frame and a short held-out clip, record the image dimensions and camera orientation, and draw a road polygon around only the intended travel lanes. Exclude parking areas, sidewalks, opposing segments that are outside the question, and visibly occluded regions. Coordinates are `(x / image width, y / image height)`, with `(0,0)` at the top left. The tracked box's normalized bottom centre is the observation point; validate whether that proxy works for distant and occluded vehicles in this view.

Place a finite counting gate across the chosen lane paths. Gates have ordered start/end points. Positive crossings move from negative to positive signed side of that ordered line, in image coordinates; inspect the reported direction on a known trajectory before using it. Select `positive`, `negative`, or `both` explicitly. Do not sum entry and exit gates into a claim about unique vehicles: the same vehicle can cross both. Choose one designated counting gate per movement or retain per-gate results separately.

A crossing requires an actual trajectory segment intersecting the finite gate, stable opposite sides outside the configured hysteresis band, and the minimum number of track observations. Boxes that remain near the gate do not repeatedly increment the count. A track/direction/gate is counted once per camera session. This deliberately suppresses repeated same-direction recrossings by one track; the metric is not every possible trip around a loop. A reconnect resets identities and counts. Missing source intervals longer than `max_gap_s`, ROI exits and invalid boxes break motion continuity rather than bridging an unsupported crossing.

Measure count error against manual line-crossing annotations, including both directions, partial occlusions, frame drops and vehicles near gate endpoints. Keep this clip separate from detector training footage. Record any missed or duplicated events and select minimum hits/hysteresis/gap settings from that evaluation. Only after review should a real configuration set `image_geometry_status` to `reviewed` and `enabled` to true. Keep the example disabled. Image-geometry review supports line crossings; it does not establish ground distance calibration.

## Image-space stopped observations

Stopped observations require an explicitly chosen `stopped_threshold_per_s`, expressed as Euclidean displacement of normalized image coordinates per second of source media time, and a minimum observed duration. This threshold is sensitive to perspective and box jitter. It is not a physical speed in metres per second. No default threshold is silently enabled.

An explicit queue polygon is required for queue counts. A visible queue track with insufficient history leaves queue count unavailable, rather than asserting an empty queue. Qualified stopped time is credited only for intervals after qualification, with no retrospective credit for the initial minimum-duration interval. This is conservative, and an aggregator must split any credited source-time interval at reporting boundaries before minute persistence. Movement, missing tracks beyond the gap threshold and reconnects break stopped evidence. Excluded parking polygons do not contribute. Queue length in metres remains unavailable.

Validate the threshold and stopped-time error against separate manually annotated footage. Call the result **image-based stopped time**, never engine idling; the video does not establish whether an engine is running.

## Ground distance, traversals and emissions

Before marking shared calibration valid, record independently measured road-plane reference coordinates/distances, their source and uncertainty, image reference points, the fitted transform, road region, entry/exit gate definitions and a calibration version. Use at least four suitable non-collinear road-plane correspondences for a projective transform and reserve additional independently measured landmarks for validation. Paint markings or map geometry require an actual documented scale; a posted speed limit is not distance evidence.

Validate transformed distances and completed entry-to-exit traversal times against independent references across the intended segment. Check that the road-plane assumption holds; elevated vehicles, camera movement, perspective extremes, changing zoom and severe occlusions can invalidate it. Record tolerances before acceptance. If the view moves or validation fails, invalidate calibration and suppress physical speed, distance-based queue length and emissions while preserving supported image observations.

The image metrics module does not fit a homography, produce physical speeds, complete calibrated traversals, or generate emissions. Those require the independently validated calibration and documented visual-to-CARB class mappings. A queue without completed calibrated traversals is insufficient emissions evidence, not zero emissions.

## References

- [Ultralytics object counting](https://docs.ultralytics.com/guides/object-counting/): tracked-object counting with explicit line or polygon regions. This implementation adds finite-segment checks, hysteresis, gap handling and per-session deduplication; it does not use a generic detector's per-frame box count as traffic flow.
- [OpenCV homography tutorial](https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html): planar projective geometry and correspondence requirements. Reference measurements and held-out validation are still required for this camera application.
- `Plan.md` sections 7–9 and 14: per-camera identities, calibration limits, stopped-time terminology, emissions evidence and null-versus-zero rules.
