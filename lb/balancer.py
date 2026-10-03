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

LB_HOST = "127.0.0.1"
LB_PORT = 8080


# ==================================================
# Backend Servers
# ==================================================

backends = [
    Backend("127.0.0.1", 9001, weight=3),
    Backend("127.0.0.1", 9002, weight=2),
    Backend("127.0.0.1", 9003, weight=1)
]


# ==================================================
# Load Balancing Algorithm
# ==================================================

# Current algorithm
algorithm = LeastConnections()


# ==================================================
# Health Monitor
# ==================================================

def health_check():

    while True:

        for backend in backends:

            try:

                # Connect to backend
                connection = http.client.HTTPConnection(
                    backend.host,
                    backend.port,
                    timeout=2
                )

                # Send health request
                connection.request(
                    "GET",
                    "/health"
                )

                # Get response
                response = connection.getresponse()

                # Read response body
                response.read()

                # Close connection
                connection.close()

                # ----------------------------------
                # Health check successful
                # ----------------------------------

                if response.status == 200:

                    # Reset failure counter
                    backend.failed_checks = 0

                    # Increase success counter
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

                    # Unexpected status
                    backend.successful_checks = 0
                    backend.failed_checks += 1

            except Exception:

                # ----------------------------------
                # Health check failed
                # ----------------------------------

                backend.successful_checks = 0
                backend.failed_checks += 1

                print(
                    f"Health check failed: "
                    f"Backend-{backend.port}"
                )

                # Mark backend DOWN after
                # 3 consecutive failures
                if (
                    backend.healthy
                    and backend.failed_checks >= 3
                ):

                    backend.healthy = False

                    print(
                        f"Backend-{backend.port} is DOWN"
                    )

        # Check again after 2 seconds
        time.sleep(2)


# ==================================================
# HTTP Request Handler
# ==================================================

class LoadBalancerHandler(BaseHTTPRequestHandler):

    # --------------------------------------------------
    # Send JSON response
    # --------------------------------------------------

    def send_json(self, data, status=200):

        response = json.dumps(data).encode()

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json"
        )

        # Allow dashboard running on port 5050
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


    # --------------------------------------------------
    # GET Requests
    # --------------------------------------------------

    def do_GET(self):

        # ==================================================
        # /stats endpoint
        # ==================================================

        if self.path == "/stats":

            stats = {
                "algorithm": "Least Connections",
                "backends": []
            }

            for backend in backends:

                # Determine backend status
                if backend.healthy:
                    status = "UP"
                else:
                    status = "DOWN"

                # Add backend statistics
                stats["backends"].append({

                    "port": backend.port,

                    "status": status,

                    "total_requests":
                        backend.total_requests,

                    "active_connections":
                        backend.active_conns,

                    "errors":
                        backend.errors,

                    "avg_response_time":
                        round(
                            backend.avg_response_time,
                            4
                        )
                })

            # Send statistics
            self.send_json(stats)

            return


        # ==================================================
        # Select a healthy backend
        # ==================================================

        backend = algorithm.pick(backends)


        # ==================================================
        # No healthy backend
        # ==================================================

        if backend is None:

            self.send_error(
                503,
                "Service Unavailable - "
                "No healthy backends"
            )

            return


        # Display selected backend
        print(
            f"Request {self.path} "
            f"→ Backend-{backend.port}"
        )


        # ==================================================
        # Forward request
        # ==================================================

        try:

            # Start response-time measurement
            start_time = time.time()

            # Increase active connections
            backend.active_conns += 1

            # Increase total request count
            backend.total_requests += 1


            # --------------------------------------------------
            # Connect to backend
            # --------------------------------------------------

            connection = http.client.HTTPConnection(
                backend.host,
                backend.port,
                timeout=10
            )


            # --------------------------------------------------
            # Forward GET request
            # --------------------------------------------------

            connection.request(
                "GET",
                self.path,
                headers={
                    "X-Forwarded-For":
                        self.client_address[0]
                }
            )


            # --------------------------------------------------
            # Receive backend response
            # --------------------------------------------------

            response = connection.getresponse()

            # Read response body
            body = response.read()


            # --------------------------------------------------
            # Send response status to client
            # --------------------------------------------------

            self.send_response(
                response.status
            )


            # --------------------------------------------------
            # Copy backend headers
            # --------------------------------------------------

            for header, value in response.getheaders():

                # Don't copy these headers
                if header.lower() not in [
                    "connection",
                    "transfer-encoding",
                    "server",
                    "date",
                    "content-length"
                ]:

                    self.send_header(
                        header,
                        value
                    )


            # --------------------------------------------------
            # Tell client which backend responded
            # --------------------------------------------------

            self.send_header(
                "X-Served-By",
                f"Backend-{backend.port}"
            )


            # Tell client body size
            self.send_header(
                "Content-Length",
                str(len(body))
            )


            # Finish headers
            self.end_headers()


            # --------------------------------------------------
            # Send response body
            # --------------------------------------------------

            self.wfile.write(body)


            # Close connection
            connection.close()


            # ==================================================
            # Response Time Statistics
            # ==================================================

            response_time = (
                time.time() - start_time
            )

            # Add response time
            backend.total_response_time += (
                response_time
            )

            # Calculate average response time
            backend.avg_response_time = (
                backend.total_response_time
                / backend.total_requests
            )


            # Display successful response
            print(
                f"Response from "
                f"Backend-{backend.port}"
            )


        # ==================================================
        # Backend Timeout
        # ==================================================

        except TimeoutError:

            # Count error
            backend.errors += 1

            print(
                f"Backend-{backend.port} "
                f"timed out"
            )

            self.send_error(
                504,
                "Gateway Timeout"
            )


        # ==================================================
        # Backend Failure
        # ==================================================

        except Exception as error:

            # Count error
            backend.errors += 1

            print(
                f"Backend-{backend.port} "
                f"failed: {error}"
            )

            self.send_error(
                502,
                "Bad Gateway"
            )


        # ==================================================
        # Always decrease active connections
        # ==================================================

        finally:

            backend.active_conns -= 1


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

print("Health Monitor: ACTIVE")


# ==================================================
# Start Load Balancer
# ==================================================

print("====================================")
print("       Dynamic Load Balancer")
print("====================================")

print(
    f"Listening on "
    f"{LB_HOST}:{LB_PORT}"
)

print("Algorithm: Least Connections")

print("Backends:")

print("  - 127.0.0.1:9001")
print("  - 127.0.0.1:9002")
print("  - 127.0.0.1:9003")

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