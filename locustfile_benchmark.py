from locust import HttpUser, task, constant


class VantoraBenchmarkUser(HttpUser):
    # No artificial delay between requests.
    # This allows Locust to measure maximum throughput.
    wait_time = constant(0)

    @task
    def send_request(self):
        self.client.get("/")
