from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def dashboard():
    return render_template("index.html")


if __name__ == "__main__":
    print("======================================")
    print("     Load Balancer Dashboard")
    print("======================================")
    print("Dashboard: http://localhost:5050")
    print("======================================")

    app.run(
        host="127.0.0.1",
        port=5050,
        debug=True
    )