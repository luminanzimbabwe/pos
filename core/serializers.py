from rest_framework import serializers
from django.db.models import Sum, F
from django.utils import timezone
from datetime import timedelta
from .models import ShopConfiguration, Cashier, Product, Sale, SaleItem, Customer, Discount, Shift, Expense, Refund, StaffLunch, StockTake, StockTakeItem, InventoryLog, StockTransfer

class ShopConfigurationSerializer(serializers.ModelSerializer):
    shop_owner_master_password = serializers.CharField(write_only=True, required=False)
    recovery_codes = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)

    class Meta:
        model = ShopConfiguration
        fields = [
            'shop_id', 'register_id', 'name', 'address', 'business_type', 'industry', 'description', 
            'email', 'phone', 'shop_owner_master_password', 'recovery_codes',
            'device_id', 'owner_id', 'api_key', 'version', 'checksum', 
            'registration_time', 'is_active', 'last_login', 'registered_at'
        ]
        read_only_fields = ['shop_id', 'register_id', 'device_id', 'owner_id', 'api_key', 'checksum', 'registered_at']

    def validate_founder_master_password(self, value):
        """Validate founder master password for super admin access"""
        if value != "morrill95@2001":
            raise serializers.ValidationError("Invalid founder master password.")
        return value

    def create(self, validated_data):
        # Remove shop_owner_master_password and recovery_codes for processing
        shop_owner_master_password = validated_data.pop('shop_owner_master_password', None)
        recovery_codes = validated_data.pop('recovery_codes', [])
        
        shop = super().create(validated_data)
        
        # Set shop-specific security credentials if provided
        if shop_owner_master_password:
            shop.shop_owner_master_password = shop_owner_master_password
        if recovery_codes:
            shop.recovery_codes = recovery_codes
            
        shop.save()
        return shop

    def update(self, instance, validated_data):
        # Handle security credential updates
        shop_owner_master_password = validated_data.pop('shop_owner_master_password', None)
        recovery_codes = validated_data.pop('recovery_codes', None)
        
        # Update basic fields
        instance = super().update(instance, validated_data)
        
        # Update shop-specific security credentials if provided
        if shop_owner_master_password is not None:
            instance.shop_owner_master_password = shop_owner_master_password
        if recovery_codes is not None:
            instance.recovery_codes = recovery_codes
            
        instance.save()
        return instance

class CashierSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = Cashier
        fields = ['id', 'name', 'phone', 'password', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_name(self, value):
        # Check if name is already used by another cashier in the same shop
        shop = self.context.get('shop')
        if shop:
            existing = Cashier.objects.filter(shop=shop, name=value)
            if self.instance:
                existing = existing.exclude(id=self.instance.id)
            if existing.exists():
                raise serializers.ValidationError("A cashier with this name already exists")
        return value

    def validate_phone(self, value):
        # Check if phone number is already used by another cashier in the same shop
        shop = self.context.get('shop')
        if shop and value:
            existing = Cashier.objects.filter(shop=shop, phone=value)
            if self.instance:
                existing = existing.exclude(id=self.instance.id)
            if existing.exists():
                raise serializers.ValidationError("A cashier with this phone number already exists")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        cashier = super().create(validated_data)
        cashier.set_password(password)
        cashier.save()
        return cashier

class CashierLoginSerializer(serializers.Serializer):
    name = serializers.CharField()
    password = serializers.CharField()

class CashierResetPasswordSerializer(serializers.Serializer):
    owner_email = serializers.EmailField()
    owner_password = serializers.CharField()
    cashier_name = serializers.CharField()
    new_password = serializers.CharField(min_length=6)

class ProductSerializer(serializers.ModelSerializer):
    currency_display = serializers.CharField(source='get_currency_display', read_only=True)
    price_type_display = serializers.CharField(source='get_price_type_display', read_only=True)
    stock_status = serializers.CharField(read_only=True)
    stock_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'cost_price', 'currency', 'currency_display', 'price_type', 'price_type_display', 'category', 'barcode', 'line_code', 'additional_barcodes', 'stock_quantity', 'min_stock_level', 'stock_status', 'stock_value', 'supplier', 'supplier_invoice', 'receiving_notes', 'is_active', 'created_at', 'updated_at']

