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

from algorithms import (
    Backend,
    RoundRobin,
    WeightedRoundRobin,
    LeastConnections
)


class TestRoutingAlgorithms(unittest.TestCase):

    def setUp(self):
        self.backends = [
            Backend("127.0.0.1", 9001, weight=3),
            Backend("127.0.0.1", 9002, weight=2),
            Backend("127.0.0.1", 9003, weight=1)
        ]

    def test_round_robin(self):
        router = RoundRobin()

        selected_ports = []

        for _ in range(6):
            backend = router.pick(self.backends)
            selected_ports.append(backend.port)

        expected = [
            9001,
            9002,
            9003,
            9001,
            9002,
            9003
        ]

        self.assertEqual(selected_ports, expected)

    def test_weighted_round_robin(self):
        router = WeightedRoundRobin()

        selected_ports = []

        for _ in range(12):
            backend = router.pick(self.backends)
            selected_ports.append(backend.port)

        self.assertEqual(selected_ports.count(9001), 6)
        self.assertEqual(selected_ports.count(9002), 4)
        self.assertEqual(selected_ports.count(9003), 2)

    def test_least_connections(self):
        router = LeastConnections()

        self.backends[0].active_conns = 5
        self.backends[1].active_conns = 2
        self.backends[2].active_conns = 8

        selected = router.pick(self.backends)

        self.assertEqual(selected.port, 9002)


if __name__ == "__main__":
    unittest.main()
