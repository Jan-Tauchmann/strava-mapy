import json
import os
import urllib.request

STRAVA_CLIENT_ID = os.environ["STRAVA_CLIENT_ID"]
STRAVA_CLIENT_SECRET = os.environ["STRAVA_CLIENT_SECRET"]

def lambda_handler(event, context):
    try:
        body = json.loads(event.get("body", "{}"))
        code = body.get("code")

        if not code:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing authorization code"})
            }

        data = json.dumps({
            "client_id": STRAVA_CLIENT_ID,
            "client_secret": STRAVA_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code"
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://www.strava.com/oauth/token",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with urllib.request.urlopen(req) as response:
            response_body = response.read()
            return {
                "statusCode": 200,
                "body": response_body.decode("utf-8"),
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": "true"
                }
            }

    except urllib.error.HTTPError as e:
        return {
            "statusCode": e.code,
            "body": e.read().decode("utf-8")
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
