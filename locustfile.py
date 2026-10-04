from locust import HttpUser, task, between


class VantoraUser(HttpUser):
    wait_time = between(0.5, 1.5)

    @task
    def send_request(self):
        self.client.get("/")
