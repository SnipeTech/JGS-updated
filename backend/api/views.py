import re
from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import connection, transaction

from .models import (
    Staff, Site, Customer, Product, Quotation, ManualExpense,
    Vendor, WorkEntry, DailyLog, Attendance, MaterialSetting,
    MaterialRental, Supplier, Vehicle, VehicleMaintenance, MaterialRequest,
    PayrollPaidStatus, PayrollHistory, AppConfig, StageCompletionRequest,
    StoreRoomDispatch
)
from .serializers import (
    StaffSerializer, SiteSerializer, CustomerSerializer,
    ProductSerializer, QuotationSerializer, ManualExpenseSerializer,
    VendorSerializer, WorkEntrySerializer, DailyLogSerializer,
    AttendanceSerializer, MaterialSettingSerializer,
    MaterialRentalSerializer, SupplierSerializer, VehicleSerializer,
    VehicleMaintenanceSerializer,
    MaterialRequestSerializer, PayrollPaidStatusSerializer,
    PayrollHistorySerializer, AppConfigSerializer, StageCompletionRequestSerializer,
    StoreRoomDispatchSerializer
)


def camel_to_snake(name: str) -> str:
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def snake_to_camel(name: str) -> str:
    components = name.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


def to_snake_dict(d):
    if isinstance(d, list):
        return [to_snake_dict(i) for i in d]
    elif isinstance(d, dict):
        return {camel_to_snake(k): to_snake_dict(v) for k, v in d.items()}
    return d


def to_camel_dict(d):
    if isinstance(d, list):
        return [to_camel_dict(i) for i in d]
    elif isinstance(d, dict):
        return {snake_to_camel(k): to_camel_dict(v) for k, v in d.items()}
    return d


@api_view(['GET'])
def health_check(request):
    """
    Check server status and PostgreSQL database connection.
    """
    db_ok = False
    error_message = None
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            row = cursor.fetchone()
            if row and row[0] == 1:
                db_ok = True
    except Exception as e:
        error_message = str(e)

    return Response({
        "status": "online",
        "database": "connected" if db_ok else "disconnected",
        "db_engine": connection.settings_dict.get('ENGINE'),
        "db_name": connection.settings_dict.get('NAME'),
        "db_user": connection.settings_dict.get('USER'),
        "db_host": connection.settings_dict.get('HOST'),
        "db_port": connection.settings_dict.get('PORT'),
        "error": error_message,
    }, status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE)


