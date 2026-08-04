import requests
import json

base_url = 'http://localhost:8000/api'

# Login
login_res = requests.post(f"{base_url}/auth/login/", json={
    "email": "demo@msmepaytrack.com",
    "password": "demo"
})
if login_res.status_code != 200:
    login_res = requests.post(f"{base_url}/auth/login/", json={
        "email": "demo@msmepaytrack.com",
        "password": "demo1234"
    })

token = login_res.json()['data']['access']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

payload = {
    "branch_id": 1,
    "customer_name": "abc",
    "customer_phone": "9313375303",
    "payment_method": "CASH",
    "amount_received": 331,
    "discount_percentage": 8,
    "discount_amount": 0,
    "notes": "",
    "items": [
        {
            "product": 1,
            "product_name": "Test Product",
            "quantity": 1,
            "unit_price": 100,
            "tax_percentage": 18,
            "tax_amount": 18,
            "line_total": 118
        }
    ]
}

res = requests.post(f"{base_url}/billing/create-bill/", json=payload, headers=headers)
print("STATUS:", res.status_code)
if 'text/html' in res.headers.get('Content-Type', ''):
    # Extract the traceback from django debug page
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(res.text, 'html.parser')
    tb = soup.find('div', id='traceback_area')
    if tb:
        print("TRACEBACK:", tb.text[:2000])
    else:
        print(soup.find('title').text)
        print(res.text[:1000])
else:
    print(res.text)

