# Detector comparison on held-out test frames

60 human-reviewed test frames. Settings: image size 1280, confidence 0.25, IoU 0.5, boxes under 25 px ignored.

## Coarse classes (both models)

| Class | Model | Precision | Recall | F1 |
|---|---|---:|---:|---:|
| car | pretrained | 96% | 81% | 88% |
| truck | pretrained | 21% | 58% | 30% |
| bus | pretrained | 92% | 85% | 88% |
| motorcycle | pretrained | 67% | 67% | 67% |
| any vehicle | pretrained | 94% | 86% | 90% |

| Model | Mean count error per frame | Mean signed error |
|---|---:|---:|
| pretrained | 2.4 | -1.6 |
