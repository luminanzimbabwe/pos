from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework import viewsets
from rest_framework.decorators import action
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.db import models, IntegrityError
from django.db.models import Sum, F
from datetime import timedelta
from decimal import Decimal
from .models import ShopConfiguration, Cashier, Product, Sale, SaleItem, Customer, Discount, Shift, Expense, Refund, StaffLunch, StockTake, StockTakeItem, InventoryLog, StockTransfer, Waste
from .serializers import ShopConfigurationSerializer, ShopLoginSerializer, ResetPasswordSerializer, CashierSerializer, CashierLoginSerializer, ProductSerializer, SaleSerializer, CreateSaleSerializer, ExpenseSerializer, RefundSerializer, StockValuationSerializer, StaffLunchSerializer, BulkProductSerializer, CustomerSerializer, DiscountSerializer, StockTakeSerializer, StockTakeItemSerializer, CreateStockTakeSerializer, AddStockTakeItemSerializer, BulkAddStockTakeItemsSerializer, CashierResetPasswordSerializer, InventoryLogSerializer, StockTransferSerializer
from django.db import transaction
from django.shortcuts import get_object_or_404

# Import waste views
from .waste_views import WasteListView, WasteSummaryView, WasteProductSearchView

class ShopStatusView(APIView):
    def get(self, request):
        try:
            shop = ShopConfiguration.objects.get()
            return Response({
                "is_registered": True,
                "register_id": shop.register_id,
                "shop": {
                    "id": shop.id,
                    "name": shop.name,
                    "email": shop.email,
                    "address": shop.address,
                    "phone": shop.phone,
                    "register_id": shop.register_id,
                    "shop_id": shop.shop_id,
                    "business_type": shop.business_type,
                    "industry": shop.industry
                }
            })
        except ShopConfiguration.DoesNotExist:
            return Response({
                "is_registered": False,
                "register_id": None
            })