@api_view(['GET', 'POST', 'DELETE'])
def sync_app_state(request):
    """
    GET: Export entire state as JSON matching frontend AppState (camelCase).
    POST: Bulk import/synchronize frontend AppState into PostgreSQL.
    DELETE: Clear all application records from the database.
    """
    if request.method == 'GET':
        staff = to_camel_dict(StaffSerializer(Staff.objects.all(), many=True).data)
        sites = to_camel_dict(SiteSerializer(Site.objects.all(), many=True).data)
        customers = to_camel_dict(CustomerSerializer(Customer.objects.all(), many=True).data)
        products = to_camel_dict(ProductSerializer(Product.objects.all(), many=True).data)
        quotations = to_camel_dict(QuotationSerializer(Quotation.objects.all(), many=True).data)
        manual_expenses = to_camel_dict(ManualExpenseSerializer(ManualExpense.objects.all(), many=True).data)
        vendors = to_camel_dict(VendorSerializer(Vendor.objects.all(), many=True).data)
        work_entries = to_camel_dict(WorkEntrySerializer(WorkEntry.objects.all(), many=True).data)
        daily_logs = to_camel_dict(DailyLogSerializer(DailyLog.objects.all(), many=True).data)
        attendances = to_camel_dict(AttendanceSerializer(Attendance.objects.all(), many=True).data)
        material_settings = to_camel_dict(MaterialSettingSerializer(MaterialSetting.objects.all(), many=True).data)
        material_rentals = to_camel_dict(MaterialRentalSerializer(MaterialRental.objects.all(), many=True).data)
        suppliers = to_camel_dict(SupplierSerializer(Supplier.objects.all(), many=True).data)
        vehicles = to_camel_dict(VehicleSerializer(Vehicle.objects.all(), many=True).data)
        vehicle_maintenance = to_camel_dict(VehicleMaintenanceSerializer(VehicleMaintenance.objects.all(), many=True).data)
        material_requests = to_camel_dict(MaterialRequestSerializer(MaterialRequest.objects.all(), many=True).data)
        stage_completion_requests = to_camel_dict(StageCompletionRequestSerializer(StageCompletionRequest.objects.all(), many=True).data)
        store_room_dispatches = to_camel_dict(StoreRoomDispatchSerializer(StoreRoomDispatch.objects.all(), many=True).data)
        payroll_paid_status = to_camel_dict(PayrollPaidStatusSerializer(PayrollPaidStatus.objects.all(), many=True).data)
        payroll_history = to_camel_dict(PayrollHistorySerializer(PayrollHistory.objects.all(), many=True).data)

        labour_types_cfg = AppConfig.objects.filter(key='labourTypes').first()
        payment_stages_cfg = AppConfig.objects.filter(key='paymentStageMaster').first()
        units_cfg = AppConfig.objects.filter(key='unitMaster').first()
        crushed_stock_cfg = AppConfig.objects.filter(key='crushedStockHistory').first()

        labour_types = labour_types_cfg.value.get('items', []) if labour_types_cfg else ['painter', 'plumber', 'electrician', 'labour']
        payment_stage_master = payment_stages_cfg.value.get('items', []) if payment_stages_cfg else [
            'Level 1: Foundation', 'Level 2: Ground Floor Slab', 'Level 3: Plastering', 'Level 4: Finishing & Handover'
        ]
        unit_master = units_cfg.value.get('items', []) if units_cfg else [
            'Kg', 'Tons', 'Bags', 'Liters', 'Nos', 'Sets', 'Sq.Ft', 'Boxes', 'Meters', 'Loads', 'Units'
        ]
        crushed_stock_history = crushed_stock_cfg.value.get('items', []) if crushed_stock_cfg else []

        return Response({
            "staffList": staff,
            "sites": sites,
            "customers": customers,
            "products": products,
            "quotations": quotations,
            "manualExpenses": manual_expenses,
            "vendors": vendors,
            "workEntries": work_entries,
            "dailyLogs": daily_logs,
            "attendances": attendances,
            "materialSettings": material_settings,
            "suppliers": suppliers,
            "vehicles": vehicles,
            "vehicleMaintenance": vehicle_maintenance,
            "materialRequests": material_requests,
            "materialRentals": material_rentals,
            "stageCompletionRequests": stage_completion_requests,
            "storeRoomDispatches": store_room_dispatches,
            "crushedStockHistory": crushed_stock_history,
            "labourTypes": labour_types,
            "paymentStageMaster": payment_stage_master,
            "unitMaster": unit_master,
            "payrollPaidStatus": payroll_paid_status,
            "payrollHistory": payroll_history,
        })

    elif request.method == 'POST':
        data = request.data

        def upsert_items(model_class, items, id_field='id'):
            if not isinstance(items, list) or not items:
                return
            
            valid_items = []
            for raw_item in items:
                if not isinstance(raw_item, dict):
                    continue
                item = {camel_to_snake(k): v for k, v in raw_item.items()}
                item_id = item.get(id_field)
                if not item_id:
                    continue
                fields = {k: v for k, v in item.items() if hasattr(model_class, k) and k != id_field}
                valid_items.append((item_id, fields))
            
            if not valid_items:
                return

            item_ids = [it[0] for it in valid_items]
            existing_objs = {
                str(getattr(obj, id_field)): obj 
                for obj in model_class.objects.filter(**{f"{id_field}__in": item_ids})
            }

            to_create = []
            for item_id, fields in valid_items:
                obj = existing_objs.get(str(item_id))
                if obj:
                    changed = False
                    for field_name, new_val in fields.items():
                        current_val = getattr(obj, field_name)
                        if current_val != new_val:
                            setattr(obj, field_name, new_val)
                            changed = True
                    if changed:
                        obj.save()
                else:
                    new_obj = model_class(**{id_field: item_id, **fields})
                    to_create.append(new_obj)

            if to_create:
                model_class.objects.bulk_create(to_create, ignore_conflicts=True)

        with transaction.atomic():
            # Handle explicit deletions if requested by frontend
            deleted_map = data.get('deletedItems', {})
            if isinstance(deleted_map, dict):
                resource_model_map = {
                    'staff': Staff, 'staffList': Staff, 'sites': Site, 'customers': Customer,
                    'products': Product, 'quotations': Quotation, 'manualExpenses': ManualExpense,
                    'vendors': Vendor, 'workEntries': WorkEntry, 'dailyLogs': DailyLog,
                    'attendances': Attendance, 'materialSettings': MaterialSetting,
                    'materialRentals': MaterialRental, 'suppliers': Supplier,
                    'vehicles': Vehicle, 'vehicleMaintenance': VehicleMaintenance,
                    'materialRequests': MaterialRequest,
                    'stageCompletionRequests': StageCompletionRequest,
                    'storeRoomDispatches': StoreRoomDispatch
                }
                for res_key, ids in deleted_map.items():
                    m_class = resource_model_map.get(res_key)
                    if m_class and isinstance(ids, list) and ids:
                        m_class.objects.filter(id__in=ids).delete()

            if 'staffList' in data:
                upsert_items(Staff, data['staffList'])
            if 'sites' in data:
                upsert_items(Site, data['sites'])
            if 'customers' in data:
                upsert_items(Customer, data['customers'])
            if 'products' in data:
                upsert_items(Product, data['products'])
            if 'quotations' in data:
                upsert_items(Quotation, data['quotations'])
            if 'manualExpenses' in data:
                upsert_items(ManualExpense, data['manualExpenses'])
            if 'vendors' in data:
                upsert_items(Vendor, data['vendors'])
            if 'workEntries' in data:
                upsert_items(WorkEntry, data['workEntries'])
            if 'dailyLogs' in data:
                upsert_items(DailyLog, data['dailyLogs'])
            if 'attendances' in data:
                upsert_items(Attendance, data['attendances'])
            if 'materialSettings' in data:
                upsert_items(MaterialSetting, data['materialSettings'])
            if 'materialRentals' in data:
                upsert_items(MaterialRental, data['materialRentals'])
            if 'suppliers' in data:
                upsert_items(Supplier, data['suppliers'])
            if 'vehicles' in data:
                upsert_items(Vehicle, data['vehicles'])
            if 'vehicleMaintenance' in data:
                upsert_items(VehicleMaintenance, data['vehicleMaintenance'])
            if 'materialRequests' in data:
                upsert_items(MaterialRequest, data['materialRequests'])
            if 'stageCompletionRequests' in data:
                upsert_items(StageCompletionRequest, data['stageCompletionRequests'])
            if 'storeRoomDispatches' in data:
                upsert_items(StoreRoomDispatch, data['storeRoomDispatches'])
            if 'payrollPaidStatus' in data:
                upsert_items(PayrollPaidStatus, data['payrollPaidStatus'], id_field='key')
            if 'payrollHistory' in data:
                upsert_items(PayrollHistory, data['payrollHistory'])

            if 'labourTypes' in data and isinstance(data['labourTypes'], list):
                AppConfig.objects.update_or_create(key='labourTypes', defaults={'value': {'items': data['labourTypes']}})
            if 'paymentStageMaster' in data and isinstance(data['paymentStageMaster'], list):
                AppConfig.objects.update_or_create(key='paymentStageMaster', defaults={'value': {'items': data['paymentStageMaster']}})
            if 'unitMaster' in data and isinstance(data['unitMaster'], list):
                AppConfig.objects.update_or_create(key='unitMaster', defaults={'value': {'items': data['unitMaster']}})
            if 'crushedStockHistory' in data and isinstance(data['crushedStockHistory'], list):
                AppConfig.objects.update_or_create(key='crushedStockHistory', defaults={'value': {'items': data['crushedStockHistory']}})

        return Response({"message": "State synchronized successfully"}, status=status.HTTP_200_OK)

    elif request.method == 'DELETE':
        with transaction.atomic():
            Staff.objects.all().delete()
            Site.objects.all().delete()
            Customer.objects.all().delete()
            Product.objects.all().delete()
            Quotation.objects.all().delete()
            ManualExpense.objects.all().delete()
            Vendor.objects.all().delete()
            WorkEntry.objects.all().delete()
            DailyLog.objects.all().delete()
            Attendance.objects.all().delete()
            MaterialSetting.objects.all().delete()
            MaterialRental.objects.all().delete()
            Supplier.objects.all().delete()
            Vehicle.objects.all().delete()
            MaterialRequest.objects.all().delete()
            StageCompletionRequest.objects.all().delete()
            PayrollPaidStatus.objects.all().delete()
            PayrollHistory.objects.all().delete()
            AppConfig.objects.all().delete()

        return Response({"message": "All data cleared successfully from database"}, status=status.HTTP_200_OK)


