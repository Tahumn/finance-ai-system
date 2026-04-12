import requests

def check_cors():
    url = "http://localhost:8000/api/v1/ai/anomalies"
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization"
    }
    try:
        response = requests.options(url, headers=headers)
        print(f"Status: {response.status_code}")
        print("Headers:")
        for k, v in response.headers.items():
            if "access-control" in k.lower():
                print(f"  {k}: {v}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_cors()
