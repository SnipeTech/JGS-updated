import uuid
from django.db import models


def generate_str_id():
    return str(uuid.uuid4())


class Staff(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True, default='')
    role = models.CharField(max_length=100, default='staff')
    password = models.CharField(max_length=128, blank=True, default='')
    supervisor_id = models.CharField(max_length=64, blank=True, default='')
    admin_permissions = models.JSONField(default=list, blank=True)
    salary_type = models.CharField(max_length=30, blank=True, default='daily')
    per_day_salary = models.FloatField(default=0)
    per_hour_salary = models.FloatField(default=0)
    customer_hourly_rate = models.FloatField(default=0)
    in_time = models.CharField(max_length=30, blank=True, default='')
    out_time = models.CharField(max_length=30, blank=True, default='')
    incentive_per_hour = models.FloatField(default=0)
    under_labour_salary = models.FloatField(default=0)
    under_labour_ot = models.FloatField(default=0)
    per_day_incentive = models.FloatField(default=0)

    def __str__(self):
        return f"{self.name} ({self.role})"


class Site(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True, default='')
    client_name = models.CharField(max_length=150, blank=True, default='')
    status = models.CharField(max_length=50, default='active')
    start_date = models.CharField(max_length=50, blank=True, default='')
    budget = models.FloatField(default=0)
    supervisor_id = models.CharField(max_length=64, blank=True, default='')
    assigned_staff_ids = models.JSONField(default=list, blank=True)
    payment_stages = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.name


class Customer(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True, default='')
    email = models.CharField(max_length=150, blank=True, default='')
    address = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.CharField(max_length=50, blank=True, default='')

    def __str__(self):
        return self.name


class Product(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True, default='')
    unit = models.CharField(max_length=50, blank=True, default='')
    rate = models.FloatField(default=0)
    description = models.TextField(blank=True, default='')

    def __str__(self):
        return self.name


class Quotation(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    quotation_number = models.CharField(max_length=100)
    customer_id = models.CharField(max_length=64, blank=True, default='')
    customer_name = models.CharField(max_length=150, blank=True, default='')
    site_id = models.CharField(max_length=64, blank=True, default='')
    site_name = models.CharField(max_length=200, blank=True, default='')
    items = models.JSONField(default=list, blank=True)
    total_amount = models.FloatField(default=0)
    status = models.CharField(max_length=50, default='draft')
    created_at = models.CharField(max_length=50, blank=True, default='')
    notes = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.quotation_number} - {self.customer_name}"