class StaffViewSet(viewsets.ModelViewSet):
    queryset = Staff.objects.all().order_by('name')
    serializer_class = StaffSerializer


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.all().order_by('name')
    serializer_class = SiteSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by('name')
    serializer_class = CustomerSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by('name')
    serializer_class = ProductSerializer


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.all().order_by('-id')
    serializer_class = QuotationSerializer


class ManualExpenseViewSet(viewsets.ModelViewSet):
    queryset = ManualExpense.objects.all().order_by('-date')
    serializer_class = ManualExpenseSerializer


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all().order_by('name')
    serializer_class = VendorSerializer


class WorkEntryViewSet(viewsets.ModelViewSet):
    queryset = WorkEntry.objects.all().order_by('-date')
    serializer_class = WorkEntrySerializer


class DailyLogViewSet(viewsets.ModelViewSet):
    queryset = DailyLog.objects.all().order_by('-date')
    serializer_class = DailyLogSerializer


class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all().order_by('-date')
    serializer_class = AttendanceSerializer


class MaterialSettingViewSet(viewsets.ModelViewSet):
    queryset = MaterialSetting.objects.all().order_by('name')
    serializer_class = MaterialSettingSerializer


class MaterialRentalViewSet(viewsets.ModelViewSet):
    queryset = MaterialRental.objects.all().order_by('-start_date')
    serializer_class = MaterialRentalSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by('name')
    serializer_class = VehicleSerializer


class VehicleMaintenanceViewSet(viewsets.ModelViewSet):
    queryset = VehicleMaintenance.objects.all().order_by('-date')
    serializer_class = VehicleMaintenanceSerializer


class MaterialRequestViewSet(viewsets.ModelViewSet):
    queryset = MaterialRequest.objects.all().order_by('-date')
    serializer_class = MaterialRequestSerializer


class PayrollPaidStatusViewSet(viewsets.ModelViewSet):
    queryset = PayrollPaidStatus.objects.all()
    serializer_class = PayrollPaidStatusSerializer


class PayrollHistoryViewSet(viewsets.ModelViewSet):
    queryset = PayrollHistory.objects.all().order_by('-created_at')
    serializer_class = PayrollHistorySerializer


class AppConfigViewSet(viewsets.ModelViewSet):
    queryset = AppConfig.objects.all()
    serializer_class = AppConfigSerializer
