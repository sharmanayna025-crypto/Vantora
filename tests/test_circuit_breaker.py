import os
import sys
import unittest

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "lb"
    )
)

from circuit_breaker import (
    CircuitBreaker,
    CLOSED,
    OPEN,
    HALF_OPEN
)


class FakeClock:

    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t

    def advance(self, seconds):
        self.t += seconds


class CircuitBreakerTests(unittest.TestCase):

    def setUp(self):

        self.clock = FakeClock()
        self.events = []

        self.cb = CircuitBreaker(
            "b",
            failure_threshold=3,
            open_seconds=10,
            clock=self.clock,
            on_state_change=lambda name, old, new:
                self.events.append((old, new))
        )

    def fail(self, count):

        for _ in range(count):

            self.assertTrue(
                self.cb.acquire()
            )

            self.cb.record_failure()

    def test_opens_after_threshold(self):

        self.fail(2)

        self.assertEqual(
            self.cb.snapshot()["state"],
            CLOSED
        )

        self.fail(1)

        self.assertEqual(
            self.cb.snapshot()["state"],
            OPEN
        )

        self.assertEqual(
            self.events,
            [(CLOSED, OPEN)]
        )

    def test_success_resets_failure_count(self):

        self.fail(2)

        self.cb.acquire()
        self.cb.record_success()

        self.fail(2)

        self.assertEqual(
            self.cb.snapshot()["state"],
            CLOSED
        )

    def test_open_blocks_requests(self):

        self.fail(3)

        self.assertFalse(
            self.cb.is_available()
        )

        self.assertFalse(
            self.cb.acquire()
        )

    def test_half_open_after_cooldown_allows_one_probe(self):

        self.fail(3)

        self.clock.advance(10)

        self.assertTrue(
            self.cb.is_available()
        )

        self.assertTrue(
            self.cb.acquire()
        )

        self.assertEqual(
            self.cb.snapshot()["state"],
            HALF_OPEN
        )

        self.assertFalse(
            self.cb.acquire()
        )

    def test_probe_success_closes(self):

        self.fail(3)

        self.clock.advance(10)

        self.cb.acquire()
        self.cb.record_success()

        self.assertEqual(
            self.cb.snapshot()["state"],
            CLOSED
        )

    def test_probe_failure_reopens(self):

        self.fail(3)

        self.clock.advance(10)

        self.cb.acquire()
        self.cb.record_failure()

        self.assertEqual(
            self.cb.snapshot()["state"],
            OPEN
        )

        self.assertFalse(
            self.cb.is_available()
        )


if __name__ == "__main__":
    unittest.main()
