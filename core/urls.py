from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .retrieve_credentials_view import RetrieveCredentialsView
from .staff_views import PendingStaffListView, ApprovedStaffListView, ApproveStaffView, RejectStaffView, DeactivateCashierView, DeleteCashierView, InactiveStaffListView, ReactivateCashierView, CashierDetailsView, EditCashierView
from .cashier_registration_view import CashierSelfRegistrationView
from .waste_batch_views import WasteBatchListView, WasteBatchDetailView

# Setup router for ViewSets
router = DefaultRouter()
router.register(r'stock-transfers', views.StockTransferViewSet, basename='stocktransfer')

urlpatterns = [
    # Include router URLs
    path('', include(router.urls)),
    
    # Waste management endpoints
    path('wastes/', views.WasteListView.as_view(), name='waste-list'),
    path('wastes/summary/', views.WasteSummaryView.as_view(), name='waste-summary'),
    path('wastes/product-search/', views.WasteProductSearchView.as_view(), name='waste-search'),
    
    # Waste batch management endpoints
    path('waste-batches/', WasteBatchListView.as_view(), name='waste-batch-list'),
    path('waste-batches/<int:batch_id>/', WasteBatchDetailView.as_view(), name='waste-batch-detail'),
    
    path('status/', views.ShopStatusView.as_view(), name='shop-status'),
    path('register/', views.ShopRegisterView.as_view(), name='shop-register'),
    path('dashboard/', views.OwnerDashboardView.as_view(), name='owner-dashboard'),
    path('login/', views.ShopLoginView.as_view(), name='shop-login'),
    path('reset-password/', views.ResetPasswordView.as_view(), name='reset-password'),
    path('retrieve-credentials/', RetrieveCredentialsView.as_view(), name='retrieve-credentials'),
    path('cashiers/', views.CashierListView.as_view(), name='cashier-list'),
    path('cashiers/<int:cashier_id>/', views.CashierDetailView.as_view(), name='cashier-detail'),
    path('cashiers/login/', views.CashierLoginView.as_view(), name='cashier-login'),
    path('cashiers/logout/', views.CashierLogoutView.as_view(), name='cashier-logout'),
    path('cashiers/register/', CashierSelfRegistrationView.as_view(), name='cashier-self-registration'),
    path('cashiers/reset-password/', views.CashierResetPasswordView.as_view(), name='cashier-reset-password'),
    path('cashiers/top-products/', views.CashierTopProductsView.as_view(), name='cashier-top-products'),
    
    # Staff Management endpoints
    path('staff/pending/', PendingStaffListView.as_view(), name='pending-staff-list'),
    path('staff/approved/', ApprovedStaffListView.as_view(), name='approved-staff-list'),
    path('staff/approve/', ApproveStaffView.as_view(), name='approve-staff'),
    path('staff/reject/', RejectStaffView.as_view(), name='reject-staff'),
    path('staff/deactivate/', DeactivateCashierView.as_view(), name='deactivate-cashier'),
    path('staff/delete/', DeleteCashierView.as_view(), name='delete-cashier'),
    path('staff/inactive/', InactiveStaffListView.as_view(), name='inactive-staff-list'),
    path('staff/reactivate/', ReactivateCashierView.as_view(), name='reactivate-cashier'),
    path('staff/details/', CashierDetailsView.as_view(), name='cashier-details'),
    path('staff/edit/', EditCashierView.as_view(), name='edit-cashier'),
    path('products/', views.ProductListView.as_view(), name='product-list'),
    path('products/<int:product_id>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('products/bulk/', views.BulkProductView.as_view(), name='bulk-product'),
    path('products/barcode-lookup/', views.BarcodeLookupView.as_view(), name='barcode-lookup'),
    path('audit-trail/', views.InventoryAuditTrailView.as_view(), name='inventory-audit-trail'),
    path('products/<int:product_id>/audit-history/', views.ProductAuditHistoryView.as_view(), name='product-audit-history'),
    path('sales/', views.SaleListView.as_view(), name='sale-list'),
    path('sales-history/', views.SalesHistoryView.as_view(), name='sales-history'),
    path('sales/<int:sale_id>/', views.SaleDetailView.as_view(), name='sale-detail'),
    path('sale-items/<int:item_id>/', views.SaleItemDetailView.as_view(), name='sale-item-detail'),
    path('customers/', views.CustomerListView.as_view(), name='customer-list'),
    path('discounts/', views.DiscountListView.as_view(), name='discount-list'),
    path('shifts/', views.ShiftListView.as_view(), name='shift-list'),
    path('shifts/<int:shift_id>/end/', views.ShiftDetailView.as_view(), name='shift-detail'),
    path('stock-valuation/', views.StockValuationView.as_view(), name='stock-valuation'),
    path('expenses/', views.ExpenseListView.as_view(), name='expense-list'),
    path('refunds/', views.RefundListView.as_view(), name='refund-list'),
    path('staff-lunches/', views.StaffLunchListView.as_view(), name='staff-lunch-list'),
    path('stock-takes/', views.StockTakeListView.as_view(), name='stock-take-list'),
    path('stock-takes/<int:stock_take_id>/', views.StockTakeDetailView.as_view(), name='stock-take-detail'),
    path('stock-takes/<int:stock_take_id>/items/', views.StockTakeItemListView.as_view(), name='stock-take-item-list'),
    path('stock-takes/<int:stock_take_id>/items/bulk/', views.BulkAddStockTakeItemsView.as_view(), name='bulk-add-stock-take-items'),
    path('stock-takes/<int:stock_take_id>/search/', views.StockTakeProductSearchView.as_view(), name='stock-take-product-search'),
    
    # Founder super admin routes
    path('founder/login/', views.FounderLoginView.as_view(), name='founder-login'),
    path('founder/shops/', views.FounderShopListView.as_view(), name='founder-shop-list'),
    path('founder/shops/dashboard/', views.FounderShopDashboardView.as_view(), name='founder-shop-dashboard'),
    path('founder/shops/reset-password/', views.FounderResetShopPasswordView.as_view(), name='founder-reset-shop-password'),
]