import os
import matplotlib.pyplot as plt
import numpy as np

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

algorithms = [
    "Round Robin",
    "Weighted Round Robin",
    "Least Connections",
]

# Measured results from the completed Locust runs
throughput = [1440.36, 1450.02, 1423.23]
average_ms = [11, 11, 11]
p95_ms = [15, 15, 15]
p99_ms = [21, 21, 21]
successful = [86266, 86835, 85234]
failed = [0, 0, 0]


def save_bar_chart(values, title, ylabel, filename, decimals=2):
    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(algorithms, values)

    ax.set_title(title)
    ax.set_ylabel(ylabel)
    ax.grid(axis="y", linestyle="--", alpha=0.35)
    ax.set_axisbelow(True)

    for bar, value in zip(bars, values):
        ax.annotate(
            f"{value:.{decimals}f}",
            (bar.get_x() + bar.get_width() / 2, bar.get_height()),
            xytext=(0, 5),
            textcoords="offset points",
            ha="center",
        )

    plt.xticks(rotation=10, ha="right")
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=200)
    plt.close(fig)
    print(f"Created: {filename}")


# Graph 1: Throughput
save_bar_chart(
    throughput,
    "Vantora: Throughput Comparison",
    "Requests per second",
    "throughput-comparison.png",
)

# Graph 2: Response times
x = np.arange(len(algorithms))
width = 0.24

fig, ax = plt.subplots(figsize=(9, 5))
ax.bar(x - width, average_ms, width, label="Average")
ax.bar(x, p95_ms, width, label="P95")
ax.bar(x + width, p99_ms, width, label="P99")

ax.set_title("Vantora: Response Time Comparison")
ax.set_ylabel("Response time (ms)")
ax.set_xticks(x)
ax.set_xticklabels(algorithms, rotation=10, ha="right")
ax.legend()
ax.grid(axis="y", linestyle="--", alpha=0.35)
ax.set_axisbelow(True)
plt.tight_layout()
plt.savefig(
    os.path.join(OUTPUT_DIR, "response-time-comparison.png"),
    dpi=200,
)
plt.close(fig)
print("Created: response-time-comparison.png")

# Graph 3: Successful and failed requests
fig, ax = plt.subplots(figsize=(9, 5))
ax.bar(algorithms, successful, label="Successful")
ax.bar(algorithms, failed, bottom=successful, label="Failed")

ax.set_title("Vantora: Request Outcomes")
ax.set_ylabel("Number of requests")
ax.legend()
ax.grid(axis="y", linestyle="--", alpha=0.35)
ax.set_axisbelow(True)
plt.xticks(rotation=10, ha="right")
plt.tight_layout()
plt.savefig(
    os.path.join(OUTPUT_DIR, "request-outcomes.png"),
    dpi=200,
)
plt.close(fig)
print("Created: request-outcomes.png")

print("\nAll graphs saved in:", OUTPUT_DIR)
