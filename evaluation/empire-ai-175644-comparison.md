**Recorded:** 7 November 2026, 18:46 America/New_York (23:46 UTC), Mert.

# Detector comparison on held-out test frames

60 human-reviewed test frames. Settings: image size 1280, confidence 0.25, IoU 0.5, boxes under 25 px ignored.

## Coarse classes (both models)

| Class | Model | Precision | Recall | F1 |
|---|---|---:|---:|---:|
| car | pretrained | 96% | 81% | 88% |
| car | tuned | 86% | 79% | 83% |
| truck | pretrained | 21% | 60% | 31% |
| truck | tuned | 32% | 27% | 29% |
| bus | pretrained | 92% | 85% | 88% |
| bus | tuned | 48% | 77% | 59% |
| motorcycle | pretrained | 67% | 67% | 67% |
| motorcycle | tuned | n/a | 0% | 0% |
| any vehicle | pretrained | 94% | 87% | 90% |
| any vehicle | tuned | 86% | 79% | 83% |

| Model | Mean count error per frame | Mean signed error |
|---|---:|---:|
| pretrained | 2.4 | -1.6 |
| tuned | 2.8 | -1.6 |

## Fine classes (tuned model)

| Class | Precision | Recall | F1 | Labeled |
|---|---:|---:|---:|---:|
| car | 85% | 79% | 82% | 1141 |
| pickup | 26% | 29% | 27% | 35 |
| box_truck | 60% | 23% | 33% | 13 |
| tractor_trailer | n/a | 0% | 0% | 4 |
| bus | 48% | 77% | 59% | 13 |
| motorcycle | n/a | 0% | 0% | 3 |
| tesla | 0% | 0% | 0% | 28 |

Tesla rule: 0 single-frame Tesla calls at or above 85% confidence, 0 correct, 28 labeled Teslas.

## Decision and limits

The tuned checkpoint is **not promoted**: pretrained YOLO11s is better on every coarse-class F1, any-vehicle precision/recall and count MAE in this fixed held-out comparison. The existing runtime model selection is unchanged. The 60 test images were evaluated after validation-based selection; this test result must not be used to tune the same candidate and then described as a new independent test.

Training labels include assisted drafts, and the split comes from one short collection period and the same four views. There are no tractor-trailer training examples, only four motorcycle training boxes, and no motorcycle validation examples. The three-frame Tesla tracking rule is not validated by a single-frame detector test. These are image-level detection results, not unique crossings, stopped-time accuracy, emissions or environmental impact.
