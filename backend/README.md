# Construction Management Backend (Django + PostgreSQL)

This is the standalone Django REST backend for the Construction Management application, configured with PostgreSQL and Django REST Framework.

---

## 📁 Project Structure

```
backend/
├── venv/                 # Python Virtual Environment
├── core/                 # Django project settings & URL routing
│   ├── settings.py       # PostgreSQL & CORS & REST Framework configuration
│   ├── urls.py           # Root URL routing
│   └── wsgi.py
├── api/                  # Django REST API application
│   ├── models.py         # Construction data models (Staff, Sites, Quotations, Materials, etc.)
│   ├── serializers.py    # Serializers for all models
│   ├── views.py          # ViewSets + /api/health/ + /api/sync/
│   ├── urls.py           # Endpoints routing
│   └── admin.py          # Django Admin panel registration
├── .env                  # Database and environment secrets (not committed)
├── .env.example          # Sample environment configuration
├── requirements.txt      # Python dependencies
├── init_db.py            # Automated PostgreSQL database creator helper
└── manage.py             # Django CLI
```

---

## 🚀 Quick Setup & Run Instructions

### 1. Activate the Virtual Environment (`venv`)

From the `backend` directory in PowerShell or Command Prompt:

**PowerShell:**
```powershell
.\venv\Scripts\Activate.ps1
```
*(If PowerShell restricts script execution, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` or activate using CMD)*

**Command Prompt (cmd):**
```cmd
venv\Scripts\activate.bat
```

---

### 2. Configure PostgreSQL Database Credentials

Open `backend/.env` and update your PostgreSQL credentials:

```env
DB_NAME=construction_db
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password
DB_HOST=localhost
DB_PORT=5432
```

---

### 3. Initialize the Database

Run the automated helper to verify connectivity and create the `construction_db` database if it doesn't already exist:

```powershell
python init_db.py
```

---

### 4. Run Migrations

Apply the database schema to your PostgreSQL database:

```powershell
python manage.py migrate
```

---

### 5. Create an Admin Account (Optional)

To access the Django Admin dashboard at `http://127.0.0.1:8000/admin/`:

```powershell
python manage.py createsuperuser
```

---

### 6. Start the Django Backend Server

```powershell
python manage.py runserver
```

The API will be available at **`http://127.0.0.1:8000/`**.

---

## 📡 Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health/` | `GET` | Health check & verifies PostgreSQL connection |
| `/api/sync/` | `GET` / `POST` | Import/Export entire application state |
| `/api/staff/` | `GET`, `POST`, `PUT`, `DELETE` | Staff & Labour management |
| `/api/sites/` | `GET`, `POST`, `PUT`, `DELETE` | Construction Sites & Stages |
| `/api/customers/` | `GET`, `POST`, `PUT`, `DELETE` | Customer directory |
| `/api/products/` | `GET`, `POST`, `PUT`, `DELETE` | Products & rate items |
| `/api/quotations/` | `GET`, `POST`, `PUT`, `DELETE` | Quotations & Estimates |
| `/api/expenses/` | `GET`, `POST`, `PUT`, `DELETE` | Manual Site Expenses |
| `/api/vendors/` | `GET`, `POST`, `PUT`, `DELETE` | Vendors |
| `/api/work-entries/`| `GET`, `POST`, `PUT`, `DELETE` | Work logs |
| `/api/daily-logs/` | `GET`, `POST`, `PUT`, `DELETE` | Daily supervisor logs |
| `/api/attendances/`| `GET`, `POST`, `PUT`, `DELETE` | Attendance & OT tracking |
| `/api/material-settings/` | `GET`, `POST`, `PUT`, `DELETE` | Material settings & rental rates |
| `/api/material-rentals/` | `GET`, `POST`, `PUT`, `DELETE` | Rental items tracking |
| `/api/suppliers/` | `GET`, `POST`, `PUT`, `DELETE` | Material suppliers & rates |
| `/api/vehicles/` | `GET`, `POST`, `PUT`, `DELETE` | Vehicle fleet |
| `/api/material-requests/` | `GET`, `POST`, `PUT`, `DELETE` | Requisitions, transit & billing |
| `/api/payroll-status/` | `GET`, `POST`, `PUT`, `DELETE` | Staff salary paid status |
| `/api/payroll-history/`| `GET`, `POST`, `PUT`, `DELETE` | Staff salary payment history |
| `/admin/` | `GET` | Django Admin Dashboard |

---

## 💻 Connecting from Frontend

The frontend already has an API service configured in [`src/services/api.ts`](../src/services/api.ts).
You can point to this backend by ensuring the server is running on port 8000, or by defining `VITE_API_URL=http://127.0.0.1:8000/api` in your frontend `.env`.
