import os
import sys

import django

# Set up Django environment
sys.path.append(os.path.abspath('../backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from apps.billing.views import BillViewSet
from apps.billing.serializers import BillCreateSerializer
from rest_framework.test import APIRequestFactory, force_authenticate

factory = APIRequestFactory()
request = factory.post('/api/billing/create-bill/', {
    'branch_id': 1,
    'payment_method': 'CASH',
    'customer_phone': '',
    'notes': '',
    'amount_received': 331,
    'discount_percentage': 8,
    'discount_amount': 0,
    'items': [
        {'product': 1, 'quantity': 1, 'unit_price': 100, 'line_total': 100, 'tax_amount': 18, 'tax_percentage': 18, 'discount_amount': 0, 'product_name': 'Test', 'barcode': '', 'hsn_code': ''}
    ]
}, format='json')

# We need a user.
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.first()
force_authenticate(request, user=user)

view = BillViewSet.as_view({'post': 'create_bill'})
try:
    response = view(request)
    print("Response status:", response.status_code)
    print("Response data:", response.data)
except Exception as e:
    import traceback
    traceback.print_exc()
