
import unittest
import sys
import os

sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
            "lb"
        )
    )
)

from algorithms import Backend


class TestBackendHealth(unittest.TestCase):

    def setUp(self):
        self.backend = Backend("127.0.0.1", 9001)

    def test_backend_starts_healthy(self):
        self.assertTrue(self.backend.healthy)
        self.assertEqual(self.backend.failed_checks, 0)
        self.assertEqual(self.backend.successful_checks, 0)

    def test_three_consecutive_failures_mark_backend_down(self):
        self.assertIsNone(self.backend.record_health_failure())
        self.assertTrue(self.backend.healthy)

        self.assertIsNone(self.backend.record_health_failure())
        self.assertTrue(self.backend.healthy)

        result = self.backend.record_health_failure()

        self.assertEqual(result, "DOWN")
        self.assertFalse(self.backend.healthy)
        self.assertEqual(self.backend.failed_checks, 3)

    def test_one_success_does_not_recover_backend(self):
        for _ in range(3):
            self.backend.record_health_failure()

        result = self.backend.record_health_success()

        self.assertIsNone(result)
        self.assertFalse(self.backend.healthy)
        self.assertEqual(self.backend.successful_checks, 1)

    def test_two_consecutive_successes_recover_backend(self):
        for _ in range(3):
            self.backend.record_health_failure()

        self.backend.record_health_success()
        result = self.backend.record_health_success()

        self.assertEqual(result, "UP")
        self.assertTrue(self.backend.healthy)
        self.assertEqual(self.backend.failed_checks, 0)
        self.assertEqual(self.backend.successful_checks, 0)

    def test_success_resets_consecutive_failure_count(self):
        self.backend.record_health_failure()
        self.backend.record_health_failure()

        self.backend.record_health_success()

        self.assertTrue(self.backend.healthy)
        self.assertEqual(self.backend.failed_checks, 0)

        self.backend.record_health_failure()
        self.backend.record_health_failure()

        self.assertTrue(self.backend.healthy)

    def test_health_state_is_separate_from_circuit_breaker(self):
        for _ in range(3):
            self.backend.record_health_failure()

        self.assertFalse(self.backend.healthy)

        # Health-check failures alone must not open the circuit breaker.
        self.assertEqual(
            self.backend.breaker.snapshot()["state"],
            "CLOSED"
        )


if __name__ == "__main__":
    unittest.main()
