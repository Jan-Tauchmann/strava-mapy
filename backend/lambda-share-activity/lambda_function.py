import json
import uuid
import os
import urllib.request
import secrets
import string
import boto3
from datetime import datetime

S3_BUCKET = os.environ.get("S3_BUCKET", "strava-mapy.com")
S3_PREFIX = os.environ.get("S3_PREFIX", "shared-data/")
SITE_DOMAIN = os.environ.get("SITE_DOMAIN", "https://strava-mapy.com")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")
MAX_LATLNGS = 50000


def _cors_headers(extra=None):
    base = {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
        "Access-Control-Max-Age": "3600",
    }
    if extra:
        base.update(extra)
    return base


def _error(status, message):
    return {
        "statusCode": status,
        "headers": _cors_headers({"Content-Type": "application/json"}),
        "body": json.dumps({"error": message}),
    }


def _validate_strava_token(auth_header):
    """Validate the Strava access token by calling /athlete."""
    req = urllib.request.Request(
        "https://www.strava.com/api/v3/athlete",
        method="GET",
        headers={
            "Authorization": auth_header,
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.getcode() == 200:
                return True
    except urllib.error.HTTPError:
        return False
    except Exception:
        return False
    return False


def handler(event, context):
    method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "POST")).upper()

    # Handle CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": _cors_headers(),
            "body": "",
        }

    # Require Authorization header
    headers_in = event.get("headers") or {}
    auth_header = headers_in.get("authorization") or headers_in.get("Authorization")
    if not auth_header:
        return _error(401, "Missing Authorization header")

    # Validate Strava token
    if not _validate_strava_token(auth_header):
        return _error(401, "Invalid or expired Strava token")

    # Parse request body
    body = event.get("body", "")
    if event.get("isBase64Encoded"):
        import base64
        body = base64.b64decode(body).decode("utf-8")

    try:
        data = json.loads(body)
    except (json.JSONDecodeError, TypeError):
        return _error(400, "Invalid JSON body")

    # Validate required fields
    latlngs = data.get("latlngs")
    if not latlngs or not isinstance(latlngs, list) or len(latlngs) < 2:
        return _error(400, "latlngs must be an array with at least 2 points")

    if len(latlngs) > MAX_LATLNGS:
        return _error(400, f"latlngs exceeds maximum of {MAX_LATLNGS} points")

    name = data.get("name", "Shared Activity")
    if not isinstance(name, str) or len(name) > 200:
        return _error(400, "name must be a string of max 200 characters")

    # Build the shared activity object
    share_id = ''.join(secrets.choice(string.ascii_lowercase) for _ in range(10))
    shared_activity = {
        "latlngs": latlngs,
        "name": name,
        "start_date_local": data.get("start_date_local", ""),
        "elapsed_time": data.get("elapsed_time", 0),
        "distance": data.get("distance", 0),
        "type": data.get("type", ""),
        "strava_activity_id": data.get("strava_activity_id"),
        "athlete_firstname": data.get("athlete_firstname", ""),
        "athlete_lastname": data.get("athlete_lastname", ""),
        "athlete_profile": data.get("athlete_profile", ""),
        "shared_at": datetime.utcnow().isoformat() + "Z",
    }

    # Write to S3
    s3 = boto3.client("s3")
    key = f"{S3_PREFIX}{share_id}.json"

    try:
        s3.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(shared_activity),
            ContentType="application/json",
        )
    except Exception as e:
        print(f"S3 write error: {e}")
        return _error(500, "Failed to save shared activity")

    share_url = f"{SITE_DOMAIN}/shared/{share_id}"

    return {
        "statusCode": 201,
        "headers": _cors_headers({"Content-Type": "application/json"}),
        "body": json.dumps({"id": share_id, "url": share_url}),
    }
