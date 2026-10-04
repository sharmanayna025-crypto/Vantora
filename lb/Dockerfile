FROM python:3.11-slim

WORKDIR /app

COPY algorithms.py .
COPY balancer.py .
COPY circuit_breaker.py .

EXPOSE 8080

CMD ["python", "balancer.py"]