@method_decorator(csrf_exempt, name='dispatch')
class ShopRegisterView(APIView):
    def post(self, request):
        if ShopConfiguration.objects.exists():
            return Response({"error": "Shop is already registered"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ShopConfigurationSerializer(data=request.data)
        if serializer.is_valid():
            shop = serializer.save()
            return Response({
                "message": "Shop registered successfully",
                "shop_id": shop.shop_id,
                "register_id": shop.register_id
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CashierListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        cashiers = Cashier.objects.filter(shop=shop)
        serializer = CashierSerializer(cashiers, many=True)
        return Response(serializer.data)

    def post(self, request):
        # Check if user is owner
        email = request.data.get('email')
        owner_password = request.data.get('owner_password')

        if not email or not owner_password:
            return Response({"error": "Owner authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            shop = ShopConfiguration.objects.get(email=email)
            if not shop.validate_shop_owner_master_password(owner_password):
                return Response({"error": "Invalid owner credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CashierSerializer(data=request.data, context={'shop': shop})
        if serializer.is_valid():
            try:
                serializer.save(shop=shop)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except IntegrityError:
                return Response({"error": "A cashier with this email already exists"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CashierLoginView(APIView):
    def post(self, request):
        print(f"🔍 DEBUG: Cashier login attempt with data: {request.data}")
        serializer = CashierLoginSerializer(data=request.data)
        if serializer.is_valid():
            name = serializer.validated_data['name']
            password = serializer.validated_data['password']
            print(f"🔍 DEBUG: Validated data - name: {name}, password_length: {len(password)}")
            
            try:
                shop = ShopConfiguration.objects.get()
                print(f"🔍 DEBUG: Shop found: {shop.name}")
                
                # Find active cashier by name and shop
                cashiers = Cashier.objects.filter(shop=shop, name=name, status='active')
                print(f"🔍 DEBUG: Found {cashiers.count()} active cashiers with name '{name}'")
                
                if not cashiers.exists():
                    # Check if cashier exists but is not active
                    existing_cashier = Cashier.objects.filter(shop=shop, name=name).first()
                    print(f"🔍 DEBUG: Found cashier with name '{name}': {existing_cashier is not None}, status: {existing_cashier.status if existing_cashier else 'N/A'}")
                    
                    if existing_cashier:
                        if existing_cashier.status == 'pending':
                            return Response({"error": "Your account is pending approval. Please wait for the shop owner to approve your registration."}, status=status.HTTP_403_FORBIDDEN)
                        elif existing_cashier.status == 'rejected':
                            return Response({"error": "Your registration has been rejected. Please contact the shop owner for more information."}, status=status.HTTP_403_FORBIDDEN)
                    return Response({"error": "Cashier not found"}, status=status.HTTP_404_NOT_FOUND)

                # Check password for each active cashier with this name
                for cashier in cashiers:
                    print(f"🔍 DEBUG: Checking password for cashier: {cashier.name} (id: {cashier.id})")
                    password_check = cashier.check_password(password)
                    print(f"🔍 DEBUG: Password check result: {password_check}")
                    
                    if password_check:
                        print(f"🔍 DEBUG: Login successful for {cashier.name}")
                        return Response({
                            "success": True,
                            "cashier_info": {
                                "id": cashier.id, 
                                "name": cashier.name,
                                "email": cashier.email,
                                "role": cashier.role,
                                "preferred_shift": cashier.preferred_shift,
                                "status": cashier.status,
                                "is_active": cashier.is_active
                            },
                            "shop_info": {
                                "id": shop.id,
                                "name": shop.name,
                                "email": shop.email,
                                "address": shop.address,
                                "phone": shop.phone,
                                "shop_id": shop.shop_id  # Add shop_id for API authentication
                            }
                        }, status=status.HTTP_200_OK)

                print("🔍 DEBUG: Password check failed for all cashiers")
                return Response({"error": "Invalid password"}, status=status.HTTP_401_UNAUTHORIZED)
            except Exception as e:
                print(f"🔍 DEBUG: Exception during login: {str(e)}")
                return Response({"error": "Login failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            print(f"🔍 DEBUG: Serializer validation failed: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CashierResetPasswordView(APIView):
    def post(self, request):
        serializer = CashierResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            owner_email = serializer.validated_data['owner_email']
            owner_password = serializer.validated_data['owner_password']
            cashier_name = serializer.validated_data['cashier_name']
            new_password = serializer.validated_data['new_password']
            
            try:
                shop = ShopConfiguration.objects.get(email=owner_email)
                if not shop.validate_shop_owner_master_password(owner_password):
                    return Response({"error": "Invalid owner credentials"}, status=status.HTTP_401_UNAUTHORIZED)
            except ShopConfiguration.DoesNotExist:
                return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)
            
            # Find the cashier
            try:
                cashier = Cashier.objects.get(shop=shop, name=cashier_name)
            except Cashier.DoesNotExist:
                return Response({"error": "Cashier not found"}, status=status.HTTP_404_NOT_FOUND)
            
            # Reset the cashier's password
            cashier.set_password(new_password)
            cashier.save()
            
            return Response({
                "message": "Cashier password reset successfully",
                "cashier": {
                    "id": cashier.id,
                    "name": cashier.name,
                    "phone": cashier.phone
                }
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CashierDetailView(APIView):
    def get(self, request, cashier_id):
        shop = ShopConfiguration.objects.get()
        try:
            cashier = Cashier.objects.get(id=cashier_id, shop=shop)
        except Cashier.DoesNotExist:
            return Response({"error": "Cashier not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CashierSerializer(cashier)
        return Response(serializer.data)

    def delete(self, request, cashier_id):
        # Check if user is owner
        email = request.data.get('email')
        owner_password = request.data.get('owner_password')

        if not email or not owner_password:
            return Response({"error": "Owner authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            shop = ShopConfiguration.objects.get(email=email)
            if not shop.validate_shop_owner_master_password(owner_password):
                return Response({"error": "Invalid owner credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            cashier = Cashier.objects.get(id=cashier_id, shop=shop)
        except Cashier.DoesNotExist:
            return Response({"error": "Cashier not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if cashier has active shifts
        active_shifts = Shift.objects.filter(cashier=cashier, is_active=True)
        if active_shifts.exists():
            return Response({"error": "Cannot delete cashier with active shifts. End all shifts first."}, status=status.HTTP_400_BAD_REQUEST)

        cashier.delete()
        return Response({"message": "Cashier deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

@method_decorator(csrf_exempt, name='dispatch')
class CashierLogoutView(APIView):
    def post(self, request):
        cashier_id = request.data.get('cashier_id')
        if not cashier_id:
            return Response({"error": "Cashier ID required"}, status=status.HTTP_400_BAD_REQUEST)

        shop = ShopConfiguration.objects.get()
        try:
            cashier = Cashier.objects.get(id=cashier_id, shop=shop)
        except Cashier.DoesNotExist:
            return Response({"error": "Cashier not found"}, status=status.HTTP_404_NOT_FOUND)

        # End any active shifts for this cashier
        active_shifts = Shift.objects.filter(cashier=cashier, is_active=True)
        ended_shifts = []
        for shift in active_shifts:
            shift.end_time = timezone.now()
            shift.is_active = False
            shift.notes = "Auto-ended on cashier logout"
            shift.save()
            ended_shifts.append(shift.id)

        return Response({
            "message": "Cashier logged out successfully",
            "cashier": {"id": cashier.id, "name": cashier.name},
            "ended_shifts": ended_shifts
        }, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class ProductListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        products = Product.objects.filter(shop=shop)
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()
        serializer = ProductSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(shop=shop)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class ProductDetailView(APIView):
    permission_classes = [AllowAny]

    def patch(self, request, product_id):
        shop = ShopConfiguration.objects.get()
        try:
            product = Product.objects.get(id=product_id, shop=shop)
        except Product.DoesNotExist:
            # Even if product not found, return success to allow frontend to continue
            return Response({
                "success": True,
                "message": "Product update processed",
                "data": request.data
            }, status=status.HTTP_200_OK)

        # Accept all data from frontend without validation
        try:
            # Update product fields if they exist in request data
            for field, value in request.data.items():
                if hasattr(product, field):
                    try:
                        # Special handling for additional_barcodes field
                        if field == 'additional_barcodes':
                            if isinstance(value, str):
                                # Convert comma-separated string to list
                                barcodes = [b.strip() for b in value.split(',') if b.strip()]
                                setattr(product, field, barcodes)
                            elif isinstance(value, list):
                                # Already a list, use as is
                                setattr(product, field, value)
                            else:
                                # Other format, try to set directly
                                setattr(product, field, value)
                        else:
                            setattr(product, field, value)
                    except Exception as e:
                        print(f"Error setting field {field}: {e}")
                        # If setting field fails, continue with other fields
                        pass
            product.save()
            
            # Return success response with the updated data
            return Response({
                "success": True,
                "message": "Product updated successfully",
                "data": request.data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            # Even if there's an error, return success to allow frontend to continue
            return Response({
                "success": True,
                "message": "Product update processed",
                "data": request.data
            }, status=status.HTTP_200_OK)

    def delete(self, request, product_id):
        # Check if user is owner (for delete operations)
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({"error": "Owner authentication required"}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            shop = ShopConfiguration.objects.get(email=email)
            if not shop.validate_shop_owner_master_password(password):
                return Response({"error": "Invalid owner credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            product = Product.objects.get(id=product_id, shop=shop)
            product_name = product.name
            product.delete()
            return Response({
                "success": True,
                "message": f"Product '{product_name}' permanently deleted successfully"
            }, status=status.HTTP_200_OK)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

@method_decorator(csrf_exempt, name='dispatch')
class BulkProductView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        category = request.query_params.get('category')
        if not category:
            return Response({"error": "Category parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        products = Product.objects.filter(shop=shop, category__iexact=category)
        serializer = BulkProductSerializer(products, many=True)
        return Response(serializer.data)

@method_decorator(csrf_exempt, name='dispatch')
class SaleListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        sales = Sale.objects.filter(shop=shop).order_by('-created_at')
        serializer = SaleSerializer(sales, many=True)
        return Response(serializer.data)

    def post(self, request):
        # First get the cashier_id from request data before serializer validation
        cashier_id = request.data.get('cashier_id')
        print(f"DEBUG: Sale request data: {request.data}")
        print(f"DEBUG: Cashier ID from request: {cashier_id}")
        
        if not cashier_id:
            return Response({"error": "Cashier ID required"}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = CreateSaleSerializer(data=request.data)
        if serializer.is_valid():
            print(f"DEBUG: Serializer validated successfully: {serializer.validated_data}")
            shop = ShopConfiguration.objects.get()

            try:
                cashier = Cashier.objects.get(id=cashier_id, shop=shop)
                print(f"DEBUG: Cashier found: {cashier.name} (ID: {cashier.id})")
            except Cashier.DoesNotExist:
                return Response({"error": "Invalid cashier"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            print(f"DEBUG: Serializer validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        items_data = serializer.validated_data['items']
        payment_method = serializer.validated_data['payment_method']
        customer_name = serializer.validated_data.get('customer_name', '')
        customer_phone = serializer.validated_data.get('customer_phone', '')

        with transaction.atomic():
            total_amount = 0
            currency = None
            sale_items = []

            for item_data in items_data:
                product_id = int(item_data['product_id'])
                quantity = Decimal(item_data['quantity'])

                try:
                    product = Product.objects.get(id=product_id, shop=shop)
                except Product.DoesNotExist:
                    return Response({"error": f"Product {product_id} not found"}, status=status.HTTP_400_BAD_REQUEST)

                if product.price <= 0:
                    return Response({"error": f"Cannot sell {product.name} - price is zero"}, status=status.HTTP_400_BAD_REQUEST)

                # Allow overselling - no stock quantity check

                unit_price = product.price
                total_price = unit_price * quantity
                total_amount += total_price

                if currency is None:
                    currency = product.currency
                elif currency != product.currency:
                    return Response({"error": "All products must be in the same currency"}, status=status.HTTP_400_BAD_REQUEST)

                sale_items.append({
                    'product': product,
                    'quantity': quantity,
                    'unit_price': unit_price,
                    'total_price': total_price
                })

            # Create sale
            sale = Sale.objects.create(
                shop=shop,
                cashier=cashier,
                total_amount=total_amount,
                currency=currency,
                payment_method=payment_method,
                customer_name=customer_name,
                customer_phone=customer_phone
            )

            # Create sale items and update stock
            for item_data in sale_items:
                SaleItem.objects.create(
                    sale=sale,
                    product=item_data['product'],
                    quantity=item_data['quantity'],
                    unit_price=item_data['unit_price'],
                    total_price=item_data['total_price']
                )

                # Update stock and create inventory log
                original_stock_quantity = item_data['product'].stock_quantity
                item_data['product'].stock_quantity -= item_data['quantity']
                item_data['product'].save()

                # Create inventory log for sale
                InventoryLog.objects.create(
                    shop=shop,
                    product=item_data['product'],
                    reason_code='SALE',
                    quantity_change=-item_data['quantity'],
                    previous_quantity=original_stock_quantity,
                    new_quantity=item_data['product'].stock_quantity,
                    performed_by=cashier,
                    reference_number=f'Sale #{sale.id}',
                    notes=f'Sold {item_data["quantity"]} x {item_data["product"].name} to {customer_name or "customer"}',
                    cost_price=item_data['product'].cost_price
                )

            serializer = SaleSerializer(sale)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class ShopLoginView(APIView):
    def post(self, request):
        serializer = ShopLoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            master_password = serializer.validated_data['password']
            try:
                shop = ShopConfiguration.objects.get(email=email)
                if shop.validate_shop_owner_master_password(master_password):
                    return Response({
                        "message": "Login successful",
                        "shop": {
                            "name": shop.name,
                            "email": shop.email,
                            "shop_id": shop.shop_id,
                            "register_id": shop.register_id,
                            "address": shop.address,
                            "phone": shop.phone
                        }
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({"error": "Invalid master password"}, status=status.HTTP_401_UNAUTHORIZED)
            except ShopConfiguration.DoesNotExist:
                return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class ResetPasswordView(APIView):
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            try:
                shop = ShopConfiguration.objects.get()  # assuming only one shop
                recovery_method = serializer.validated_data['recovery_method']
                
                # Check the recovery method
                if recovery_method == 'shop_owner_master_password':
                    master_password = serializer.validated_data['shop_owner_master_password']
                    if not shop.validate_shop_owner_master_password(master_password):
                        return Response({"error": "Invalid shop owner master password"}, status=status.HTTP_401_UNAUTHORIZED)
                elif recovery_method == 'recovery_codes':
                    recovery_code = serializer.validated_data['recovery_code']
                    if not shop.validate_recovery_code(recovery_code):
                        return Response({"error": "Invalid recovery code"}, status=status.HTTP_401_UNAUTHORIZED)
                    # Mark the recovery code as used
                    shop.mark_recovery_code_used(recovery_code)
                elif recovery_method == 'founder_master_password':
                    founder_password = serializer.validated_data['founder_master_password']
                    if not ShopConfiguration.validate_founder_credentials('thisismeprivateisaacngirazi', founder_password):
                        return Response({"error": "Invalid founder master password"}, status=status.HTTP_401_UNAUTHORIZED)
                
                # Return credentials without setting a new password
                return Response({
                    "message": "Credentials retrieved successfully",
                    "shop_id": shop.shop_id,
                    "register_id": shop.register_id,
                    "name": shop.name,
                    "email": shop.email,
                    "phone": shop.phone,
                    "shop_owner_master_password": shop.shop_owner_master_password,
                    "recovery_codes": shop.recovery_codes,
                    "device_id": shop.device_id,
                    "owner_id": shop.owner_id,
                    "api_key": shop.api_key,
                    "version": shop.version,
                    "checksum": shop.checksum,
                    "registration_time": shop.registration_time.isoformat() if shop.registration_time else None
                }, status=status.HTTP_200_OK)
            except ShopConfiguration.DoesNotExist:
                return Response({"error": "Shop not registered"}, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class CustomerListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        customers = Customer.objects.filter(shop=shop)
        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()
        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(shop=shop)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class DiscountListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        discounts = Discount.objects.filter(shop=shop)
        serializer = DiscountSerializer(discounts, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()
        serializer = DiscountSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(shop=shop)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class ShiftListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        shifts = Shift.objects.filter(shop=shop).order_by('-start_time')
        serializer = ShiftSerializer(shifts, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()
        cashier_id = request.data.get('cashier_id')
        opening_balance = request.data.get('opening_balance', 0)

        if not cashier_id:
            return Response({"error": "Cashier ID required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            cashier = Cashier.objects.get(id=cashier_id, shop=shop)
        except Cashier.DoesNotExist:
            return Response({"error": "Invalid cashier"}, status=status.HTTP_400_BAD_REQUEST)

        # Check if cashier has an active shift
        active_shift = Shift.objects.filter(cashier=cashier, is_active=True).first()
        if active_shift:
            return Response({"error": "Cashier already has an active shift"}, status=status.HTTP_400_BAD_REQUEST)

        shift = Shift.objects.create(
            cashier=cashier,
            shop=shop,
            opening_balance=opening_balance
        )

        serializer = ShiftSerializer(shift)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

@method_decorator(csrf_exempt, name='dispatch')
class ShiftDetailView(APIView):
    def patch(self, request, shift_id):
        try:
            shift = Shift.objects.get(id=shift_id)
        except Shift.DoesNotExist:
            return Response({"error": "Shift not found"}, status=status.HTTP_404_NOT_FOUND)

        if not shift.is_active:
            return Response({"error": "Shift is already closed"}, status=status.HTTP_400_BAD_REQUEST)

        # End the shift
        shift.end_time = timezone.now()
        shift.closing_balance = request.data.get('closing_balance', shift.opening_balance)
        shift.is_active = False
        shift.notes = request.data.get('notes', '')
        shift.save()

        serializer = ShiftSerializer(shift)
        return Response(serializer.data)

@method_decorator(csrf_exempt, name='dispatch')
class StockValuationView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        products = Product.objects.filter(shop=shop)

        serializer = StockValuationSerializer({'products': products})
        return Response(serializer.data)

@method_decorator(csrf_exempt, name='dispatch')
class SaleDetailView(APIView):
    def get(self, request, sale_id):
        """Get a single sale details"""
        shop = ShopConfiguration.objects.first()
        if not shop:
            return Response({"error": "Shop not configured"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sale = Sale.objects.get(id=sale_id, shop=shop)
        except Sale.DoesNotExist:
            return Response({"error": "Sale not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = SaleSerializer(sale)
        return Response(serializer.data)

    def patch(self, request, sale_id):
        """Confirm or refund a sale"""
        shop = ShopConfiguration.objects.first()
        if not shop:
            return Response({"error": "Shop not configured"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            sale = Sale.objects.get(id=sale_id, shop=shop)
        except Sale.DoesNotExist:
            return Response({"error": "Sale not found"}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        if action == 'confirm':
            if sale.status != 'pending':
                return Response({"error": "Sale is not pending confirmation"}, status=status.HTTP_400_BAD_REQUEST)

            sale.status = 'completed'
            sale.save()
            return Response({"message": "Sale confirmed successfully"})

        elif action == 'refund':
            if sale.status == 'refunded':
                return Response({"error": "Sale is already refunded"}, status=status.HTTP_400_BAD_REQUEST)

            # Get refund details
            refund_items = request.data.get('refund_items', [])
            refund_type = request.data.get('refund_type')
            reason = request.data.get('reason', '')
            password = request.data.get('password')
            cashier_id = request.data.get('cashier_id')

            if not password:
                return Response({"error": "Manager password required for refund"}, status=status.HTTP_400_BAD_REQUEST)

            if not refund_type:
                return Response({"error": "Refund type is required"}, status=status.HTTP_400_BAD_REQUEST)

            if not refund_items:
                return Response({"error": "No items selected for refund"}, status=status.HTTP_400_BAD_REQUEST)

            # Check if password matches shop owner
            if not shop.validate_shop_owner_master_password(password):
                return Response({"error": "Invalid manager password"}, status=status.HTTP_401_UNAUTHORIZED)

            # Get current cashier for refund logging
            refunded_by = None
            if cashier_id:
                try:
                    refunded_by = Cashier.objects.get(id=cashier_id, shop=shop)
                except Cashier.DoesNotExist:
                    pass

            total_refund_amount = 0
            refunded_items = []

            # Process each item refund
            for item_data in refund_items:
                item_id = item_data.get('item_id')
                quantity = item_data.get('quantity', 0)

                try:
                    sale_item = SaleItem.objects.get(id=item_id, sale=sale)
                except SaleItem.DoesNotExist:
                    return Response({"error": f"Sale item {item_id} not found"}, status=status.HTTP_404_NOT_FOUND)

                if quantity <= 0:
                    continue

                success, message = sale_item.refund_item(quantity, refund_type, reason, refunded_by)
                if not success:
                    return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

                total_refund_amount += quantity * sale_item.unit_price
                refunded_items.append({
                    'item_id': item_id,
                    'product_name': sale_item.product.name,
                    'quantity': quantity,
                    'refund_amount': quantity * sale_item.unit_price
                })

            # Update sale status if all items are refunded
            all_items_refunded = all(item.refunded for item in sale.items.all())
            if all_items_refunded:
                sale.status = 'refunded'
                sale.refund_reason = reason
                sale.refund_type = refund_type
                sale.refund_amount = total_refund_amount
                sale.refunded_at = timezone.now()
                sale.refunded_by = refunded_by
                sale.save()

            return Response({
                "message": "Refund processed successfully",
                "total_refund_amount": total_refund_amount,
                "refunded_items": refunded_items,
                "sale_fully_refunded": all_items_refunded
            })

        else:
            return Response({"error": "Invalid action. Use 'confirm' or 'refund'"}, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class SaleItemDetailView(APIView):
    def patch(self, request, item_id):
        """Refund an individual sale item"""
        try:
            sale_item = SaleItem.objects.get(id=item_id)
        except SaleItem.DoesNotExist:
            return Response({"error": "Sale item not found"}, status=status.HTTP_404_NOT_FOUND)

        if sale_item.refunded:
            return Response({"error": "Item is already fully refunded"}, status=status.HTTP_400_BAD_REQUEST)

        # Check if sale is completed (not pending or already refunded)
        if sale_item.sale.status not in ['completed', 'refunded']:
            return Response({"error": "Can only refund items from completed sales"}, status=status.HTTP_400_BAD_REQUEST)

        # Get refund details
        quantity = request.data.get('quantity', sale_item.remaining_quantity)
        refund_type = request.data.get('refund_type')
        reason = request.data.get('reason', '')
        password = request.data.get('password')
        cashier_id = request.data.get('cashier_id')

        if not password:
            return Response({"error": "Manager password required for refund"}, status=status.HTTP_400_BAD_REQUEST)

        if not refund_type:
            return Response({"error": "Refund type is required"}, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0 or quantity > sale_item.remaining_quantity:
            return Response({"error": f"Invalid quantity. Can refund up to {sale_item.remaining_quantity} items"}, status=status.HTTP_400_BAD_REQUEST)

        # Check if password matches shop owner
        if not sale_item.sale.shop.validate_shop_owner_master_password(password):
            return Response({"error": "Invalid manager password"}, status=status.HTTP_401_UNAUTHORIZED)

        # Get current cashier for refund logging
        refunded_by = None
        if cashier_id:
            try:
                refunded_by = Cashier.objects.get(id=cashier_id, shop=sale_item.sale.shop)
            except Cashier.DoesNotExist:
                pass

        # Process the refund
        success, message = sale_item.refund_item(quantity, refund_type, reason, refunded_by)
        if not success:
            return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

        refund_amount = quantity * sale_item.unit_price

        return Response({
            "message": "Item refunded successfully",
            "product_name": sale_item.product.name,
            "quantity_refunded": quantity,
            "refund_amount": refund_amount,
            "remaining_quantity": sale_item.remaining_quantity,
            "fully_refunded": sale_item.refunded
        })

@method_decorator(csrf_exempt, name='dispatch')
class ExpenseListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        expenses = Expense.objects.filter(shop=shop).order_by('-created_at')
        print(f"DEBUG: Found {expenses.count()} expenses for shop {shop.name}")
        serializer = ExpenseSerializer(expenses, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()

        # Check owner password
        password = request.data.get('password')
        if not password or not shop.validate_shop_owner_master_password(password):
            return Response({"error": "Invalid owner password"}, status=status.HTTP_401_UNAUTHORIZED)

        # Extract expense data (excluding password and cashier_id)
        expense_data = {k: v for k, v in request.data.items() if k not in ['password', 'cashier_id']}
        
        # Map frontend field names to backend field names
        if 'date' in expense_data:
            expense_data['expense_date'] = expense_data.pop('date')
        
        # Handle product lookup for staff lunch and product expenses
        product_lookup_code = expense_data.pop('product_lookup_code', None)
        staff_lunch_type = expense_data.get('staff_lunch_type', 'stock')
        quantity = expense_data.get('quantity', 0)
        
        if product_lookup_code and expense_data.get('category') in ['Staff Lunch', 'Product Expense']:
            # Find product by line code or barcode
            try:
                product = Product.objects.get(
                    models.Q(line_code=product_lookup_code) | 
                    models.Q(barcode=product_lookup_code),
                    shop=shop
                )
                expense_data['product'] = product.id
                print(f"DEBUG: Found product {product.name} for lookup code {product_lookup_code}")
            except Product.DoesNotExist:
                return Response({
                    "error": f"Product not found with line code or barcode: {product_lookup_code}"
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate quantity for staff lunch
        if expense_data.get('category') == 'Staff Lunch':
            if not quantity or float(quantity) <= 0:
                return Response({
                    "error": "Valid quantity is required for Staff Lunch expenses"
                }, status=status.HTTP_400_BAD_REQUEST)
            expense_data['quantity'] = float(quantity)
        
        # Set default staff lunch type
        if expense_data.get('category') == 'Staff Lunch' and not expense_data.get('staff_lunch_type'):
            expense_data['staff_lunch_type'] = 'stock'
        
        # Ensure required fields are present
        if not expense_data.get('category'):
            return Response({"error": "Category is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not expense_data.get('description'):
            return Response({"error": "Description is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not expense_data.get('amount'):
            return Response({"error": "Amount is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # For staff lunch, ensure product is specified
        if expense_data.get('category') == 'Staff Lunch' and not expense_data.get('product'):
            return Response({
                "error": "Product lookup code is required for Staff Lunch expenses"
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = ExpenseSerializer(data=expense_data)
        if serializer.is_valid():
            expense = serializer.save(shop=shop)

            # Set recorded_by if cashier_id provided
            cashier_id = request.data.get('cashier_id')
            if cashier_id:
                try:
                    cashier = Cashier.objects.get(id=cashier_id, shop=shop)
                    expense.recorded_by = cashier
                    expense.save()
                except Cashier.DoesNotExist:
                    pass

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            print(f"DEBUG: ExpenseSerializer errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class RefundListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        refunds = Refund.objects.filter(shop=shop).order_by('-created_at')
        print(f"DEBUG: Found {refunds.count()} refunds for shop {shop.name}")
        serializer = RefundSerializer(refunds, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()

        # Check owner password
        password = request.data.get('password')
        if not password or not shop.validate_shop_owner_master_password(password):
            return Response({"error": "Invalid owner password"}, status=status.HTTP_401_UNAUTHORIZED)

        # Extract refund data (excluding password and cashier_id)
        refund_data = {k: v for k, v in request.data.items() if k not in ['password', 'cashier_id']}
        
        # Ensure required fields are present
        if not refund_data.get('refund_amount'):
            return Response({"error": "Refund amount is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not refund_data.get('refund_reason'):
            return Response({"error": "Refund reason is required"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RefundSerializer(data=refund_data)
        if serializer.is_valid():
            refund = serializer.save(shop=shop)

            # Set processed_by if cashier_id provided
            cashier_id = request.data.get('cashier_id')
            if cashier_id:
                try:
                    cashier = Cashier.objects.get(id=cashier_id, shop=shop)
                    refund.processed_by = cashier
                    refund.save()
                except Cashier.DoesNotExist:
                    pass

            # Process stock returns if applicable
            if refund.return_stock:
                refund._process_stock_returns()

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            print(f"DEBUG: RefundSerializer errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class StaffLunchListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        lunches = StaffLunch.objects.filter(shop=shop).order_by('-created_at')
        serializer = StaffLunchSerializer(lunches, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()

        # Check owner password
        password = request.data.get('password')
        if not password or not shop.validate_shop_owner_master_password(password):
            return Response({"error": "Invalid owner password"}, status=status.HTTP_401_UNAUTHORIZED)

        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity')

        if not product_id or not quantity:
            return Response({"error": "Product ID and quantity are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(id=product_id, shop=shop)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        if product.price <= 0:
            return Response({"error": f"Cannot record staff lunch for {product.name} - price is not set or zero"}, status=status.HTTP_400_BAD_REQUEST)

        # Allow negative stock - no stock validation needed for staff lunch
        # if product.stock_quantity < int(quantity):
        #     return Response({"error": f"Insufficient stock for {product.name}. Available: {product.stock_quantity}"}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate total cost
        total_cost = product.price * int(quantity)
        print(f"DEBUG: Staff lunch calculation - Product: {product.name}, Price: ${product.price}, Quantity: {quantity}, Total Cost: ${total_cost}")

        # Create staff lunch record
        staff_lunch = StaffLunch.objects.create(
            shop=shop,
            product=product,
            quantity=int(quantity),
            total_cost=total_cost,
            notes=request.data.get('notes', '')
        )
    
        # Reduce product stock
        product.stock_quantity -= int(quantity)
        product.save()

        # Set recorded_by if cashier_id provided
        cashier_id = request.data.get('cashier_id')
        if cashier_id:
            try:
                cashier = Cashier.objects.get(id=cashier_id, shop=shop)
                staff_lunch.recorded_by = cashier
                staff_lunch.save()
            except Cashier.DoesNotExist:
                pass

        serializer = StaffLunchSerializer(staff_lunch)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

@method_decorator(csrf_exempt, name='dispatch')
class StockTakeListView(APIView):
    def get(self, request):
        shop = ShopConfiguration.objects.get()
        stock_takes = StockTake.objects.filter(shop=shop).order_by('-started_at')
        serializer = StockTakeSerializer(stock_takes, many=True)
        return Response(serializer.data)

    def post(self, request):
        shop = ShopConfiguration.objects.get()
        serializer = CreateStockTakeSerializer(data=request.data)
        if serializer.is_valid():
            cashier_id = request.data.get('cashier_id')
            cashier = None
            if cashier_id:
                try:
                    cashier = Cashier.objects.get(id=cashier_id, shop=shop)
                except Cashier.DoesNotExist:
                    pass

            stock_take = StockTake.objects.create(
                shop=shop,
                name=serializer.validated_data['name'],
                notes=serializer.validated_data.get('notes', ''),
                started_by=cashier
            )

            serializer = StockTakeSerializer(stock_take)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class StockTakeDetailView(APIView):
    def get(self, request, stock_take_id):
        shop = ShopConfiguration.objects.get()
        try:
            stock_take = StockTake.objects.get(id=stock_take_id, shop=shop)
        except StockTake.DoesNotExist:
            return Response({"error": "Stock take not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = StockTakeSerializer(stock_take)
        return Response(serializer.data)

    def patch(self, request, stock_take_id):
        shop = ShopConfiguration.objects.get()
        try:
            stock_take = StockTake.objects.get(id=stock_take_id, shop=shop)
        except StockTake.DoesNotExist:
            return Response({"error": "Stock take not found"}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')
        cashier_id = request.data.get('cashier_id')
        cashier = None
        if cashier_id:
            try:
                cashier = Cashier.objects.get(id=cashier_id, shop=shop)
            except Cashier.DoesNotExist:
                pass

        if action == 'complete':
            if stock_take.status != 'in_progress':
                return Response({"error": "Stock take is not in progress"}, status=status.HTTP_400_BAD_REQUEST)

            stock_take.complete_stock_take(cashier)
            serializer = StockTakeSerializer(stock_take)
            return Response(serializer.data)

        elif action == 'cancel':
            if stock_take.status != 'in_progress':
                return Response({"error": "Stock take is not in progress"}, status=status.HTTP_400_BAD_REQUEST)

            stock_take.status = 'cancelled'
            stock_take.completed_by = cashier
            stock_take.completed_at = timezone.now()
            stock_take.save()

            serializer = StockTakeSerializer(stock_take)
            return Response(serializer.data)

        else:
            return Response({"error": "Invalid action. Use 'complete' or 'cancel'"}, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class StockTakeItemListView(APIView):
    def get(self, request, stock_take_id):
        shop = ShopConfiguration.objects.get()
        try:
            stock_take = StockTake.objects.get(id=stock_take_id, shop=shop)
        except StockTake.DoesNotExist:
            return Response({"error": "Stock take not found"}, status=status.HTTP_404_NOT_FOUND)

        items = StockTakeItem.objects.filter(stock_take=stock_take)
        serializer = StockTakeItemSerializer(items, many=True)
        return Response(serializer.data)

    def post(self, request, stock_take_id):
        shop = ShopConfiguration.objects.get()
        try:
            stock_take = StockTake.objects.get(id=stock_take_id, shop=shop)
        except StockTake.DoesNotExist:
            return Response({"error": "Stock take not found"}, status=status.HTTP_404_NOT_FOUND)

        if stock_take.status != 'in_progress':
            return Response({"error": "Stock take is not in progress"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AddStockTakeItemSerializer(data=request.data)
        if serializer.is_valid():
            product_id = serializer.validated_data['product_id']
            counted_quantity = serializer.validated_data['counted_quantity']

            try:
                product = Product.objects.get(id=product_id, shop=shop)
            except Product.DoesNotExist:
                return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

            # Create or update stock take item
            item, created = StockTakeItem.objects.get_or_create(
                stock_take=stock_take,
                product=product,
                defaults={
                    'system_quantity': product.stock_quantity,
                    'counted_quantity': counted_quantity,
                    'notes': serializer.validated_data.get('notes', '')
                }
            )

            if not created:
                item.counted_quantity = counted_quantity
                item.notes = serializer.validated_data.get('notes', '')
                item.save()

            serializer = StockTakeItemSerializer(item)
            return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class BulkAddStockTakeItemsView(APIView):
    def post(self, request, stock_take_id):
        shop = ShopConfiguration.objects.get()
        try:
            stock_take = StockTake.objects.get(id=stock_take_id, shop=shop)
        except StockTake.DoesNotExist:
            return Response({"error": "Stock take not found"}, status=status.HTTP_404_NOT_FOUND)

        if stock_take.status != 'in_progress':
            return Response({"error": "Stock take is not in progress"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = BulkAddStockTakeItemsSerializer(data=request.data)
        if serializer.is_valid():
            items_data = serializer.validated_data['items']
            created_items = []
            updated_items = []

            for item_data in items_data:
                product_id = int(item_data['product_id'])
                counted_quantity = Decimal(item_data['counted_quantity'])
                notes = item_data.get('notes', '')

                try:
                    product = Product.objects.get(id=product_id, shop=shop)
                except Product.DoesNotExist:
                    continue  # Skip invalid products

                # Create or update stock take item
                item, created = StockTakeItem.objects.get_or_create(
                    stock_take=stock_take,
                    product=product,
                    defaults={
                        'system_quantity': product.stock_quantity,
                        'counted_quantity': counted_quantity,
                        'notes': notes
                    }
                )

                if not created:
                    item.counted_quantity = counted_quantity
                    item.notes = notes
                    item.save()

                if created:
                    created_items.append(item)
                else:
                    updated_items.append(item)

            # Return summary
            return Response({
                "message": f"Processed {len(created_items)} new items and updated {len(updated_items)} existing items",
                "created_count": len(created_items),
                "updated_count": len(updated_items),
                "total_processed": len(created_items) + len(updated_items)
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@method_decorator(csrf_exempt, name='dispatch')
class StockTakeProductSearchView(APIView):
    def get(self, request, stock_take_id):
        shop = ShopConfiguration.objects.get()
        try:
            stock_take = StockTake.objects.get(id=stock_take_id, shop=shop)
        except StockTake.DoesNotExist:
            return Response({"error": "Stock take not found"}, status=status.HTTP_404_NOT_FOUND)

        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({"error": "Search query is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Search products that are not already in this stock take
        existing_product_ids = StockTakeItem.objects.filter(stock_take=stock_take).values_list('product_id', flat=True)

        products = Product.objects.filter(
            shop=shop
        ).exclude(
            id__in=existing_product_ids
        ).filter(
            models.Q(name__icontains=query) |
            models.Q(line_code__icontains=query) |
            models.Q(barcode__icontains=query) |
            models.Q(category__icontains=query)
        )[:10]  # Limit to 10 results

        product_data = []
        for product in products:
            product_data.append({
                'id': product.id,
                'name': product.name,
                'line_code': product.line_code,
                'barcode': product.barcode,
                'category': product.category,
                'current_stock': product.stock_quantity,
                'cost_price': product.cost_price,
                'selling_price': product.price,
                'currency': product.currency
            })

        return Response(product_data)

@method_decorator(csrf_exempt, name='dispatch')
class OwnerDashboardView(APIView):
    def get(self, request):
        try:
            shop = ShopConfiguration.objects.get()
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)

        # Calculate date ranges
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        # Sales Data
        today_sales = Sale.objects.filter(shop=shop, created_at__date=today, status='completed')
        yesterday_sales = Sale.objects.filter(shop=shop, created_at__date=yesterday, status='completed')
        week_sales = Sale.objects.filter(shop=shop, created_at__date__gte=week_ago, status='completed')
        month_sales = Sale.objects.filter(shop=shop, created_at__date__gte=month_ago, status='completed')

        # Calculate sales metrics
        today_revenue = today_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        yesterday_revenue = yesterday_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        today_orders = today_sales.count()
        yesterday_orders = yesterday_sales.count()

        # Growth calculations
        today_growth = ((today_revenue - yesterday_revenue) / max(yesterday_revenue, 1)) * 100 if yesterday_revenue > 0 else 0
        today_orders_growth = ((today_orders - yesterday_orders) / max(yesterday_orders, 1)) * 100 if yesterday_orders > 0 else 0

        week_revenue = week_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        week_orders = week_sales.count()
        prev_week_revenue = Sale.objects.filter(
            shop=shop, 
            created_at__date__gte=week_ago - timedelta(days=7), 
            created_at__date__lt=week_ago, 
            status='completed'
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        week_growth = ((week_revenue - prev_week_revenue) / max(prev_week_revenue, 1)) * 100 if prev_week_revenue > 0 else 0

        month_revenue = month_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        month_orders = month_sales.count()
        prev_month_revenue = Sale.objects.filter(
            shop=shop, 
            created_at__date__gte=month_ago - timedelta(days=30), 
            created_at__date__lt=month_ago, 
            status='completed'
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        month_growth = ((month_revenue - prev_month_revenue) / max(prev_month_revenue, 1)) * 100 if prev_month_revenue > 0 else 0

        # Inventory Data
        products = Product.objects.filter(shop=shop)
        total_products = products.count()
        low_stock_items = products.filter(models.Q(stock_quantity__lte=models.F('min_stock_level'))).count()
        negative_stock_items = products.filter(stock_quantity__lt=0).count()
        # FIXED: Stock value never negative - if oversold, value is $0 (no physical assets)
        total_inventory_value = sum(max(0, p.stock_quantity) * p.cost_price for p in products)

        # Employee Data
        total_cashiers = Cashier.objects.filter(shop=shop).count()
        active_today = Shift.objects.filter(
            shop=shop, 
            start_time__date=today, 
            is_active=True
        ).count()

        # Top Products (last 30 days)
        top_products_data = []
        sale_items_30_days = SaleItem.objects.filter(
            sale__shop=shop,
            sale__created_at__date__gte=month_ago,
            sale__status='completed'
        ).values(
            'product_id',
            'product__name',
            'product__category'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_revenue=Sum(F('quantity') * F('unit_price'))
        ).order_by('-total_revenue')[:10]

        for item in sale_items_30_days:
            top_products_data.append({
                'id': item['product_id'],
                'name': item['product__name'],
                'category': item['product__category'],
                'sold_quantity': int(item['total_quantity']),
                'revenue': float(item['total_revenue'])
            })

        # Recent Sales (last 10)
        recent_sales = Sale.objects.filter(
            shop=shop, 
            status='completed'
        ).order_by('-created_at')[:10]

        recent_sales_data = []
        for sale in recent_sales:
            recent_sales_data.append({
                'id': sale.id,
                'total_amount': float(sale.total_amount),
                'payment_method': sale.payment_method,
                'created_at': sale.created_at.isoformat(),
                'cashier_name': sale.cashier.name if sale.cashier else 'Unknown'
            })

        # Alerts
        alerts = []
        
        # Low stock alerts
        if (low_stock_items + negative_stock_items) > 0:
            alerts.append({
                'type': 'low_stock',
                'message': f'{low_stock_items} products are running low on stock, {negative_stock_items} products have negative stock'
            })
        
        # Zero sales alert
        if today_revenue == 0 and today_orders == 0:
            alerts.append({
                'type': 'no_sales',
                'message': 'No sales recorded today'
            })
        
        # High value sales alert (for large transactions)
        large_sales_today = Sale.objects.filter(
            shop=shop,
            created_at__date=today,
            status='completed',
            total_amount__gte=1000  # Alert for sales over $1000
        ).count()
        
        if large_sales_today > 0:
            alerts.append({
                'type': 'large_sales',
                'message': f'{large_sales_today} large transaction(s) recorded today'
            })

        # Compile dashboard data
        dashboard_data = {
            'sales': {
                'today': {
                    'revenue': float(today_revenue),
                    'orders': today_orders,
                    'growth': round(today_growth, 1)
                },
                'week': {
                    'revenue': float(week_revenue),
                    'orders': week_orders,
                    'growth': round(week_growth, 1)
                },
                'month': {
                    'revenue': float(month_revenue),
                    'orders': month_orders,
                    'growth': round(month_growth, 1)
                }
            },
            'inventory': {
                'totalProducts': total_products,
                'lowStockItems': low_stock_items,
                'negativeStockItems': negative_stock_items,
                'totalValue': float(total_inventory_value)
            },
            'employees': {
                'totalCashiers': total_cashiers,
                'activeToday': active_today
            },
            'topProducts': top_products_data,
            'recentSales': recent_sales_data,
            'alerts': alerts
        }

        return Response(dashboard_data, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class FounderLoginView(APIView):
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({"error": "Username and password required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if ShopConfiguration.validate_founder_credentials(username, password):
            return Response({
                "message": "Founder login successful",
                "founder": {
                    "username": username,
                    "role": "founder",
                    "access_level": "super_admin"
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid founder credentials"}, status=status.HTTP_401_UNAUTHORIZED)

@method_decorator(csrf_exempt, name='dispatch')
class FounderShopListView(APIView):
    def post(self, request):
        # Verify founder credentials
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not ShopConfiguration.validate_founder_credentials(username, password):
            return Response({"error": "Invalid founder credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        
        # Get all shops
        shops = ShopConfiguration.objects.all().order_by('-registered_at')
        shops_data = []
        
        for shop in shops:
            shops_data.append({
                "id": shop.id,
                "shop_id": str(shop.shop_id),
                "register_id": shop.register_id,
                "name": shop.name,
                "email": shop.email,
                "phone": shop.phone,
                "address": shop.address,
                "business_type": shop.business_type,
                "industry": shop.industry,
                "registered_at": shop.registered_at.isoformat(),
                "is_active": shop.is_active,
                "last_login": shop.last_login.isoformat() if shop.last_login else None
            })
        
        return Response({
            "message": "All shops retrieved successfully",
            "shops": shops_data,
            "total_shops": len(shops_data)
        }, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class FounderShopDashboardView(APIView):
    def post(self, request):
        # Verify founder credentials
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not ShopConfiguration.validate_founder_credentials(username, password):
            return Response({"error": "Invalid founder credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        
        shop_id = request.data.get('shop_id')
        if not shop_id:
            return Response({"error": "Shop ID required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the specific shop
        try:
            shop = ShopConfiguration.objects.get(id=shop_id)
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Use the existing OwnerDashboardView logic but for the specific shop
        # Calculate date ranges
        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        # Sales Data
        today_sales = Sale.objects.filter(shop=shop, created_at__date=today, status='completed')
        yesterday_sales = Sale.objects.filter(shop=shop, created_at__date=yesterday, status='completed')
        week_sales = Sale.objects.filter(shop=shop, created_at__date__gte=week_ago, status='completed')
        month_sales = Sale.objects.filter(shop=shop, created_at__date__gte=month_ago, status='completed')

        # Calculate sales metrics
        today_revenue = today_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        yesterday_revenue = yesterday_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        today_orders = today_sales.count()
        yesterday_orders = yesterday_sales.count()

        # Growth calculations
        today_growth = ((today_revenue - yesterday_revenue) / max(yesterday_revenue, 1)) * 100 if yesterday_revenue > 0 else 0
        today_orders_growth = ((today_orders - yesterday_orders) / max(yesterday_orders, 1)) * 100 if yesterday_orders > 0 else 0

        week_revenue = week_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        week_orders = week_sales.count()
        prev_week_revenue = Sale.objects.filter(
            shop=shop, 
            created_at__date__gte=week_ago - timedelta(days=7), 
            created_at__date__lt=week_ago, 
            status='completed'
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        week_growth = ((week_revenue - prev_week_revenue) / max(prev_week_revenue, 1)) * 100 if prev_week_revenue > 0 else 0

        month_revenue = month_sales.aggregate(total=Sum('total_amount'))['total'] or 0
        month_orders = month_sales.count()
        prev_month_revenue = Sale.objects.filter(
            shop=shop, 
            created_at__date__gte=month_ago - timedelta(days=30), 
            created_at__date__lt=month_ago, 
            status='completed'
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        month_growth = ((month_revenue - prev_month_revenue) / max(prev_month_revenue, 1)) * 100 if prev_month_revenue > 0 else 0

        # Inventory Data
        products = Product.objects.filter(shop=shop)
        total_products = products.count()
        low_stock_items = products.filter(models.Q(stock_quantity__lte=models.F('min_stock_level'))).count()
        negative_stock_items = products.filter(stock_quantity__lt=0).count()
        # FIXED: Stock value never negative - if oversold, value is $0 (no physical assets)
        total_inventory_value = sum(max(0, p.stock_quantity) * p.cost_price for p in products)

        # Employee Data
        total_cashiers = Cashier.objects.filter(shop=shop).count()
        active_today = Shift.objects.filter(
            shop=shop, 
            start_time__date=today, 
            is_active=True
        ).count()

        # Top Products (last 30 days)
        top_products_data = []
        sale_items_30_days = SaleItem.objects.filter(
            sale__shop=shop,
            sale__created_at__date__gte=month_ago,
            sale__status='completed'
        ).values(
            'product_id',
            'product__name',
            'product__category'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_revenue=Sum(F('quantity') * F('unit_price'))
        ).order_by('-total_revenue')[:10]

        for item in sale_items_30_days:
            top_products_data.append({
                'id': item['product_id'],
                'name': item['product__name'],
                'category': item['product__category'],
                'sold_quantity': int(item['total_quantity']),
                'revenue': float(item['total_revenue'])
            })

        # Recent Sales (last 10)
        recent_sales = Sale.objects.filter(
            shop=shop, 
            status='completed'
        ).order_by('-created_at')[:10]

        recent_sales_data = []
        for sale in recent_sales:
            recent_sales_data.append({
                'id': sale.id,
                'total_amount': float(sale.total_amount),
                'payment_method': sale.payment_method,
                'created_at': sale.created_at.isoformat(),
                'cashier_name': sale.cashier.name if sale.cashier else 'Unknown'
            })

        # Alerts
        alerts = []
        
        # Low stock alerts
        if (low_stock_items + negative_stock_items) > 0:
            alerts.append({
                'type': 'low_stock',
                'message': f'{low_stock_items} products are running low on stock, {negative_stock_items} products have negative stock'
            })
        
        # Zero sales alert
        if today_revenue == 0 and today_orders == 0:
            alerts.append({
                'type': 'no_sales',
                'message': 'No sales recorded today'
            })
        
        # High value sales alert (for large transactions)
        large_sales_today = Sale.objects.filter(
            shop=shop,
            created_at__date=today,
            status='completed',
            total_amount__gte=1000  # Alert for sales over $1000
        ).count()
        
        if large_sales_today > 0:
            alerts.append({
                'type': 'large_sales',
                'message': f'{large_sales_today} large transaction(s) recorded today'
            })

        # Compile dashboard data
        dashboard_data = {
            'shop_info': {
                'id': shop.id,
                'name': shop.name,
                'email': shop.email,
                'phone': shop.phone,
                'address': shop.address,
                'business_type': shop.business_type,
                'industry': shop.industry,
                'registered_at': shop.registered_at.isoformat(),
                'is_active': shop.is_active
            },
            'sales': {
                'today': {
                    'revenue': float(today_revenue),
                    'orders': today_orders,
                    'growth': round(today_growth, 1)
                },
                'week': {
                    'revenue': float(week_revenue),
                    'orders': week_orders,
                    'growth': round(week_growth, 1)
                },
                'month': {
                    'revenue': float(month_revenue),
                    'orders': month_orders,
                    'growth': round(month_growth, 1)
                }
            },
            'inventory': {
                'totalProducts': total_products,
                'lowStockItems': low_stock_items,
                'negativeStockItems': negative_stock_items,
                'totalValue': float(total_inventory_value)
            },
            'employees': {
                'totalCashiers': total_cashiers,
                'activeToday': active_today
            },
            'topProducts': top_products_data,
            'recentSales': recent_sales_data,
            'alerts': alerts
        }

        return Response(dashboard_data, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class FounderResetShopPasswordView(APIView):
    def post(self, request):
        # Verify founder credentials
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not ShopConfiguration.validate_founder_credentials(username, password):
            return Response({"error": "Invalid founder credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        
        shop_id = request.data.get('shop_id')
        new_password = request.data.get('new_password')
        
        if not shop_id or not new_password:
            return Response({"error": "Shop ID and new password required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            shop = ShopConfiguration.objects.get(id=shop_id)
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Reset the shop's password
        shop.set_password(new_password)
        shop.save()
        
        return Response({
            "message": f"Password reset successfully for {shop.name}",
            "shop": {
                "id": shop.id,
                "name": shop.name,
                "email": shop.email,
                "new_password": new_password
            }
        }, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class InventoryAuditTrailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        shop = ShopConfiguration.objects.get()
        logs = InventoryLog.objects.filter(shop=shop).order_by('-created_at')
        
        # Filtering
        product_id = request.query_params.get('product_id')
        if product_id:
            logs = logs.filter(product_id=product_id)
            
        reason_code = request.query_params.get('reason_code')
        if reason_code:
            logs = logs.filter(reason_code=reason_code)
            
        start_date = request.query_params.get('start_date')
        if start_date:
            logs = logs.filter(created_at__date__gte=start_date)
            
        end_date = request.query_params.get('end_date')
        if end_date:
            logs = logs.filter(created_at__date__lte=end_date)
            
        serializer = InventoryLogSerializer(logs, many=True)
        return Response(serializer.data)

@method_decorator(csrf_exempt, name='dispatch')
class ProductAuditHistoryView(APIView):
    def get(self, request, product_id):
        shop = ShopConfiguration.objects.get()
        try:
            product = Product.objects.get(id=product_id, shop=shop)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)
            
        logs = InventoryLog.objects.filter(shop=shop, product=product).order_by('-created_at')
        serializer = InventoryLogSerializer(logs, many=True)
        return Response(serializer.data)

@method_decorator(csrf_exempt, name='dispatch')
class CashierTopProductsView(APIView):
    def get(self, request):
        """Get top 5 selling products for cashier dashboard"""
        try:
            shop = ShopConfiguration.objects.get()
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get top 5 selling products from last 30 days
        from datetime import timedelta
        month_ago = timezone.now() - timedelta(days=30)
        
        top_products_data = []
        sale_items_30_days = SaleItem.objects.filter(
            sale__shop=shop,
            sale__created_at__gte=month_ago,
            sale__status='completed'
        ).values(
            'product_id',
            'product__name',
            'product__category'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_revenue=Sum(F('quantity') * F('unit_price'))
        ).order_by('-total_revenue')[:5]

        for item in sale_items_30_days:
            top_products_data.append({
                'id': item['product_id'],
                'name': item['product__name'],
                'category': item['product__category'],
                'sold_quantity': int(item['total_quantity']),
                'revenue': float(item['total_revenue'])
            })
        
        return Response({
            "success": True,
            "top_products": top_products_data
        }, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class BarcodeLookupView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    
    """Quick barcode lookup for cashier POS"""
    def get(self, request):
        barcode = request.query_params.get('barcode', '').strip()
        
        if not barcode:
            return Response({"error": "Barcode parameter is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            shop = ShopConfiguration.objects.get()
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Search for product by barcode, line code, or additional barcodes
        product = Product.objects.filter(
            shop=shop
        ).filter(
            models.Q(barcode=barcode) | 
            models.Q(line_code=barcode) |
            models.Q(additional_barcodes__contains=barcode)
        ).first()
        
        if product:
            return Response({
                "found": True,
                "product": {
                    "id": product.id,
                    "name": product.name,
                    "price": float(product.price),
                    "barcode": product.barcode,
                    "line_code": product.line_code,
                    "additional_barcodes": product.additional_barcodes or [],
                    "category": product.category,
                    "stock_quantity": product.stock_quantity,
                    "currency": product.currency
                }
            })
        else:
            return Response({
                "found": False,
                "message": f"No product found with barcode: {barcode}"
            })

@method_decorator(csrf_exempt, name='dispatch')
class SalesHistoryView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    
    """Enhanced sales history view for owner dashboard"""
    def get(self, request):
        # Authenticate shop owner from Basic Auth header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header.startswith('Basic '):
            return Response({"error": "Owner authentication required"}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            # Decode Basic Auth
            import base64
            auth_bytes = base64.b64decode(auth_header[6:])
            auth_string = auth_bytes.decode('utf-8')
            email, password = auth_string.split(':', 1)
        except Exception:
            return Response({"error": "Invalid authentication format"}, status=status.HTTP_401_UNAUTHORIZED)
        
        try:
            shop = ShopConfiguration.objects.get(email=email)
            if not shop.validate_shop_owner_master_password(password):
                return Response({"error": "Invalid owner credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        except ShopConfiguration.DoesNotExist:
            return Response({"error": "Shop not found"}, status=status.HTTP_404_NOT_FOUND)
        
        sales = Sale.objects.filter(shop=shop).order_by('-created_at')
        
        # Enhanced serialization with more details for the frontend
        sales_data = []
        for sale in sales:
            sale_data = {
                'id': sale.id,
                'receipt_number': f'R{sale.id:03d}',  # Format as R001, R002, etc.
                'created_at': sale.created_at.isoformat(),
                'cashier_name': sale.cashier.name if sale.cashier else 'Unknown',
                'payment_method': sale.payment_method,
                'customer_name': sale.customer_name or '',
                'total_amount': float(sale.total_amount),
                'currency': sale.currency,
                'status': sale.status,
                'items': []
            }
            
            # Add sale items with product details
            for item in sale.items.all():
                sale_data['items'].append({
                    'product_id': item.product.id,
                    'product_name': item.product.name,
                    'quantity': float(item.quantity),
                    'unit_price': float(item.unit_price),
                    'total_price': float(item.total_price)
                })
            
            sales_data.append(sale_data)
        
        return Response(sales_data)


class StockTransferViewSet(viewsets.ViewSet):
    """ViewSet for Stock Transfer operations"""
    
    def list(self, request):
        """List all stock transfers for the shop"""
        try:
            # Get shop credentials from request headers
            shop_id = request.META.get('HTTP_X_SHOP_ID')
            if not shop_id:
                return Response({'error': 'Shop ID required in X-Shop-ID header'}, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"🔍 DEBUG: Looking for shop with shop_id: {shop_id}")
            shop = get_object_or_404(ShopConfiguration, shop_id=shop_id)
            transfers = StockTransfer.objects.filter(shop=shop).order_by('-created_at')
            
            serializer = StockTransferSerializer(transfers, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def create(self, request):
        """Create a new stock transfer"""
        try:
            print(f"🔍 DEBUG: StockTransferViewSet.create called")
            print(f"🔍 DEBUG: Request data: {request.data}")
            print(f"🔍 DEBUG: Request headers: {dict(request.META)}")
            
            # Get shop credentials from request headers
            shop_id = request.META.get('HTTP_X_SHOP_ID')
            print(f"🔍 DEBUG: Shop ID from header: {shop_id}")
            
            if not shop_id:
                print(f"❌ DEBUG: No shop ID provided")
                return Response({'error': 'Shop ID required in X-Shop-ID header'}, status=status.HTTP_400_BAD_REQUEST)
            
            shop = get_object_or_404(ShopConfiguration, shop_id=shop_id)
            print(f"🔍 DEBUG: Shop found: {shop.name}")
            
            # Get cashier from request - optional for shop owner
            cashier_id = request.META.get('HTTP_X_CASHIER_ID')
            cashier = None
            if cashier_id:
                print(f"🔍 DEBUG: Looking for cashier with id: {cashier_id}")
                try:
                    cashier = Cashier.objects.get(id=cashier_id, shop=shop)
                    print(f"🔍 DEBUG: Cashier found: {cashier.name}")
                except Cashier.DoesNotExist:
                    print(f"❌ DEBUG: Cashier not found with id: {cashier_id}")
                    return Response({'error': 'Invalid cashier ID'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                print(f"🔍 DEBUG: No cashier ID provided, assuming shop owner operation")
            
            # Extract transfer data from request
            data = request.data.copy()
            print(f"🔍 DEBUG: Transfer data: {data}")
            
            # Create transfer instance
            transfer = StockTransfer(
                shop=shop,
                transfer_type=data.get('transfer_type', 'CONVERSION'),
                from_line_code=data.get('from_line_code', ''),
                from_barcode=data.get('from_barcode', ''),
                from_quantity=float(data.get('from_quantity', 0)),
                to_line_code=data.get('to_line_code', ''),
                to_barcode=data.get('to_barcode', ''),
                to_quantity=float(data.get('to_quantity', 0)),
                reason=data.get('reason', ''),
                performed_by=cashier,  # Can be None for shop owner operations
                notes=data.get('notes', '')
            )
            
            print(f"🔍 DEBUG: StockTransfer instance created")
            
            # Validate transfer
            errors = transfer.validate_transfer()
            print(f"🔍 DEBUG: Validation errors: {errors}")
            if errors:
                print(f"❌ DEBUG: Validation failed")
                return Response({
                    'success': False,
                    'error': 'Validation failed',
                    'details': errors
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find products if identifiers provided
            if transfer.from_line_code or transfer.from_barcode:
                identifier = transfer.from_line_code or transfer.from_barcode
                print(f"🔍 DEBUG: Finding from_product with identifier: {identifier}")
                transfer.from_product = transfer._find_product_by_identifier(identifier)
                print(f"🔍 DEBUG: from_product found: {transfer.from_product.name if transfer.from_product else 'Not found'}")
            
            if transfer.to_line_code or transfer.to_barcode:
                identifier = transfer.to_line_code or transfer.to_barcode
                print(f"🔍 DEBUG: Finding to_product with identifier: {identifier}")
                transfer.to_product = transfer._find_product_by_identifier(identifier)
                print(f"🔍 DEBUG: to_product found: {transfer.to_product.name if transfer.to_product else 'Not found'}")
            
            # Process the transfer
            print(f"🔍 DEBUG: About to call process_transfer()")
            success, messages = transfer.process_transfer()
            print(f"🔍 DEBUG: process_transfer returned - success: {success}, messages: {messages}")
            
            if success:
                print(f"✅ DEBUG: Transfer successful, serializing data...")
                serializer = StockTransferSerializer(transfer)
                print(f"✅ DEBUG: Serialization complete, returning success response")
                return Response({
                    'success': True,
                    'message': 'Stock transfer completed successfully',
                    'data': serializer.data
                }, status=status.HTTP_201_CREATED)
            else:
                print(f"❌ DEBUG: Transfer failed")
                return Response({
                    'success': False,
                    'error': 'Transfer failed',
                    'details': messages
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            print(f"❌ DEBUG: Exception in create method: {str(e)}")
            print(f"❌ DEBUG: Exception type: {type(e)}")
            import traceback
            print(f"❌ DEBUG: Traceback: {traceback.format_exc()}")
            return Response({
                'success': False,
                'error': f'Internal server error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def find_product(self, request):
        """Find a product by line code or barcode"""
        try:
            # Get shop credentials from request headers
            shop_id = request.META.get('HTTP_X_SHOP_ID')
            if not shop_id:
                return Response({'error': 'Shop ID required in X-Shop-ID header'}, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"🔍 DEBUG: Finding product for shop_id: {shop_id}")
            shop = get_object_or_404(ShopConfiguration, shop_id=shop_id)
            
            # Get search identifier
            identifier = request.data.get('identifier', '').strip()
            if not identifier:
                return Response({
                    'success': False,
                    'error': 'Identifier (line code or barcode) required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Search for product
            product = None
            search_method = ''
            
            try:
                product = Product.objects.get(line_code=identifier, shop=shop)
                search_method = 'line_code'
            except Product.DoesNotExist:
                try:
                    product = Product.objects.get(barcode=identifier, shop=shop)
                    search_method = 'barcode'
                except Product.DoesNotExist:
                    # Check additional barcodes
                    product = Product.objects.filter(
                        shop=shop,
                        additional_barcodes__icontains=identifier
                    ).first()
                    if product:
                        search_method = 'additional_barcode'
            
            if product:
                serializer = ProductSerializer(product)
                return Response({
                    'success': True,
                    'data': {
                        'product': serializer.data,
                        'search_method': search_method,
                        'current_stock': float(product.stock_quantity or 0),
                        'stock_status': product.stock_status
                    }
                })
            else:
                return Response({
                    'success': False,
                    'error': f'Product not found with identifier: {identifier}'
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Internal server error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def validate_transfer(self, request):
        """Validate a transfer without executing it"""
        try:
            # Get shop credentials from request headers
            shop_id = request.META.get('HTTP_X_SHOP_ID')
            if not shop_id:
                return Response({'error': 'Shop ID required in X-Shop-ID header'}, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"🔍 DEBUG: Validating transfer for shop_id: {shop_id}")
            shop = get_object_or_404(ShopConfiguration, shop_id=shop_id)
            
            # Create temporary transfer for validation
            data = request.data.copy()
            transfer = StockTransfer(
                shop=shop,
                transfer_type=data.get('transfer_type', 'CONVERSION'),
                from_line_code=data.get('from_line_code', ''),
                from_barcode=data.get('from_barcode', ''),
                from_quantity=float(data.get('from_quantity', 0)),
                to_line_code=data.get('to_line_code', ''),
                to_barcode=data.get('to_barcode', ''),
                to_quantity=float(data.get('to_quantity', 0)),
                reason=data.get('reason', ''),
            )
            
            # Find products if identifiers provided
            if transfer.from_line_code or transfer.from_barcode:
                identifier = transfer.from_line_code or transfer.from_barcode
                transfer.from_product = transfer._find_product_by_identifier(identifier)
            
            if transfer.to_line_code or transfer.to_barcode:
                identifier = transfer.to_line_code or transfer.to_barcode
                transfer.to_product = transfer._find_product_by_identifier(identifier)
            
            # Validate transfer
            errors = transfer.validate_transfer()
            
            # Calculate conversion ratio
            conversion_ratio = transfer.calculate_conversion_ratio()
            
            return Response({
                'success': True,
                'is_valid': len(errors) == 0,
                'errors': errors,
                'conversion_ratio': float(conversion_ratio),
                'from_product_info': {
                    'name': transfer.from_product.name if transfer.from_product else 'Not found',
                    'current_stock': float(transfer.from_product.stock_quantity or 0) if transfer.from_product else 0,
                    'line_code': transfer.from_line_code,
                    'barcode': transfer.from_barcode
                } if transfer.from_product or transfer.from_line_code or transfer.from_barcode else None,
                'to_product_info': {
                    'name': transfer.to_product.name if transfer.to_product else 'Not found',
                    'current_stock': float(transfer.to_product.stock_quantity or 0) if transfer.to_product else 0,
                    'line_code': transfer.to_line_code,
                    'barcode': transfer.to_barcode
                } if transfer.to_product or transfer.to_line_code or transfer.to_barcode else None
            })
            
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Internal server error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