class ManualExpense(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    site_id = models.CharField(max_length=64, blank=True, default='')
    site_name = models.CharField(max_length=200, blank=True, default='')
    date = models.CharField(max_length=50, blank=True, default='')
    amount = models.FloatField(default=0)
    category = models.CharField(max_length=100, blank=True, default='')
    description = models.TextField(blank=True, default='')


class Vendor(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True, default='')
    email = models.CharField(max_length=150, blank=True, default='')
    category = models.CharField(max_length=100, blank=True, default='')
    address = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')

    def __str__(self):
        return self.name


class WorkEntry(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    staff_id = models.CharField(max_length=64, blank=True, default='')
    staff_name = models.CharField(max_length=150, blank=True, default='')
    site_id = models.CharField(max_length=64, blank=True, default='')
    site_name = models.CharField(max_length=200, blank=True, default='')
    date = models.CharField(max_length=50, blank=True, default='')
    work_description = models.TextField(blank=True, default='')
    hours_worked = models.FloatField(default=0)
    status = models.CharField(max_length=50, default='present')


class DailyLog(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    staff_id = models.CharField(max_length=64, blank=True, default='')
    staff_name = models.CharField(max_length=150, blank=True, default='')
    site_id = models.CharField(max_length=64, blank=True, default='')
    site_name = models.CharField(max_length=200, blank=True, default='')
    date = models.CharField(max_length=50, blank=True, default='')
    materials = models.JSONField(default=list, blank=True)
    transport_mode = models.CharField(max_length=50, blank=True, default='')
    transport_cost = models.FloatField(default=0)
    expenses = models.JSONField(default=list, blank=True)
    income_from_client = models.FloatField(default=0)
    notes = models.TextField(blank=True, default='')
    worker_ids = models.JSONField(default=list, blank=True)
    worker_counts = models.JSONField(default=dict, blank=True)


class Attendance(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    staff_id = models.CharField(max_length=64, blank=True, default='')
    date = models.CharField(max_length=50, blank=True, default='')
    status = models.CharField(max_length=50, default='present')
    in_time = models.CharField(max_length=30, blank=True, default='')
    out_time = models.CharField(max_length=30, blank=True, default='')
    ot_hours = models.FloatField(default=0)
    incentive_amount = models.FloatField(default=0)
    notes = models.TextField(blank=True, default='')
    man_count = models.IntegerField(default=0)
    site_id = models.CharField(max_length=64, blank=True, default='')
    present_counts = models.JSONField(default=dict, blank=True)
    site_assignments = models.JSONField(default=list, blank=True)
    unnamed_ot_hours = models.FloatField(default=0)
    unnamed_ot_staff_count = models.IntegerField(default=0)
    is_submitted = models.BooleanField(default=False)
    edited_by_admin = models.BooleanField(default=False)
    edited_by_admin_name = models.CharField(max_length=150, blank=True, default='')


class MaterialSetting(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=150)
    unit = models.CharField(max_length=50, blank=True, default='')
    per_unit_weight = models.CharField(max_length=50, blank=True, default='')
    default_rate = models.FloatField(default=0)
    is_rental = models.BooleanField(default=False)
    rental_rate_per_day = models.FloatField(default=0)

    def __str__(self):
        return self.name


class MaterialRental(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    material_id = models.CharField(max_length=64, blank=True, default='')
    material_name = models.CharField(max_length=150, blank=True, default='')
    site_id = models.CharField(max_length=64, blank=True, default='')
    site_name = models.CharField(max_length=200, blank=True, default='')
    start_date = models.CharField(max_length=50, blank=True, default='')
    end_date = models.CharField(max_length=50, blank=True, default='')
    quantity = models.FloatField(default=0)
    unit = models.CharField(max_length=50, blank=True, default='')
    requires_driver = models.BooleanField(default=False)
    driver_id = models.CharField(max_length=64, blank=True, default='')
    driver_name = models.CharField(max_length=150, blank=True, default='')
    vehicle_id = models.CharField(max_length=64, blank=True, default='')
    vehicle_number = models.CharField(max_length=100, blank=True, default='')
    transit_cost = models.FloatField(default=0)
    rental_rate_per_day = models.FloatField(default=0)
    total_days = models.IntegerField(default=0)
    total_rental_cost = models.FloatField(default=0)
    status = models.CharField(max_length=50, default='active')
    notes = models.TextField(blank=True, default='')
    created_at = models.CharField(max_length=50, blank=True, default='')


class Supplier(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30, blank=True, default='')
    address = models.TextField(blank=True, default='')
    materials_supplied = models.TextField(blank=True, default='')
    supplied_materials = models.JSONField(default=list, blank=True)
    material_rates = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.CharField(max_length=50, blank=True, default='')

    def __str__(self):
        return self.name


class Vehicle(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    name = models.CharField(max_length=150)
    number = models.CharField(max_length=100)
    type = models.CharField(max_length=100, blank=True, default='Other')
    notes = models.TextField(blank=True, default='')
    created_at = models.CharField(max_length=50, blank=True, default='')

    def __str__(self):
        return f"{self.name} ({self.number})"


class MaterialRequest(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    site_id = models.CharField(max_length=64, blank=True, default='')
    site_name = models.CharField(max_length=200, blank=True, default='')
    requested_by_staff_id = models.CharField(max_length=64, blank=True, default='')
    requested_by_staff_name = models.CharField(max_length=150, blank=True, default='')
    date = models.CharField(max_length=50, blank=True, default='')
    time = models.CharField(max_length=50, blank=True, default='')
    items = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True, default='')
    status = models.CharField(max_length=50, default='pending')

    source_type = models.CharField(max_length=50, blank=True, default='')
    source_site_id = models.CharField(max_length=64, blank=True, default='')
    source_site_name = models.CharField(max_length=200, blank=True, default='')

    driver_id = models.CharField(max_length=64, blank=True, default='')
    driver_name = models.CharField(max_length=150, blank=True, default='')
    supplier_id = models.CharField(max_length=64, blank=True, default='')
    supplier_name = models.CharField(max_length=150, blank=True, default='')
    vehicle = models.CharField(max_length=150, blank=True, default='')
    vehicle_number = models.CharField(max_length=100, blank=True, default='')
    vehicle_type = models.CharField(max_length=100, blank=True, default='')
    assigned_at = models.CharField(max_length=50, blank=True, default='')
    start_time = models.CharField(max_length=50, blank=True, default='')

    end_time = models.CharField(max_length=50, blank=True, default='')
    duration = models.CharField(max_length=50, blank=True, default='')
    duration_hours = models.FloatField(default=0)
    driver_wage = models.FloatField(default=0)
    driver_hourly_rate = models.FloatField(default=0)
    completion_time = models.CharField(max_length=50, blank=True, default='')
    material_cost = models.FloatField(default=0)
    supplier_material_cost = models.FloatField(default=0)
    client_material_cost = models.FloatField(default=0)
    customer_material_cost = models.FloatField(default=0)
    total_cost = models.FloatField(default=0)
    client_total_cost = models.FloatField(default=0)
    customer_total_cost = models.FloatField(default=0)
    petrol_charge = models.FloatField(default=0)

    supplier_price = models.FloatField(default=0)
    supplier_paid_amount = models.FloatField(default=0)
    supplier_balance = models.FloatField(default=0)
    supplier_payment_method = models.CharField(max_length=100, blank=True, default='')
    supplier_payment_date = models.CharField(max_length=50, blank=True, default='')
    supplier_payment_notes = models.TextField(blank=True, default='')
    supplier_payments = models.JSONField(default=list, blank=True)

    gst_type = models.CharField(max_length=50, blank=True, default='none')
    igst_rate = models.FloatField(default=0)
    cgst_rate = models.FloatField(default=0)
    sgst_rate = models.FloatField(default=0)
    gst_amount = models.FloatField(default=0)

    completed_at = models.CharField(max_length=50, blank=True, default='')
    completion_notes = models.TextField(blank=True, default='')


class PayrollPaidStatus(models.Model):
    # key is `${staffId}_${fromDate}_${toDate}`
    key = models.CharField(max_length=150, primary_key=True)
    staff_id = models.CharField(max_length=64, blank=True, default='')
    from_date = models.CharField(max_length=50, blank=True, default='')
    to_date = models.CharField(max_length=50, blank=True, default='')
    paid_status = models.BooleanField(default=False)
    paid_at = models.CharField(max_length=50, blank=True, default='')
    note = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)


class PayrollHistory(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=generate_str_id)
    staff_id = models.CharField(max_length=64, blank=True, default='')
    from_date = models.CharField(max_length=50, blank=True, default='')
    to_date = models.CharField(max_length=50, blank=True, default='')
    amount = models.FloatField(default=0)
    date = models.CharField(max_length=50, blank=True, default='')
    mode = models.CharField(max_length=50, blank=True, default='Cash')
    note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)


class AppConfig(models.Model):
    key = models.CharField(max_length=100, primary_key=True)
    value = models.JSONField(default=dict)

    def __str__(self):
        return self.key
