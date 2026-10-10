
import threading

from circuit_breaker import CircuitBreaker


def log_circuit_change(name, old_state, new_state):
    print(
        f"[CIRCUIT] {name}: "
        f"{old_state} -> {new_state}"
    )


class Backend:

    def __init__(self, host, port, weight=1):
        self.host = host
        self.port = port
        self.weight = weight

        # Health status
        self.healthy = True
        self.failed_checks = 0
        self.successful_checks = 0

        # Statistics
        self.active_conns = 0
        self.total_requests = 0
        self.errors = 0
        self.total_response_time = 0.0
        self.avg_response_time = 0.0

        # Circuit breaker
        self.breaker = CircuitBreaker(
            name=f"Backend-{port}",
            failure_threshold=3,
            open_seconds=10,
            half_open_max_probes=1,
            success_threshold=1,
            on_state_change=log_circuit_change
        )

    def record_health_success(self):
        """Record one successful health check."""

        self.failed_checks = 0

        # Already healthy: no recovery checks are needed.
        if self.healthy:
            self.successful_checks = 0
            return None

        self.successful_checks += 1

        # Recover after two consecutive successful checks.
        if self.successful_checks >= 2:
            self.healthy = True
            self.failed_checks = 0
            self.successful_checks = 0
            return "UP"

        return None

    def record_health_failure(self):
        """Record one failed health check."""

        self.successful_checks = 0
        self.failed_checks += 1

        # Mark DOWN after three consecutive failures.
        if self.healthy and self.failed_checks >= 3:
            self.healthy = False
            return "DOWN"

        return None

    def routable(self):
        # A backend must be healthy and circuit-available.
        return (
            self.healthy
            and self.breaker.is_available()
        )


class RoundRobin:

    def __init__(self):
        self.index = 0
        self.lock = threading.Lock()

    def pick(self, backends):
        pool = [
            backend
            for backend in backends
            if backend.routable()
        ]

        if not pool:
            return None

        with self.lock:
            backend = pool[self.index % len(pool)]
            self.index += 1

        return backend


class LeastConnections:

    def pick(self, backends):
        pool = [
            backend
            for backend in backends
            if backend.routable()
        ]

        if not pool:
            return None

        return min(
            pool,
            key=lambda backend: backend.active_conns
        )


class WeightedRoundRobin:

    def __init__(self):
        self.index = 0
        self.lock = threading.Lock()

    def pick(self, backends):
        pool = [
            backend
            for backend in backends
            if backend.routable()
            for _ in range(backend.weight)
        ]

        if not pool:
            return None

        with self.lock:
            backend = pool[self.index % len(pool)]
            self.index += 1

        return backend