class BulkProductSerializer(serializers.ModelSerializer):
    stock_level = serializers.IntegerField(source='stock_quantity', read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'stock_level', 'barcode', 'line_code', 'additional_barcodes', 'category']

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_id = serializers.IntegerField(source='product.id', read_only=True)
    product_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    product_price_type = serializers.CharField(source='product.price_type', read_only=True)
    remaining_quantity = serializers.SerializerMethodField()

    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_id', 'product_name', 'product_price', 'product_price_type', 'quantity', 'unit_price', 'total_price',
                  'refunded', 'refund_quantity', 'refund_reason', 'refund_type', 'refund_amount', 'refunded_at', 'refunded_by', 'remaining_quantity']
        read_only_fields = ['refunded', 'refund_quantity', 'refund_reason', 'refund_type', 'refund_amount', 'refunded_at', 'refunded_by', 'remaining_quantity']

    def get_remaining_quantity(self, obj):
        return obj.remaining_quantity

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    cashier_name = serializers.CharField(source='cashier.name', read_only=True)
    refunded_by_name = serializers.CharField(source='refunded_by.name', read_only=True)

    class Meta:
        model = Sale
        fields = ['id', 'cashier', 'cashier_name', 'total_amount', 'currency', 'payment_method', 'customer_name', 'customer_phone',
                  'status', 'refund_reason', 'refund_type', 'refund_amount', 'refunded_at', 'refunded_by', 'refunded_by_name',
                  'items', 'created_at']
        read_only_fields = ['id', 'status', 'refund_reason', 'refund_type', 'refund_amount', 'refunded_at', 'refunded_by', 'refunded_by_name', 'created_at']

class CreateSaleSerializer(serializers.Serializer):
    items = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )
    payment_method = serializers.ChoiceField(choices=[
        ('cash', 'Cash'),
        ('ecocash', 'EcoCash'),
        ('card', 'Card'),
        ('transfer', 'Bank Transfer'),
    ])
    customer_name = serializers.CharField(required=False, allow_blank=True)
    customer_phone = serializers.CharField(required=False, allow_blank=True)

    def validate_register_id(self, value):
        if not value.isdigit() or len(value) != 5:
            raise serializers.ValidationError("Register ID must be exactly 5 digits.")
        return value

    def create(self, validated_data):
        validated_data.pop('master_password')  # remove, not stored
        password = validated_data.pop('password')
        shop = super().create(validated_data)
        shop.set_password(password)
        shop.save()
        return shop

class ShopLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

class ResetPasswordSerializer(serializers.Serializer):
    recovery_method = serializers.ChoiceField(choices=['shop_owner_master_password', 'recovery_codes', 'founder_master_password'])
    shop_owner_master_password = serializers.CharField(required=False)
    recovery_code = serializers.CharField(required=False)
    founder_master_password = serializers.CharField(required=False)

    def validate(self, data):
        recovery_method = data.get('recovery_method')
        
        if recovery_method == 'shop_owner_master_password':
            if not data.get('shop_owner_master_password'):
                raise serializers.ValidationError("Shop owner master password is required when using shop owner recovery method.")
        elif recovery_method == 'recovery_codes':
            if not data.get('recovery_code'):
                raise serializers.ValidationError("Recovery code is required when using recovery codes recovery method.")
        elif recovery_method == 'founder_master_password':
            if not data.get('founder_master_password'):
                raise serializers.ValidationError("Founder master password is required when using founder recovery method.")
        
        return data

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'email', 'address', 'loyalty_points', 'total_spent', 'created_at']

class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = ['id', 'name', 'code', 'discount_type', 'value', 'min_purchase', 'max_discount',
                 'is_active', 'valid_from', 'valid_until', 'usage_limit', 'usage_count', 'created_at']

class ShiftSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source='cashier.name', read_only=True)

    class Meta:
        model = Shift
        fields = ['id', 'cashier', 'cashier_name', 'start_time', 'end_time', 'opening_balance',
                  'closing_balance', 'cash_sales', 'card_sales', 'ecocash_sales', 'total_sales',
                  'is_active', 'notes']
        read_only_fields = ['cashier_name']

class ExpenseSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(source='recorded_by.name', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    product_name = serializers.CharField(read_only=True)
    product_line_code = serializers.CharField(read_only=True)
    product_barcode = serializers.CharField(read_only=True)
    staff_lunch_type_display = serializers.CharField(source='get_staff_lunch_type_display', read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'category', 'category_display', 'description', 'amount', 'currency',
            'payment_method', 'payment_method_display', 'vendor', 'expense_date',
            'receipt_number', 'notes', 
            # Product linkage fields
            'product', 'product_name', 'product_line_code', 'product_barcode', 'product_cost_price',
            # Staff lunch fields
            'quantity', 'staff_lunch_type', 'staff_lunch_type_display',
            'recorded_by', 'recorded_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'recorded_by_name', 'product_name', 'product_line_code', 'product_barcode',
            'staff_lunch_type_display', 'created_at', 'updated_at'
        ]

class RefundSerializer(serializers.ModelSerializer):
    processed_by_name = serializers.CharField(source='processed_by.name', read_only=True)
    sale_info = serializers.SerializerMethodField()
    refund_reason_display = serializers.CharField(source='get_refund_reason_display', read_only=True)
    refund_type_display = serializers.CharField(source='get_refund_type_display', read_only=True)

    class Meta:
        model = Refund
        fields = [
            'id', 'sale', 'sale_info', 'customer_name', 'refund_amount',
            'refund_reason', 'refund_reason_display', 'refund_type', 'refund_type_display',
            'return_stock', 'return_items', 'notes', 'processed_by', 'processed_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'processed_by_name', 'created_at', 'updated_at']

    def get_sale_info(self, obj):
        if obj.sale:
            return {
                'id': obj.sale.id,
                'total_amount': obj.sale.total_amount,
                'created_at': obj.sale.created_at,
                'payment_method': obj.sale.payment_method
            }
        return None

class StaffLunchSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.name', read_only=True)

    class Meta:
        model = StaffLunch
        fields = ['id', 'product', 'product_name', 'quantity', 'unit_price', 'total_cost', 'currency', 'recorded_by', 'recorded_by_name', 'notes', 'created_at']
        read_only_fields = ['id', 'product_name', 'unit_price', 'total_cost', 'currency', 'recorded_by_name', 'created_at']

class StockValuationSerializer(serializers.Serializer):
    products = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    expenses_summary = serializers.SerializerMethodField()

    def get_products(self, obj):
        products_data = []
        for product in obj['products']:
            # Calculate sales for this product (excluding refunded amounts)
            # For each sale item, calculate the net sold quantity (original - refunded)
            sale_items = SaleItem.objects.filter(product=product)
            total_quantity_sold = 0
            total_sales_amount = 0
            total_cost_amount = 0

            for item in sale_items:
                # Use remaining quantity (not refunded) for sales calculations
                net_quantity = item.quantity - item.refund_quantity
                if net_quantity > 0:
                    total_quantity_sold += net_quantity
                    total_sales_amount += net_quantity * item.unit_price
                    total_cost_amount += net_quantity * item.product.cost_price

            # BUSINESS LOGIC FIX: Separate Inventory Valuation from Sales Performance
            # 
            # 1. STOCK VALUE: Never negative - if oversold, value is $0 (no physical assets)
            current_stock_value = product.stock_value
            
            # 2. GROSS PROFIT: Based on actual sales performance, not current stock
            # This shows real profit made from selling products
            gross_profit = total_sales_amount - total_cost_amount
            
            # GP % should be based on sales performance, not stock levels
            if total_sales_amount > 0:
                # Use gross margin: (sales - cost) / sales * 100
                gp_percentage = (gross_profit / total_sales_amount * 100)
            else:
                gp_percentage = 0.0

            # Calculate days in stock
            days_in_stock = (timezone.now().date() - product.created_at.date()).days

            # Calculate average daily sales
            avg_daily_sales = total_quantity_sold / max(days_in_stock, 1)

            # Calculate stock turnover ratio
            stock_turnover = total_quantity_sold / max(product.stock_quantity, 1) if product.stock_quantity > 0 else 0

            # Calculate days of supply remaining
            days_of_supply = product.stock_quantity / max(avg_daily_sales, 0.01) if avg_daily_sales > 0 else 999

            # Calculate additional margin metrics per product
            net_margin_percentage = 0.0
            roi_percentage = 0.0
            asset_turnover = 0.0
            profit_per_unit = 0.0

            if total_sales_amount > 0:
                # Net margin would require business expenses allocation per product
                # For now, we'll use gross margin as proxy
                net_margin_percentage = gp_percentage

                # ROI = (Net Profit / Investment) * 100
                # Using gross profit as proxy for net profit
                # Note: When stock_value is 0 (no inventory), ROI calculation is not applicable
                if current_stock_value > 0:
                    roi_percentage = (gross_profit / current_stock_value) * 100
                else:
                    roi_percentage = 0.0  # No inventory investment to calculate ROI on

                # Asset Turnover = Sales / Assets (stock value)
                # Note: When stock_value is 0 (no inventory), asset turnover is not applicable
                asset_turnover = total_sales_amount / current_stock_value if current_stock_value > 0 else 0.0

                # Profit per unit sold
                profit_per_unit = gross_profit / total_quantity_sold if total_quantity_sold > 0 else 0

            # Stock aging analysis
            stock_age_category = 'New'
            if days_in_stock > 90:
                stock_age_category = 'Old'
            elif days_in_stock > 30:
                stock_age_category = 'Aging'

            # Slow-moving inventory alert
            is_slow_moving = days_of_supply > 60 and avg_daily_sales < 1
            is_fast_moving = avg_daily_sales > 5

            # Stock Status - Using model property for consistency
            stock_status = product.stock_status
            
            # Stock Status Colors for UI
            stock_status_colors = {
                'Out of Stock': '#ef4444',    # Red
                'Low Stock': '#f59e0b',       # Orange
                'Well Stocked': '#10b981',    # Green
                'Normal': '#3b82f6'           # Blue
            }
            stock_status_color = stock_status_colors.get(stock_status, '#6b7280')  # Gray default

            # Calculate last sale date
            last_sale = SaleItem.objects.filter(product=product).order_by('-sale__created_at').first()
            last_sale_date = last_sale.sale.created_at if last_sale else None
            last_sale_days_ago = (timezone.now().date() - last_sale_date.date()).days if last_sale_date else None

            products_data.append({
                'id': product.id,
                'name': product.name,
                'description': product.description,
                'barcode': product.barcode,
                'line_code': product.line_code,
                'additional_barcodes': product.additional_barcodes,
                'category': product.category,
                'cost_price': product.cost_price,
                'selling_price': product.price,
                'price_type': product.price_type,
                'price_type_display': product.get_price_type_display(),
                'stock_quantity': product.stock_quantity,
                'min_stock_level': product.min_stock_level,
                'currency': product.currency,
                'is_low_stock': product.is_low_stock,
                'pack_size': '1x1',  # Default pack size - can be enhanced later
                'location': f'A{product.id % 20 + 1}-B{(product.id % 10) + 1}',  # Simulated location
                'total_quantity_sold': total_quantity_sold,
                'total_sales_amount': total_sales_amount,
                'total_cost_amount': total_cost_amount,
                'gross_profit': gross_profit,
                'gp_percentage': round(gp_percentage, 2),
                'net_margin_percentage': round(net_margin_percentage, 2),
                'roi_percentage': round(roi_percentage, 2),
                'asset_turnover': round(asset_turnover, 2),
                'profit_per_unit': round(profit_per_unit, 2),
                'current_stock_value': current_stock_value,
                'supplier': product.supplier,
                'supplier_invoice': product.supplier_invoice,
                'receiving_notes': product.receiving_notes,
                'created_at': product.created_at,
                'updated_at': product.updated_at,
                'days_in_stock': days_in_stock,
                'avg_daily_sales': round(avg_daily_sales, 2),
                'stock_turnover_ratio': round(stock_turnover, 2),
                'days_of_supply': round(days_of_supply, 1),
                'stock_age_category': stock_age_category,
                'is_slow_moving': is_slow_moving,
                'is_fast_moving': is_fast_moving,
                'stock_status': stock_status,
                'stock_status_color': stock_status_color,
                'last_sale_days_ago': last_sale_days_ago,
                'last_sale_date': last_sale_date
            })
        return products_data

    def get_summary(self, obj):
        products = obj['products']
        shop = products[0].shop if products else None

        # Calculate totals with proper business logic
        total_products = len(products)
        # STOCK VALUE: Never negative - using model property for consistency
        total_stock_value = sum(p.stock_value for p in products)
        total_items_in_stock = sum(p.actual_stock_quantity for p in products)  # Also prevent negative stock in totals

        # Calculate overall sales and GP (excluding refunded amounts)
        # GP is based on SALES PERFORMANCE, not current stock levels
        total_quantity_sold = 0
        total_sales_amount = 0
        total_cost_amount = 0

        for product in products:
            sale_items = SaleItem.objects.filter(product=product)
            for item in sale_items:
                # Use remaining quantity (not refunded) for sales calculations
                net_quantity = item.quantity - item.refund_quantity
                if net_quantity > 0:
                    total_quantity_sold += net_quantity
                    total_sales_amount += net_quantity * item.unit_price
                    total_cost_amount += net_quantity * item.product.cost_price

        overall_gross_profit = total_sales_amount - total_cost_amount
        if total_sales_amount > 0:
            # Use gross margin: (sales - cost) / sales * 100
            overall_gp_percentage = (overall_gross_profit / total_sales_amount * 100)
        else:
            overall_gp_percentage = 0.0

        # Calculate expenses for the same period
        from .models import Expense, StaffLunch
        total_expenses = Expense.objects.filter(shop=shop).aggregate(
            total=Sum('amount')
        )['total'] or 0

        total_staff_lunch_costs = StaffLunch.objects.filter(shop=shop).aggregate(
            total=Sum('total_cost')
        )['total'] or 0

        total_business_expenses = total_expenses + total_staff_lunch_costs
        net_profit = overall_gross_profit - total_business_expenses

        # Calculate additional overall metrics with proper business logic
        # ROI: Only meaningful when there's inventory investment
        overall_roi = (net_profit / total_stock_value) * 100 if total_stock_value > 0 else 0
        # Asset Turnover: Sales per dollar of inventory investment
        overall_asset_turnover = total_sales_amount / total_stock_value if total_stock_value > 0 else 0
        overall_net_margin = (net_profit / total_sales_amount) * 100 if total_sales_amount > 0 else 0

        # Low stock products
        low_stock_products = sum(1 for p in products if p.is_low_stock)

        # Calculate slow/fast moving and aging products from the processed data
        slow_moving_products = 0
        fast_moving_products = 0
        aging_products = 0
        old_products = 0

        # We need to process each product to calculate these metrics
        for product in products:
            # Get sales data for this product
            sales_data = SaleItem.objects.filter(
                product=product,
                sale__shop=shop,
                sale__created_at__gte=timezone.now() - timezone.timedelta(days=90)
            ).aggregate(
                total_quantity=Sum('quantity'),
                total_sales=Sum(F('quantity') * F('unit_price'))
            )

            total_quantity_sold = sales_data['total_quantity'] or 0
            total_sales_amount = sales_data['total_sales'] or 0
            days_in_stock = (timezone.now().date() - product.created_at.date()).days
            avg_daily_sales = total_quantity_sold / max(days_in_stock, 1)

            # Slow moving: less than 1 sale per day and days of supply > 60
            days_of_supply = product.stock_quantity / max(avg_daily_sales, 0.01) if avg_daily_sales > 0 else 999
            is_slow_moving = days_of_supply > 60 and avg_daily_sales < 1
            is_fast_moving = avg_daily_sales > 5

            # Stock aging
            stock_age_category = 'New'
            if days_in_stock > 90:
                stock_age_category = 'Old'
            elif days_in_stock > 30:
                stock_age_category = 'Aging'

            if is_slow_moving:
                slow_moving_products += 1
            if is_fast_moving:
                fast_moving_products += 1
            if stock_age_category == 'Aging':
                aging_products += 1
            if stock_age_category == 'Old':
                old_products += 1

        return {
            'total_products': total_products,
            'total_stock_value': total_stock_value,
            'total_items_in_stock': total_items_in_stock,
            'total_quantity_sold': total_quantity_sold,
            'total_sales_amount': total_sales_amount,
            'total_cost_amount': total_cost_amount,
            'overall_gross_profit': overall_gross_profit,
            'overall_gp_percentage': round(overall_gp_percentage, 2),
            'overall_net_margin': round(overall_net_margin, 2),
            'overall_roi': round(overall_roi, 2),
            'overall_asset_turnover': round(overall_asset_turnover, 2),
            'total_expenses': total_expenses,
            'total_staff_lunch_costs': total_staff_lunch_costs,
            'total_business_expenses': total_business_expenses,
            'net_profit': net_profit,
            'low_stock_products': low_stock_products,
            'slow_moving_products': slow_moving_products,
            'fast_moving_products': fast_moving_products,
            'aging_products': aging_products,
            'old_products': old_products
        }

    def get_expenses_summary(self, obj):
        """Calculate detailed business expenses and net profit analysis"""
        products = obj['products']
        shop = products[0].shop if products else None

        if not shop:
            return {
                'total_business_expenses': 0,
                'total_staff_lunch_costs': 0,
                'total_expenses': 0,
                'sales_revenue': 0,
                'cost_of_goods_sold': 0,
                'gross_profit': 0,
                'net_profit': 0,
                'net_profit_percentage': 0,
                'expense_breakdown': {}
            }

        # Get all expenses for this shop
        expenses = Expense.objects.filter(shop=shop)
        staff_lunches = StaffLunch.objects.filter(shop=shop)

        # Calculate expense totals
        total_business_expenses = expenses.aggregate(Sum('amount'))['amount__sum'] or 0
        total_staff_lunch_costs = staff_lunches.aggregate(Sum('total_cost'))['total_cost__sum'] or 0
        total_expenses = float(total_business_expenses) + float(total_staff_lunch_costs)

        # Get sales revenue from all products (excluding refunded amounts)
        sales_revenue = 0
        cost_of_goods_sold = 0

        for product in products:
            sale_items = SaleItem.objects.filter(product=product)
            for item in sale_items:
                # Use remaining quantity (not refunded) for sales calculations
                net_quantity = item.quantity - item.refund_quantity
                if net_quantity > 0:
                    sales_revenue += net_quantity * item.unit_price
                    cost_of_goods_sold += net_quantity * item.product.cost_price

        # Calculate profits
        gross_profit = float(sales_revenue) - float(cost_of_goods_sold)
        net_profit = gross_profit - total_expenses

        # Calculate percentages
        sales_revenue_float = float(sales_revenue)
        gross_margin_percentage = (gross_profit / sales_revenue_float * 100) if sales_revenue_float > 0 else 0
        net_profit_percentage = (net_profit / sales_revenue_float * 100) if sales_revenue_float > 0 else 0

        # Expense breakdown by type
        expense_breakdown = {}
        for expense in expenses:
            expense_type = expense.get_expense_type_display()
            if expense_type not in expense_breakdown:
                expense_breakdown[expense_type] = 0
            expense_breakdown[expense_type] += float(expense.amount)

        return {
            'total_business_expenses': float(total_business_expenses),
            'total_staff_lunch_costs': float(total_staff_lunch_costs),
            'total_expenses': total_expenses,
            'sales_revenue': sales_revenue,
            'cost_of_goods_sold': cost_of_goods_sold,
            'gross_profit': gross_profit,
            'gross_margin_percentage': round(gross_margin_percentage, 2),
            'net_profit': net_profit,
            'net_profit_percentage': round(net_profit_percentage, 2),
            'expense_breakdown': expense_breakdown,
            'expense_to_sales_ratio': round((total_expenses / sales_revenue_float * 100), 2) if sales_revenue_float > 0 else 0
        }

class StockTakeItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_line_code = serializers.CharField(source='product.line_code', read_only=True)
    product_category = serializers.CharField(source='product.category', read_only=True)
    product_cost_price = serializers.DecimalField(source='product.cost_price', max_digits=10, decimal_places=2, read_only=True)
    product_selling_price = serializers.DecimalField(source='product.price', max_digits=10, decimal_places=2, read_only=True)
    currency = serializers.CharField(source='product.currency', read_only=True)
    discrepancy_status = serializers.SerializerMethodField()

    class Meta:
        model = StockTakeItem
        fields = ['id', 'product', 'product_name', 'product_line_code', 'product_category',
                  'system_quantity', 'counted_quantity', 'discrepancy', 'discrepancy_value',
                  'product_cost_price', 'product_selling_price', 'currency', 'notes',
                  'discrepancy_status', 'counted_at']
        read_only_fields = ['id', 'discrepancy', 'discrepancy_value', 'counted_at']

    def get_discrepancy_status(self, obj):
        if obj.discrepancy > 0:
            return 'overstock'
        elif obj.discrepancy < 0:
            return 'understock'
        else:
            return 'exact'

class StockTakeSerializer(serializers.ModelSerializer):
    items = StockTakeItemSerializer(many=True, read_only=True)
    started_by_name = serializers.CharField(source='started_by.name', read_only=True)
    completed_by_name = serializers.CharField(source='completed_by.name', read_only=True)
    stock_take_type_display = serializers.CharField(source='get_stock_take_type_display', read_only=True)
    balance_status_display = serializers.CharField(source='get_balance_status_display', read_only=True)
    duration_display = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    is_balanced = serializers.BooleanField(read_only=True)
    has_discrepancies = serializers.BooleanField(read_only=True)
    discrepancy_summary = serializers.CharField(read_only=True)
    failure_explanation = serializers.SerializerMethodField()

    class Meta:
        model = StockTake
        fields = ['id', 'name', 'stock_take_type', 'stock_take_type_display', 'status', 'balance_status', 'balance_status_display',
                  'failure_reason', 'started_by', 'started_by_name', 'completed_by', 'completed_by_name', 
                  'started_at', 'completed_at', 'notes', 'total_products_counted', 'total_discrepancy_value',
                  'overstock_count', 'understock_count', 'exact_match_count', 'duration_display', 'items',
                  'summary', 'is_balanced', 'has_discrepancies', 'discrepancy_summary', 'failure_explanation',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'started_by_name', 'completed_by_name', 'stock_take_type_display',
                           'balance_status_display', 'duration_display', 'total_products_counted', 
                           'total_discrepancy_value', 'overstock_count', 'understock_count', 'exact_match_count',
                           'created_at', 'updated_at', 'is_balanced', 'has_discrepancies', 'discrepancy_summary']

    def get_duration_display(self, obj):
        duration = obj.duration
        total_seconds = int(duration.total_seconds())
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        if hours > 0:
            return f"{hours}h {minutes}m {seconds}s"
        elif minutes > 0:
            return f"{minutes}m {seconds}s"
        else:
            return f"{seconds}s"

    def get_summary(self, obj):
        if obj.status != 'completed':
            return None

        items = obj.items.all()
        overstock_count = items.filter(discrepancy__gt=0).count()
        understock_count = items.filter(discrepancy__lt=0).count()
        exact_count = items.filter(discrepancy=0).count()

        total_overstock_value = sum(item.discrepancy_value for item in items if item.discrepancy > 0)
        total_understock_value = sum(item.discrepancy_value for item in items if item.discrepancy < 0)

    def get_summary(self, obj):
        if obj.status != 'completed' and obj.status != 'failed':
            return None

        items = obj.items.all()
        overstock_count = obj.overstock_count
        understock_count = obj.understock_count
        exact_count = obj.exact_match_count

        total_overstock_value = sum(item.discrepancy_value for item in items if item.discrepancy > 0)
        total_understock_value = sum(abs(item.discrepancy_value) for item in items if item.discrepancy < 0)

        return {
            'total_products': items.count(),
            'overstock_products': overstock_count,
            'understock_products': understock_count,
            'exact_match_products': exact_count,
            'total_overstock_value': total_overstock_value,
            'total_understock_value': abs(total_understock_value),
            'needs_restocking': understock_count,
            'excess_stock_value': total_overstock_value
        }

    def get_failure_explanation(self, obj):
        """Get detailed explanation of why stock take failed"""
        return obj.get_failure_explanation()

class CreateStockTakeSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    stock_take_type = serializers.ChoiceField(choices=[
        ('weekly', 'Weekly Stock Take'),
        ('monthly', 'Monthly Stock Take'),
    ], default='weekly')
    notes = serializers.CharField(required=False, allow_blank=True)

class AddStockTakeItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    counted_quantity = serializers.DecimalField(max_digits=10, decimal_places=2)
    notes = serializers.CharField(required=False, allow_blank=True)

class BulkAddStockTakeItemsSerializer(serializers.Serializer):
    items = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )

class InventoryLogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.name', read_only=True)
    reason_display = serializers.CharField(source='get_reason_code_display', read_only=True)
    movement_type = serializers.CharField(read_only=True)
    total_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = InventoryLog
        fields = [
            'id', 'product', 'product_name', 'reason_code', 'reason_display',
            'quantity_change', 'previous_quantity', 'new_quantity',
            'reference_number', 'notes', 'performed_by', 'performed_by_name',
            'cost_price', 'created_at', 'movement_type', 'total_value'
        ]

class StockTransferSerializer(serializers.ModelSerializer):
    from_product_name = serializers.CharField(source='from_product.name', read_only=True)
    to_product_name = serializers.CharField(source='to_product.name', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.name', read_only=True)
    financial_impact = serializers.SerializerMethodField()
    business_analysis = serializers.SerializerMethodField()
    
    class Meta:
        model = StockTransfer
        fields = [
            'id',
            'transfer_type',
            'status',
            'from_product',
            'from_product_name',
            'from_quantity',
            'from_line_code',
            'from_barcode',
            'to_product',
            'to_product_name',
            'to_quantity',
            'to_line_code',
            'to_barcode',
            'conversion_ratio',
            'cost_impact',
            'shrinkage_quantity',
            'shrinkage_value',
            'from_product_cost',
            'to_product_cost',
            'net_inventory_value_change',
            'reason',
            'performed_by',
            'performed_by_name',
            'created_at',
            'completed_at',
            'notes',
            'financial_impact',
            'business_analysis'
        ]
        read_only_fields = [
            'id',
            'from_product_name',
            'to_product_name',
            'performed_by_name',
            'conversion_ratio',
            'cost_impact',
            'shrinkage_quantity',
            'shrinkage_value',
            'from_product_cost',
            'to_product_cost',
            'net_inventory_value_change',
            'created_at',
            'completed_at',
            'financial_impact',
            'business_analysis'
        ]
    
    def get_financial_impact(self, obj):
        """Get detailed financial impact summary"""
        if obj.status == 'COMPLETED':
            return obj.get_financial_impact_summary()
        return None
    
    def get_business_analysis(self, obj):
        """Get business impact analysis"""
        if obj.status == 'COMPLETED':
            return obj.get_business_impact_analysis()
        return None
