from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import threading
import time
import json

from algorithms import (
    Backend,
    RoundRobin,
    LeastConnections,
    WeightedRoundRobin
)


# ==================================================
# Configuration
# ==================================================

LB_HOST = "0.0.0.0"
LB_PORT = 8080


# ==================================================
# Circuit Breaker Event Logging
# ==================================================

def log_circuit_change(name, old_state, new_state):
    print(
        f"[CIRCUIT] {name}: "
        f"{old_state} -> {new_state}"
    )


# ==================================================
# Backend Servers
# ==================================================

backends = [
    Backend("backend-9001", 9001, weight=3),
    Backend("backend-9002", 9002, weight=2),
    Backend("backend-9003", 9003, weight=1)
]


# ==================================================
# Load Balancing Algorithms
# ==================================================

algorithms = {
    "Round Robin": RoundRobin(),
    "Least Connections": LeastConnections(),
    "Weighted Round Robin": WeightedRoundRobin()
}


# ==================================================
# Current Algorithm
# ==================================================

algorithm_name = "Least Connections"
algorithm = algorithms[algorithm_name]

algorithm_lock = threading.Lock()


# ==================================================
# Health Monitor
# ==================================================

def health_check():

    while True:

        for backend in backends:

            try:

                connection = http.client.HTTPConnection(
                    backend.host,
                    backend.port,
                    timeout=2
                )

                connection.request(
                    "GET",
                    "/health"
                )

                response = connection.getresponse()

                response.read()

                connection.close()

                # Successful health check
                if response.status == 200:

                    backend.failed_checks = 0
                    backend.successful_checks += 1

                    # Backend recovery
                    if (
                        not backend.healthy
                        and backend.successful_checks >= 2
                    ):

                        backend.healthy = True

                        print(
                            f"Backend-{backend.port} is UP"
                        )

                        backend.failed_checks = 0

                else:

                    backend.successful_checks = 0
                    backend.failed_checks += 1

                    # Mark DOWN after 3 failures
                    if (
                        backend.healthy
                        and backend.failed_checks >= 3
                    ):

                        backend.healthy = False

                        print(
                            f"Backend-{backend.port} is DOWN"
                        )

            except Exception:

                backend.successful_checks = 0
                backend.failed_checks += 1

                print(
                    f"Health check failed: "
                    f"Backend-{backend.port}"
                )

                # Mark DOWN after 3 failures
                if (
                    backend.healthy
                    and backend.failed_checks >= 3
                ):

                    backend.healthy = False

                    print(
                        f"Backend-{backend.port} is DOWN"
                    )

        time.sleep(2)


# ==================================================
# HTTP Request Handler
# ==================================================

