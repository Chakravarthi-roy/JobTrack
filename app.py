from flask import Flask, send_file, request, jsonify
import json
import os

app = Flask(__name__)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(BASE_DIR, "applications.json")


@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


def load_data():
    if not os.path.exists(JSON_FILE) or os.path.getsize(JSON_FILE) == 0:
        with open(JSON_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, indent=4)

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            # File exists but has bad/corrupted content — reset it instead of crashing.
            return []


def save_data(data):
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)


ALLOWED_FIELDS = {
    "role", "company", "applied", "reply",
    "status", "reached", "source", "location", "notes",
}


def validate_applications(payload):
    if not isinstance(payload, list):
        return "Expected a JSON array of application entries."

    for i, entry in enumerate(payload):
        if not isinstance(entry, dict):
            return f"Entry {i} must be an object."
        for key, value in entry.items():
            if key not in ALLOWED_FIELDS:
                return f"Entry {i} has an unexpected field: {key}."
            if value is not None and not isinstance(value, str):
                return f"Entry {i} field '{key}' must be a string."

    return None


@app.route("/")
def home():
    return send_file(os.path.join(BASE_DIR, "index.html"))


@app.route("/style.css")
def style():
    return send_file(os.path.join(BASE_DIR, "style.css"))


@app.route("/app.js")
def script():
    return send_file(os.path.join(BASE_DIR, "app.js"))


@app.route("/api/applications", methods=["GET"])
def get_applications():
    return jsonify(load_data())


@app.route("/api/applications", methods=["POST"])
def save_applications():
    data = request.get_json(silent=True)

    error = validate_applications(data)
    if error:
        return jsonify({"success": False, "error": error}), 400

    save_data(data)
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True)