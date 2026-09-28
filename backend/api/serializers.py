from rest_framework import serializers
from .models import (
    Staff, Site, Customer, Product, Quotation, ManualExpense,
    Vendor, WorkEntry, DailyLog, Attendance, MaterialSetting,
    MaterialRental, Supplier, Vehicle, MaterialRequest,
    PayrollPaidStatus, PayrollHistory, AppConfig, StageCompletionRequest
)


class StaffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Staff
        fields = '__all__'


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = '__all__'


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'


class QuotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quotation
        fields = '__all__'


class ManualExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ManualExpense
        fields = '__all__'


class VendorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendor
        fields = '__all__'


class WorkEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkEntry
        fields = '__all__'


class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLog
        fields = '__all__'


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = '__all__'


class MaterialSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialSetting
        fields = '__all__'


class MaterialRentalSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialRental
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'


class MaterialRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialRequest
        fields = '__all__'


class PayrollPaidStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollPaidStatus
        fields = '__all__'


class PayrollHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollHistory
        fields = '__all__'


class AppConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppConfig
        fields = '__all__'


class StageCompletionRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = StageCompletionRequest
        fields = '__all__'