class LoadBalancerHandler(BaseHTTPRequestHandler):


    # ==================================================
    # Send JSON Response
    # ==================================================

    def send_json(self, data, status=200):

        response = json.dumps(data).encode()

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json"
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.send_header(
            "Content-Length",
            str(len(response))
        )

        self.end_headers()

        self.wfile.write(response)


    # ==================================================
    # OPTIONS Requests
    # ==================================================

    def do_OPTIONS(self):

        self.send_response(204)

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.end_headers()


    # ==================================================
    # GET Requests
    # ==================================================

    def do_GET(self):

        # --------------------------------------------------
        # Statistics Endpoint
        # --------------------------------------------------

        if self.path == "/stats":

            stats = []

            for backend in backends:

                stats.append({
                    "server": f"Backend-{backend.port}",
                    "host": backend.host,
                    "port": backend.port,

                    "healthy": backend.healthy,

                    # Dashboard compatibility
                    "status": (
                        "UP"
                        if backend.healthy
                        else "DOWN"
                    ),

                    "active_connections":
                        backend.active_conns,

                    "total_requests":
                        backend.total_requests,

                    "errors":
                        backend.errors,

                    "avg_response_time":
                        round(
                            backend.avg_response_time,
                            4
                        ),

                    # Circuit breaker information
                    "circuit":
                        backend.breaker.snapshot()
                })

            response = {
                "algorithm": algorithm_name,
                "backends": stats
            }

            self.send_json(response)

            return


        # --------------------------------------------------
        # Algorithm GET Protection
        # --------------------------------------------------

        if self.path.startswith("/algorithm"):

            self.send_json(
                {
                    "success": False,
                    "message": "Endpoint not found"
                },
                status=404
            )

            return


        # --------------------------------------------------
        # Retry / Failover
        # --------------------------------------------------

        max_attempts = len(backends)

        attempted_backends = []


        for attempt in range(max_attempts):

            # Get currently selected algorithm
            with algorithm_lock:

                selected_algorithm = algorithm


            # Only use routable backends
            available_backends = [

                backend

                for backend in backends

                if (
                    backend.routable()
                    and backend not in attempted_backends
                )

            ]


            if not available_backends:

                break


            # Select backend
            backend = selected_algorithm.pick(
                available_backends
            )


            if backend is None:

                break


            attempted_backends.append(backend)


            # --------------------------------------------------
            # Circuit Breaker Permission
            # --------------------------------------------------

            if not backend.breaker.acquire():

                print(
                    f"Circuit breaker blocked "
                    f"Backend-{backend.port}"
                )

                continue


            breaker_recorded = False

            start_time = time.time()


            try:

                # Increase active connections
                backend.active_conns += 1


                connection = http.client.HTTPConnection(
                    backend.host,
                    backend.port,
                    timeout=10
                )


                # Forward request
                connection.request(
                    "GET",
                    self.path
                )


                response = connection.getresponse()

                response_body = response.read()


                # --------------------------------------------------
                # Circuit Breaker Result
                # --------------------------------------------------

                if response.status >= 500:

                    backend.breaker.record_failure()

                else:

                    backend.breaker.record_success()

                breaker_recorded = True


                # --------------------------------------------------
                # Statistics
                # --------------------------------------------------

                elapsed = time.time() - start_time

                backend.total_requests += 1

                backend.total_response_time += elapsed

                backend.avg_response_time = (
                    backend.total_response_time
                    / backend.total_requests
                )


                backend.active_conns = max(
                    0,
                    backend.active_conns - 1
                )


                # --------------------------------------------------
                # Send Response To Client
                # --------------------------------------------------

                self.send_response(
                    response.status
                )


                for header, value in response.getheaders():

                    if header.lower() != "connection":

                        self.send_header(
                            header,
                            value
                        )


                self.send_header(
                    "X-Served-By",
                    f"Backend-{backend.port}"
                )


                self.send_header(
                    "Access-Control-Allow-Origin",
                    "*"
                )


                self.end_headers()


                self.wfile.write(
                    response_body
                )


                connection.close()

                return


            except Exception as error:

                # --------------------------------------------------
                # Circuit Breaker Failure
                # --------------------------------------------------

                if not breaker_recorded:

                    backend.breaker.record_failure()


                backend.active_conns = max(
                    0,
                    backend.active_conns - 1
                )


                backend.errors += 1


                print(
                    f"Request failed on "
                    f"Backend-{backend.port}: "
                    f"{error}"
                )


                print(
                    f"Failover attempt "
                    f"{attempt + 1}/{max_attempts}"
                )


                try:

                    connection.close()

                except Exception:

                    pass


                # Continue to another backend
                continue


        # --------------------------------------------------
        # All Backends Failed
        # --------------------------------------------------

        self.send_json(
            {
                "error":
                    "All backend servers are unavailable"
            },
            status=503
        )


    # ==================================================
    # POST Requests
    # ==================================================

    def do_POST(self):

        # --------------------------------------------------
        # Algorithm Endpoint
        # --------------------------------------------------

        if self.path == "/algorithm":

            try:

                content_length = int(
                    self.headers.get(
                        "Content-Length",
                        0
                    )
                )


                body = self.rfile.read(
                    content_length
                )


                data = json.loads(
                    body.decode("utf-8")
                )


                requested_algorithm = data.get(
                    "algorithm"
                )


                # --------------------------------------------------
                # Validate Algorithm
                # --------------------------------------------------

                if requested_algorithm not in algorithms:

                    self.send_json(
                        {
                            "success": False,
                            "message":
                                "Invalid algorithm",
                            "available_algorithms":
                                list(algorithms.keys())
                        },
                        status=400
                    )

                    return


                # --------------------------------------------------
                # Change Algorithm
                # --------------------------------------------------

                global algorithm
                global algorithm_name


                with algorithm_lock:

                    algorithm_name = (
                        requested_algorithm
                    )

                    algorithm = algorithms[
                        requested_algorithm
                    ]


                print(
                    f"Routing algorithm changed to "
                    f"{algorithm_name}"
                )


                self.send_json(
                    {
                        "success": True,
                        "algorithm":
                            algorithm_name,
                        "message":
                            f"Routing algorithm changed "
                            f"to {algorithm_name}"
                    }
                )

                return


            except Exception as error:

                print(
                    f"Algorithm change failed: "
                    f"{error}"
                )


                self.send_json(
                    {
                        "success": False,
                        "message":
                            "Invalid request"
                    },
                    status=400
                )

                return


        # --------------------------------------------------
        # Unknown POST Endpoint
        # --------------------------------------------------

        self.send_json(
            {
                "success": False,
                "message": "Endpoint not found"
            },
            status=404
        )


# ==================================================
# Create Load Balancer Server
# ==================================================

server = ThreadingHTTPServer(
    (LB_HOST, LB_PORT),
    LoadBalancerHandler
)


# ==================================================
# Start Health Monitor
# ==================================================

health_thread = threading.Thread(
    target=health_check,
    daemon=True
)

health_thread.start()


# ==================================================
# Startup Information
# ==================================================

print("Health Monitor: ACTIVE")

print("====================================")
print("       Dynamic Load Balancer")
print("====================================")

print(
    f"Listening on "
    f"{LB_HOST}:{LB_PORT}"
)

print(
    f"Algorithm: {algorithm_name}"
)

print(
    "Circuit breaker: ACTIVE "
    "(3 failures -> OPEN, 10s cooldown)"
)

print("Backends:")

print("  - backend-9001:9001")
print("  - backend-9002:9002")
print("  - backend-9003:9003")

print("====================================")


# ==================================================
# Run Server
# ==================================================

try:

    server.serve_forever()

except KeyboardInterrupt:

    print(
        "\nStopping Load Balancer..."
    )

finally:

    server.server_close()
