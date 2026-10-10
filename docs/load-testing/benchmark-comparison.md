# Vantora Load Balancing Performance Comparison

## Test Configuration

- **Date:** 10 October 2026
- **Tool:** Locust 2.34.0
- **Target:** `http://127.0.0.1:8080`
- **Request:** `GET /`
- **Concurrent users:** 20
- **Spawn rate:** 5 users per second
- **Duration:** 60 seconds per algorithm
- **Artificial wait:** None
- **Backend setup:** Three backends managed by Docker Compose

## Results

| Metric | Round Robin | Weighted Round Robin | Least Connections |
|---|---:|---:|---:|
| Total requests | 86,266 | 86,835 | 85,234 |
| Failed requests | 0 | 0 | 0 |
| Failure rate | 0% | 0% | 0% |
| Average response time | 11 ms | 11 ms | 11 ms |
| Median response time | 10 ms | 10 ms | 11 ms |
| P95 response time | 15 ms | 15 ms | 15 ms |
| P99 response time | 21 ms | 21 ms | 21 ms |
| Maximum response time | 3,200 ms | 1,015 ms | 3,011 ms |
| Throughput | 1,440.36 req/s | 1,450.02 req/s | 1,423.23 req/s |

## Observations

1. All three algorithms completed their benchmark runs with zero failed requests.
2. Weighted Round Robin recorded the highest throughput in these individual runs, at approximately 1,450 requests per second.
3. Average response times were approximately 11 ms for all three algorithms.
4. All three recorded a P95 of 15 ms and a P99 of 21 ms.
5. Maximum response times varied across runs, indicating occasional latency spikes.

## Conclusion

Under the tested conditions, all three routing algorithms handled the GET workload successfully. Weighted Round Robin recorded the highest throughput in these individual runs, but the difference was small. These results do not establish that one algorithm is universally superior.

Only one run was conducted per algorithm. Repeated runs under controlled conditions would provide a stronger comparison. This benchmark primarily measures throughput for a lightweight GET endpoint and does not establish performance under every workload.

## Raw Results

Individual Locust CSV files are stored in `benchmark-runs/`:

- `round-robin`
- `weighted-round-robin`
- `least-connections`
