from flask import Flask, jsonify
import sys
import time

app = Flask(__name__)

# Get port from command line
if len(sys.argv) < 2:
    print("Usage: python app.py <port>")
    sys.exit(1)

PORT = int(sys.argv[1])

SERVER_NAME = f"Backend-{PORT}"


@app.route("/")
def home():
    return jsonify({
        "server": SERVER_NAME,
        "port": PORT,
        "message": "Hello from backend server"
    })


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "server": SERVER_NAME,
        "port": PORT
    }), 200


@app.route("/slow")
def slow():
    # Simulate a slow backend
    time.sleep(5)

    return jsonify({
        "server": SERVER_NAME,
        "port": PORT,
        "message": "Slow response completed"
    })


if __name__ == "__main__":
    print(f"Starting {SERVER_NAME} on port {PORT}")

    app.run(
        host="127.0.0.1",
        port=PORT,
        threaded=True
    )
