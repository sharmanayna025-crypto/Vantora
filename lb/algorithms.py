import threading


class Backend:
    def __init__(self, host, port, weight=1):
        self.host = host
        self.port = port
        self.weight = weight

        # -----------------------------
        # Health status
        # -----------------------------
        self.healthy = True

        # Number of consecutive health-check failures
        self.failed_checks = 0

        # Number of consecutive successful health checks
        self.successful_checks = 0

        # -----------------------------
        # Statistics
        # -----------------------------
        self.active_conns = 0
        self.total_requests = 0
        self.errors = 0
        # Response time statistics
        self.total_response_time = 0.0
        self.avg_response_time = 0.0 



class RoundRobin:

    def __init__(self):
        self.index = 0
        self.lock = threading.Lock()

    def pick(self, backends):

        # Only select healthy backends
        pool = [
            backend
            for backend in backends
            if backend.healthy
        ]

        if not pool:
            return None

        # Protect index from multiple threads
        with self.lock:

            backend = pool[
                self.index % len(pool)
            ]

            self.index += 1

        return backend


class LeastConnections:

    def pick(self, backends):

        # Only select healthy backends
        pool = [
            backend
            for backend in backends
            if backend.healthy
        ]

        if not pool:
            return None

        # Select backend with the fewest
        # active connections
        return min(
            pool,
            key=lambda backend: backend.active_conns
        )


class WeightedRoundRobin:

    def __init__(self):
        self.index = 0
        self.lock = threading.Lock()

    def pick(self, backends):

        # Create weighted pool
        pool = [
            backend
            for backend in backends
            if backend.healthy
            for _ in range(backend.weight)
        ]

        if not pool:
            return None

        # Protect index
        with self.lock:

            backend = pool[
                self.index % len(pool)
            ]

            self.index += 1

        return backend
