"""
circuit_breaker.py - Per-backend circuit breaker for Vantora.

States:
    CLOSED     normal operation
    OPEN       backend is skipped until the cooldown expires
    HALF_OPEN  a limited number of trial requests are allowed through

Usage pattern (always pair acquire() with record_success()/record_failure()):

    if breaker.acquire():
        try:
            ...send request...
            breaker.record_success()
        except Exception:
            breaker.record_failure()
"""
import threading
import time

CLOSED = "CLOSED"
OPEN = "OPEN"
HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    def __init__(self, name, failure_threshold=3, open_seconds=10.0,
                 half_open_max_probes=1, success_threshold=1,
                 on_state_change=None, clock=time.monotonic):
        self.name = name
        self.failure_threshold = failure_threshold
        self.open_seconds = open_seconds
        self.half_open_max_probes = half_open_max_probes
        self.success_threshold = success_threshold
        self.on_state_change = on_state_change  # callback(name, old, new)
        self._clock = clock                     # injectable for unit tests

        self._lock = threading.Lock()
        self._state = CLOSED
        self._failures = 0           # consecutive failures while CLOSED
        self._successes = 0          # trial successes while HALF_OPEN
        self._probes_in_flight = 0
        self._opened_at = 0.0
        self._times_opened = 0
        self._last_change = time.time()

    # ---------- internal helpers (call only while holding the lock) ----------
    def _set_state(self, new_state):
        old = self._state
        if old == new_state:
            return None
        self._state = new_state
        self._last_change = time.time()
        if new_state == OPEN:
            self._opened_at = self._clock()
            self._times_opened += 1
            self._probes_in_flight = 0
            self._successes = 0
        elif new_state == HALF_OPEN:
            self._probes_in_flight = 0
            self._successes = 0
        elif new_state == CLOSED:
            self._failures = 0
            self._successes = 0
            self._probes_in_flight = 0
        return (old, new_state)

    def _notify(self, change):
        # Called AFTER releasing the lock so a slow callback can't deadlock us.
        if change and self.on_state_change:
            try:
                self.on_state_change(self.name, change[0], change[1])
            except Exception:
                pass

    # ---------- public API ----------
    def is_available(self):
        """Read-only check used by the routing algorithms to filter backends.
        Does not consume a trial slot."""
        with self._lock:
            if self._state == CLOSED:
                return True
            if self._state == OPEN:
                return (self._clock() - self._opened_at) >= self.open_seconds
            return self._probes_in_flight < self.half_open_max_probes

    def acquire(self):
        """Call right before sending a request. Returns False if not allowed."""
        change = None
        allowed = False
        with self._lock:
            if self._state == CLOSED:
                allowed = True
            elif self._state == OPEN:
                if (self._clock() - self._opened_at) >= self.open_seconds:
                    change = self._set_state(HALF_OPEN)
                    self._probes_in_flight = 1
                    allowed = True
            else:  # HALF_OPEN
                if self._probes_in_flight < self.half_open_max_probes:
                    self._probes_in_flight += 1
                    allowed = True
        self._notify(change)
        return allowed

    def record_success(self):
        change = None
        with self._lock:
            if self._state == CLOSED:
                self._failures = 0
            elif self._state == HALF_OPEN:
                self._probes_in_flight = max(0, self._probes_in_flight - 1)
                self._successes += 1
                if self._successes >= self.success_threshold:
                    change = self._set_state(CLOSED)
            # OPEN: late result from a request started before opening; ignore.
        self._notify(change)

    def record_failure(self):
        change = None
        with self._lock:
            if self._state == CLOSED:
                self._failures += 1
                if self._failures >= self.failure_threshold:
                    change = self._set_state(OPEN)
            elif self._state == HALF_OPEN:
                change = self._set_state(OPEN)   # trial failed: reopen
            # OPEN: ignore
        self._notify(change)

    def reset(self):
        """Force the breaker closed (e.g. from an admin action)."""
        with self._lock:
            change = self._set_state(CLOSED)
        self._notify(change)

    def snapshot(self):
        """JSON-serializable view for /stats and the dashboard."""
        with self._lock:
            retry_in = 0.0
            if self._state == OPEN:
                retry_in = max(0.0, self.open_seconds - (self._clock() - self._opened_at))
            return {
                "state": self._state,
                "consecutive_failures": self._failures,
                "retry_in": round(retry_in, 1),
                "times_opened": self._times_opened,
                "last_change": self._last_change,
            }