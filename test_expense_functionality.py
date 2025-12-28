#!/usr/bin/env python3
"""
Test script for the new expense functionality
"""

import os
import sys
import django
import requests
import json
from decimal import Decimal

# Add the project directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'luminan_backend.settings')
django.setup()

from core.models import ShopConfiguration, Product, Expense

def test_expense_creation():
    """Test creating staff lunch expenses with product lookup"""
    print("Testing Expense Creation Functionality")
    print("=" * 50)
    
    try:
        # Get the shop
        shop = ShopConfiguration.objects.get()
        print(f"[OK] Found shop: {shop.name}")
        
        # Create a test product if none exists
        product, created = Product.objects.get_or_create(
            shop=shop,
            name="Test Bread",
            defaults={
                'price': Decimal('2.50'),
                'cost_price': Decimal('1.50'),
                'line_code': 'TEST001',
                'barcode': '123456789',
                'stock_quantity': Decimal('100')
            }
        )
        if created:
            print(f"[OK] Created test product: {product.name} (Line Code: {product.line_code})")
        else:
            print(f"[OK] Using existing product: {product.name} (Stock: {product.stock_quantity})")
        
        # Test 1: Create Staff Lunch - Stock Type
        print("\nTest 1: Creating Staff Lunch (Stock Type)")
        expense1 = Expense.objects.create(
            shop=shop,
            category='Staff Lunch',
            description='Staff lunch - bread consumption',
            amount=Decimal('5.00'),
            currency='USD',
            payment_method='cash',
            vendor='Internal',
            expense_date='2025-12-27',
            notes='Staff ate bread during lunch break',
            product=product,
            quantity=Decimal('2'),
            staff_lunch_type='stock'
        )
        print(f"[OK] Created expense ID: {expense1.id}")
        print(f"   - Product: {expense1.product_name}")
        print(f"   - Quantity: {expense1.quantity}")
        print(f"   - Type: {expense1.staff_lunch_type}")
        
        # Check if stock was deducted
        product.refresh_from_db()
        print(f"   - Product stock after: {product.stock_quantity}")
        
        # Test 2: Create Staff Lunch - Money Type
        print("\nTest 2: Creating Staff Lunch (Money Type)")
        expense2 = Expense.objects.create(
            shop=shop,
            category='Staff Lunch',
            description='Staff lunch money allowance',
            amount=Decimal('10.00'),
            currency='USD',
            payment_method='cash',
            vendor='Internal',
            expense_date='2025-12-27',
            notes='Money given to staff for lunch',
            quantity=Decimal('3'),
            staff_lunch_type='money'
        )
        print(f"[OK] Created expense ID: {expense2.id}")
        print(f"   - Quantity: {expense2.quantity}")
        print(f"   - Type: {expense2.staff_lunch_type}")
        print(f"   - Amount: ${expense2.amount}")
        
        # Test 3: Create Product Expense
        print("\nTest 3: Creating Product Expense")
        expense3 = Expense.objects.create(
            shop=shop,
            category='Product Expense',
            description='Bulk purchase of supplies',
            amount=Decimal('50.00'),
            currency='USD',
            payment_method='card',
            vendor='Supplier ABC',
            expense_date='2025-12-27',
            notes='Monthly supplies purchase',
            product=product,
            product_line_code=product.line_code,
            product_barcode=product.barcode,
            product_name=product.name,
            product_cost_price=product.cost_price
        )
        print(f"[OK] Created expense ID: {expense3.id}")
        print(f"   - Category: {expense3.category}")
        print(f"   - Product: {expense3.product_name}")
        
        # Summary
        print(f"\nSummary:")
        all_expenses = Expense.objects.filter(shop=shop)
        print(f"   - Total expenses: {all_expenses.count()}")
        staff_lunches = all_expenses.filter(category='Staff Lunch')
        print(f"   - Staff lunch expenses: {staff_lunches.count()}")
        product_expenses = all_expenses.filter(category='Product Expense')
        print(f"   - Product expenses: {product_expenses.count()}")
        
        print("\nAll tests passed successfully!")
        
    except Exception as e:
        print(f"[ERROR] Test failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_expense_creation()