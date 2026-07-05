import json
import urllib.parse
import urllib.request
import os

# Customize this for production (specific origin instead of "*")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")

def _cors_headers(extra=None):
    base = {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Authorization,Content-Type",
        "Access-Control-Max-Age": "3600",
    }
    if extra:
        base.update(extra)
    return base

def handler(event, context):
    method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "GET")).upper()

    # Handle CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": _cors_headers(),
            "body": "",
        }

    # Expect activityId as a path parameter
    path_params = event.get("pathParameters") or {}
    activity_id = path_params.get("activityId")
    if not activity_id:
        return {
            "statusCode": 400,
            "headers": _cors_headers({"Content-Type": "application/json"}),
            "body": json.dumps({"error": "Missing path parameter: activityId"}),
        }

    # Forward the Authorization header as-is (required by Strava)
    headers_in = event.get("headers") or {}
    auth_header = headers_in.get("authorization") or headers_in.get("Authorization")
    if not auth_header:
        return {
            "statusCode": 400,
            "headers": _cors_headers({"Content-Type": "application/json"}),
            "body": json.dumps({"error": "Missing Authorization header (Bearer <token>)"}),
        }

    # Build upstream Strava URL
    # Base: https://www.strava.com/api/v3/activities/{activityId}/streams
    # Include all query params from the client (e.g., keys=latlng&key_by_type=true)
    qs = event.get("queryStringParameters") or {}
    query = urllib.parse.urlencode(qs, doseq=True)
    upstream_url = f"https://www.strava.com/api/v3/activities/{urllib.parse.quote(activity_id)}/streams"
    if query:
        upstream_url = f"{upstream_url}?{query}"

    # Prepare request to Strava
    req = urllib.request.Request(
        upstream_url,
        method="GET",
        headers={
            "Authorization": auth_header,
            "Accept": "application/json",
            # (Optional) You can forward the user-agent or set your own:
            "User-Agent": "aws-lambda-proxy/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body_bytes = resp.read()
            content_type = resp.headers.get("Content-Type", "application/json")
            status = resp.getcode()

            # Safely forward a few useful headers from Strava
            passthrough_headers = {}
            for h in ["Content-Type", "ETag", "Last-Modified", "Cache-Control"]:
                if resp.headers.get(h):
                    passthrough_headers[h] = resp.headers[h]

            return {
                "statusCode": status,
                "headers": _cors_headers(passthrough_headers),
                "isBase64Encoded": False,
                "body": body_bytes.decode("utf-8", errors="replace"),
            }

    except urllib.error.HTTPError as e:
        # Forward Strava error status/body where possible
        err_body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
        content_type = e.headers.get("Content-Type", "application/json") if hasattr(e, "headers") else "application/json"
        return {
            "statusCode": e.code if hasattr(e, "code") else 502,
            "headers": _cors_headers({"Content-Type": content_type}),
            "isBase64Encoded": False,
            "body": err_body or json.dumps({"error": "Upstream error"}),
        }
    except Exception as ex:
        return {
            "statusCode": 502,
            "headers": _cors_headers({"Content-Type": "application/json"}),
            "body": json.dumps({"error": "Proxy failure", "detail": str(ex)}),
        }
