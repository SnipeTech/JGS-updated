from django.contrib import admin
from .models import (
    Staff, Site, Customer, Product, Quotation, ManualExpense,
    Vendor, WorkEntry, DailyLog, Attendance, MaterialSetting,
    MaterialRental, Supplier, Vehicle, MaterialRequest,
    PayrollPaidStatus, PayrollHistory, AppConfig
)


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'role', 'salary_type', 'per_day_salary', 'per_hour_salary')
    search_fields = ('name', 'phone', 'role')


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ('name', 'client_name', 'status', 'start_date', 'budget')
    list_filter = ('status',)
    search_fields = ('name', 'client_name')


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'email')
    search_fields = ('name', 'phone', 'email')


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'unit', 'rate')
    search_fields = ('name', 'category')


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ('quotation_number', 'customer_name', 'site_name', 'total_amount', 'status')
    list_filter = ('status',)
    search_fields = ('quotation_number', 'customer_name', 'site_name')


@admin.register(ManualExpense)
class ManualExpenseAdmin(admin.ModelAdmin):
    list_display = ('site_name', 'date', 'amount', 'category')
    search_fields = ('site_name', 'category', 'description')


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'category')
    search_fields = ('name', 'category')


@admin.register(WorkEntry)
class WorkEntryAdmin(admin.ModelAdmin):
    list_display = ('staff_name', 'site_name', 'date', 'hours_worked', 'status')
    search_fields = ('staff_name', 'site_name')


@admin.register(DailyLog)
class DailyLogAdmin(admin.ModelAdmin):
    list_display = ('staff_name', 'site_name', 'date', 'income_from_client')
    search_fields = ('staff_name', 'site_name')


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('staff_id', 'date', 'status', 'in_time', 'out_time', 'ot_hours')
    list_filter = ('status', 'date')


@admin.register(MaterialSetting)
class MaterialSettingAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit', 'default_rate', 'is_rental', 'rental_rate_per_day')


@admin.register(MaterialRental)
class MaterialRentalAdmin(admin.ModelAdmin):
    list_display = ('material_name', 'site_name', 'start_date', 'status', 'total_rental_cost')
    list_filter = ('status',)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'materials_supplied')
    search_fields = ('name', 'phone')


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('name', 'number', 'type')
    search_fields = ('name', 'number')


@admin.register(MaterialRequest)
class MaterialRequestAdmin(admin.ModelAdmin):
    list_display = ('site_name', 'requested_by_staff_name', 'date', 'status', 'total_cost')
    list_filter = ('status', 'date')
    search_fields = ('site_name', 'requested_by_staff_name')


@admin.register(PayrollPaidStatus)
class PayrollPaidStatusAdmin(admin.ModelAdmin):
    list_display = ('key', 'staff_id', 'paid_status', 'paid_at')


@admin.register(PayrollHistory)
class PayrollHistoryAdmin(admin.ModelAdmin):
    list_display = ('staff_id', 'date', 'amount', 'mode')


@admin.register(AppConfig)
class AppConfigAdmin(admin.ModelAdmin):
    list_display = ('key',)
