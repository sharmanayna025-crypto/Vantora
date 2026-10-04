import unittest
from unittest.mock import MagicMock


class TestFailover(unittest.TestCase):

    def test_failed_backend_and_backup_backend(self):

        # Simulate two backend servers.
        first_backend = MagicMock()
        second_backend = MagicMock()

        first_backend.port = 9001
        second_backend.port = 9002

        # Simulate the first backend failing.
        first_backend_connection = MagicMock()
        first_backend_connection.request.side_effect = (
            ConnectionError("Simulated backend failure")
        )

        # Simulate the second backend succeeding.
        second_backend_connection = MagicMock()

        successful_response = MagicMock()
        successful_response.status = 200
        successful_response.read.return_value = (
            b'{"message": "Success from backup backend"}'
        )

        second_backend_connection.getresponse.return_value = (
            successful_response
        )

        # Attempt the first backend.
        with self.assertRaises(ConnectionError):
            first_backend_connection.request("GET", "/")

        # Record the failure exactly as Vantora does.
        first_backend.breaker.record_failure()

        # Failover to the second backend.
        second_backend_connection.request("GET", "/")

        response = second_backend_connection.getresponse()

        # Verify the backup backend succeeded.
        self.assertEqual(response.status, 200)

        # Verify the first backend recorded one failure.
        first_backend.breaker.record_failure.assert_called_once()

        # Verify the backup backend was actually contacted.
        second_backend_connection.request.assert_called_once_with(
            "GET",
            "/"
        )


if __name__ == "__main__":
    unittest.main()