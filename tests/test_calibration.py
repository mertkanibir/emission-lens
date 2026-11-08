"""Road-plane mathematics with synthetic coordinates, not camera approval."""

import math
import unittest

from worker.calibration import (
    DistanceCheck,
    DistanceReference,
    check_reference_distances,
    project_road_point,
    validate_homography,
)

IDENTITY = ((1, 0, 0), (0, 1, 0), (0, 0, 1))


class ProjectionTests(unittest.TestCase):
    def test_affine_projection_has_caller_supplied_pixel_to_metre_scale(self):
        matrix = ((0.1, 0, 2), (0, 0.2, -3), (0, 0, 1))
        x, y = project_road_point(matrix, (100, 20))
        self.assertAlmostEqual(x, 12)
        self.assertAlmostEqual(y, 1)

    def test_known_projective_projection(self):
        matrix = ((2, 0, 1), (0, 3, 2), (0.1, 0.2, 1))
        x, y = project_road_point(matrix, (4, 5))
        self.assertAlmostEqual(x, 9 / 2.4)
        self.assertAlmostEqual(y, 17 / 2.4)

    def test_global_matrix_scale_does_not_change_projection(self):
        for scale in (1e300, -1e300, 1e-300):
            with self.subTest(scale=scale):
                matrix = tuple(tuple(scale * value for value in row) for row in IDENTITY)
                self.assertEqual(project_road_point(matrix, (12, 8)), (12, 8))

    def test_large_finite_image_coordinates_do_not_overflow_identity_projection(self):
        x, y = project_road_point(IDENTITY, (1e300, -1e300))
        self.assertTrue(math.isclose(x, 1e300, rel_tol=1e-15))
        self.assertTrue(math.isclose(y, -1e300, rel_tol=1e-15))

    def test_exact_nonsingularity_does_not_silently_impose_a_physical_tolerance(self):
        self.assertEqual(validate_homography(((1, 0, 0), (0, 1e-14, 0), (0, 0, 1)))[1][1], 1e-14)

    def test_singular_and_malformed_matrices_are_rejected(self):
        values = [[], [[1, 0], [0, 1]], [[0] * 3] * 3,
                  [[1, 2, 3], [2, 4, 6], [0, 0, 1]]]
        for matrix in values:
            with self.subTest(matrix=matrix), self.assertRaises(ValueError):
                validate_homography(matrix)

    def test_nonfinite_boolean_and_unrepresentable_coefficients_are_rejected(self):
        for coefficient in (math.nan, math.inf, -math.inf, True, "1", 10**400):
            with self.subTest(coefficient=coefficient), self.assertRaises(ValueError):
                validate_homography(((coefficient, 0, 0), (0, 1, 0), (0, 0, 1)))

    def test_points_on_and_near_projective_horizon_are_rejected(self):
        matrix = ((1, 0, 0), (0, 1, 0), (1, 0, -10))
        for x in (10, 10 + 1e-13):
            with self.subTest(x=x), self.assertRaisesRegex(ValueError, "horizon"):
                project_road_point(matrix, (x, 2))
        self.assertTrue(all(math.isfinite(value) for value in project_road_point(matrix, (11, 2))))

    def test_bad_image_points_are_rejected(self):
        for point in ((0,), (False, 1), (math.nan, 0), (0, math.inf)):
            with self.subTest(point=point), self.assertRaises(ValueError):
                project_road_point(IDENTITY, point)


class ReferenceDistanceTests(unittest.TestCase):
    def check(self, *references, absolute=0.0, relative=0.0, matrix=IDENTITY):
        return check_reference_distances(matrix, references, absolute_tolerance_m=absolute,
                                         relative_tolerance=relative)

    def reference(self, distance=5, start=(0, 0), end=(3, 4), reference_id="independent-pair"):
        return DistanceReference(reference_id, start, end, distance)

    def test_independent_known_distance_passes_and_records_units(self):
        result = self.check(self.reference())
        residual = result.residuals[0]
        self.assertTrue(result.all_within_tolerance)
        self.assertEqual(residual.measured_distance_m, 5)
        self.assertEqual(residual.projected_distance_m, 5)
        self.assertEqual(residual.signed_error_m, 0)

    def test_reference_distance_uses_projected_points_not_image_pixel_distance(self):
        matrix = ((0.5, 0, 0), (0, 0.5, 0), (0, 0, 1))
        result = self.check(self.reference(distance=2.5), matrix=matrix)
        self.assertTrue(result.all_within_tolerance)
        self.assertEqual(result.residuals[0].projected_distance_m, 2.5)

    def test_wrong_distance_is_an_explicit_failed_mathematical_check(self):
        result = self.check(self.reference(distance=4), absolute=0.5)
        self.assertFalse(result.all_within_tolerance)
        self.assertEqual(result.residuals[0].absolute_error_m, 1)
        self.assertEqual(result.residuals[0].signed_error_m, 1)

    def test_absolute_and_relative_tolerances_add_with_inclusive_boundary(self):
        reference = self.reference(distance=4)
        result = self.check(reference, absolute=0.5, relative=0.125)
        self.assertTrue(result.all_within_tolerance)
        self.assertEqual(result.residuals[0].tolerance_m, 1)
        self.assertFalse(self.check(reference, absolute=0.5, relative=0.124).all_within_tolerance)

    def test_negative_signed_error_and_multiple_references(self):
        result = self.check(self.reference(distance=6), self.reference(reference_id="another-pair"), absolute=1)
        self.assertEqual(len(result.residuals), 2)
        self.assertEqual(result.residuals[0].signed_error_m, -1)
        self.assertTrue(result.all_within_tolerance)

    def test_tolerances_are_required(self):
        with self.assertRaises(TypeError):
            check_reference_distances(IDENTITY, [self.reference()])

    def test_invalid_tolerances_are_rejected(self):
        for tolerance in (-1, math.inf, math.nan, True):
            with self.subTest(tolerance=tolerance), self.assertRaises(ValueError):
                self.check(self.reference(), absolute=tolerance)
            with self.subTest(tolerance=tolerance), self.assertRaises(ValueError):
                self.check(self.reference(), relative=tolerance)

    def test_empty_references_do_not_pass_vacuously(self):
        with self.assertRaisesRegex(ValueError, "nonempty"):
            self.check()
        self.assertFalse(DistanceCheck(()).all_within_tolerance)

    def test_bad_measurement_endpoints_and_identifiers_are_rejected(self):
        references = [self.reference(distance=value) for value in (0, -1, math.inf, math.nan, True)]
        references += [self.reference(start=(3, 4)), self.reference(start=(math.inf, 0)),
                       self.reference(reference_id=" ")]
        for reference in references:
            with self.subTest(reference=reference), self.assertRaises(ValueError):
                self.check(reference)
        with self.assertRaisesRegex(ValueError, "unique"):
            self.check(self.reference(), self.reference())

    def test_tolerance_overflow_is_not_an_automatic_pass(self):
        with self.assertRaisesRegex(ValueError, "finite"):
            self.check(self.reference(distance=1e308), relative=1e308)


if __name__ == "__main__":
    unittest.main()
