"""Road-plane projection and independent-distance arithmetic checks.

The supplied homography maps image pixel coordinates to ground-plane metres.
No transform is fitted here. Passing these mathematical checks does not approve
a camera: independently sourced reference measurements, camera-view stability,
road-plane suitability, and field review remain separate requirements.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction
import math

Point = tuple[float, float]
Homography = tuple[tuple[float, float, float], ...]
# Numerical cancellation guard, not a physical calibration acceptance threshold.
_HORIZON_RELATIVE_EPSILON = 1e-12


def _finite(value, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{name} must be a finite number.")
    try:
        result = float(value)
    except OverflowError as error:
        raise ValueError(f"{name} must be a finite number.") from error
    if not math.isfinite(result):
        raise ValueError(f"{name} must be a finite number.")
    return result


def _point(value, name: str) -> Point:
    if not isinstance(value, (tuple, list)) or len(value) != 2:
        raise ValueError(f"{name} needs two pixel coordinates.")
    return _finite(value[0], name), _finite(value[1], name)


def validate_homography(matrix) -> Homography:
    """Return a scale-normalized, finite, nonsingular 3x3 matrix.

    An exact rational determinant of the represented floats avoids determinant
    overflow and cancellation. Extremely disparate coefficients that become
    singular when scale-normalized cannot be used with this float arithmetic.
    Nonsingularity alone establishes no physical calibration or accuracy.
    """
    if not isinstance(matrix, (tuple, list)) or len(matrix) != 3:
        raise ValueError("Homography must be a 3x3 matrix.")
    if any(not isinstance(row, (tuple, list)) or len(row) != 3 for row in matrix):
        raise ValueError("Homography must be a 3x3 matrix.")
    rows = tuple(tuple(_finite(value, "Homography coefficient") for value in row) for row in matrix)
    scale = max(abs(value) for row in rows for value in row)
    if scale == 0:
        raise ValueError("Homography must be nonsingular.")
    normalized = tuple(tuple(value / scale for value in row) for row in rows)
    a, b, c = (tuple(Fraction(value) for value in row) for row in normalized)
    determinant = (
        a[0] * (b[1] * c[2] - b[2] * c[1])
        - a[1] * (b[0] * c[2] - b[2] * c[0])
        + a[2] * (b[0] * c[1] - b[1] * c[0])
    )
    if determinant == 0:
        raise ValueError("Homography must be nonsingular after scale normalization.")
    return normalized


def _project(matrix: Homography, point: Point) -> Point:
    # Scale the homogeneous image vector too, avoiding overflow from otherwise
    # equivalent large matrix/point representations before division.
    scale = max(1.0, abs(point[0]), abs(point[1]))
    vector = (point[0] / scale, point[1] / scale, 1.0 / scale)
    denominator_terms = tuple(a * b for a, b in zip(matrix[2], vector))
    denominator = math.fsum(denominator_terms)
    magnitude = math.fsum(abs(term) for term in denominator_terms)
    if magnitude == 0 or abs(denominator) <= _HORIZON_RELATIVE_EPSILON * magnitude:
        raise ValueError("Image point is on or numerically near the projective horizon.")
    result = tuple(math.fsum(a * b for a, b in zip(row, vector)) / denominator for row in matrix[:2])
    if not all(math.isfinite(value) for value in result):
        raise ValueError("Projected ground point is not finite.")
    return result


def project_road_point(matrix, image_point_px) -> Point:
    """Project one image point in pixels to a ground-plane (x, y) in metres.

    The caller supplies the transform and its units. No image bounds, road ROI,
    camera identity, landmark source, or physical validity is inferred here.
    """
    return _project(validate_homography(matrix), _point(image_point_px, "Image point"))


@dataclass(frozen=True)
class DistanceReference:
    """One caller-supplied held-out measured ground-distance pair.

    ``reference_id`` should resolve to separately retained source evidence. This
    record cannot prove that a pair is independent of the transform's fit data.
    """

    reference_id: str
    image_start_px: Point
    image_end_px: Point
    measured_distance_m: float


@dataclass(frozen=True)
class DistanceResidual:
    reference_id: str
    measured_distance_m: float
    projected_distance_m: float
    signed_error_m: float
    absolute_error_m: float
    tolerance_m: float
    within_tolerance: bool


@dataclass(frozen=True)
class DistanceCheck:
    """Arithmetic result only; never a real camera's calibration status."""

    residuals: tuple[DistanceResidual, ...]

    @property
    def all_within_tolerance(self) -> bool:
        return bool(self.residuals) and all(residual.within_tolerance for residual in self.residuals)


def check_reference_distances(
    matrix,
    references,
    *,
    absolute_tolerance_m: float,
    relative_tolerance: float,
) -> DistanceCheck:
    """Check held-out distances under explicitly chosen acceptance tolerances.

    Each pair passes when ``absolute_error_m <= absolute_tolerance_m +
    relative_tolerance * measured_distance_m``. Both tolerances are mandatory,
    finite and nonnegative. An empty reference set is rejected rather than
    producing a vacuous pass. Measurement uncertainty and the required number
    and layout of independent references must be justified separately.
    """
    homography = validate_homography(matrix)
    absolute = _finite(absolute_tolerance_m, "Absolute tolerance")
    relative = _finite(relative_tolerance, "Relative tolerance")
    if absolute < 0 or relative < 0:
        raise ValueError("Distance tolerances must be nonnegative.")
    try:
        references = tuple(references)
    except TypeError as error:
        raise ValueError("Supply a nonempty collection of distance references.") from error
    if not references:
        raise ValueError("Supply a nonempty collection of distance references.")
    residuals = []
    seen = set()
    for reference in references:
        if not isinstance(reference, DistanceReference):
            raise ValueError("Each reference must be a DistanceReference.")
        if not isinstance(reference.reference_id, str) or not reference.reference_id.strip():
            raise ValueError("Each distance reference needs a nonempty evidence identifier.")
        if reference.reference_id in seen:
            raise ValueError("Distance reference identifiers must be unique.")
        seen.add(reference.reference_id)
        start = _point(reference.image_start_px, "Reference start")
        end = _point(reference.image_end_px, "Reference end")
        if start == end:
            raise ValueError("Reference image endpoints must be distinct.")
        measured = _finite(reference.measured_distance_m, "Measured ground distance")
        if measured <= 0:
            raise ValueError("Measured ground distance must be positive.")
        projected = math.dist(_project(homography, start), _project(homography, end))
        allowed = absolute + relative * measured
        if not math.isfinite(projected) or not math.isfinite(allowed):
            raise ValueError("Projected distance and tolerance must remain finite.")
        signed_error = projected - measured
        error = abs(signed_error)
        residuals.append(DistanceResidual(reference.reference_id, measured, projected,
                                          signed_error, error, allowed, error <= allowed))
    return DistanceCheck(tuple(residuals))
