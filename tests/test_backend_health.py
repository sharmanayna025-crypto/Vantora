import unittest
import sys
import os

# Allow Python to import files from the lb folder
sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "lb")
    )
)

from algorithms import Backend


class TestBackendHealth(unittest.TestCase):

    def test_backend_starts_healthy(self):
        backend = Backend("127.0.0.1", 9001)

        self.assertTrue(backend.healthy)
        self.assertEqual(backend.failed_checks, 0)
        self.assertEqual(backend.successful_checks, 0)

    def test_backend_becomes_unhealthy_after_three_failures(self):
        backend = Backend("127.0.0.1", 9001)

        # Simulate three failed health checks
        backend.failed_checks = 3
        backend.healthy = False

        self.assertFalse(backend.healthy)
        self.assertEqual(backend.failed_checks, 3)

    def test_backend_can_become_healthy_after_recovery(self):
        backend = Backend("127.0.0.1", 9001)

        # Simulate backend going DOWN
        backend.healthy = False
        backend.failed_checks = 3

        # Simulate successful recovery checks
        backend.failed_checks = 0
        backend.successful_checks = 2
        backend.healthy = True

        self.assertTrue(backend.healthy)
        self.assertEqual(backend.successful_checks, 2)


if __name__ == "__main__":
    unittest.main()
