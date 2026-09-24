from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StaffViewSet, SiteViewSet, CustomerViewSet, ProductViewSet,
    QuotationViewSet, ManualExpenseViewSet, VendorViewSet,
    WorkEntryViewSet, DailyLogViewSet, AttendanceViewSet,
    MaterialSettingViewSet, MaterialRentalViewSet, SupplierViewSet,
    VehicleViewSet, MaterialRequestViewSet, PayrollPaidStatusViewSet,
    PayrollHistoryViewSet, AppConfigViewSet, health_check, sync_app_state
)

router = DefaultRouter()
router.register(r'staff', StaffViewSet, basename='staff')
router.register(r'sites', SiteViewSet, basename='sites')
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'products', ProductViewSet, basename='products')
router.register(r'quotations', QuotationViewSet, basename='quotations')
router.register(r'expenses', ManualExpenseViewSet, basename='expenses')
router.register(r'vendors', VendorViewSet, basename='vendors')
router.register(r'work-entries', WorkEntryViewSet, basename='work-entries')
router.register(r'daily-logs', DailyLogViewSet, basename='daily-logs')
router.register(r'attendances', AttendanceViewSet, basename='attendances')
router.register(r'material-settings', MaterialSettingViewSet, basename='material-settings')
router.register(r'material-rentals', MaterialRentalViewSet, basename='material-rentals')
router.register(r'suppliers', SupplierViewSet, basename='suppliers')
router.register(r'vehicles', VehicleViewSet, basename='vehicles')
router.register(r'material-requests', MaterialRequestViewSet, basename='material-requests')
router.register(r'payroll-status', PayrollPaidStatusViewSet, basename='payroll-status')
router.register(r'payroll-history', PayrollHistoryViewSet, basename='payroll-history')
router.register(r'configs', AppConfigViewSet, basename='configs')

urlpatterns = [
    path('health/', health_check, name='health-check'),
    path('sync/', sync_app_state, name='sync-app-state'),
    path('', include(router.urls)),
]
