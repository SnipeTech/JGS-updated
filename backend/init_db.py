import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

DB_NAME = os.getenv('DB_NAME', 'construction_db')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

print("=" * 60)
print("PostgreSQL Database Initialization Tool")
print("=" * 60)
print(f"Target Database : {DB_NAME}")
print(f"User            : {DB_USER}")
print(f"Host            : {DB_HOST}:{DB_PORT}")

try:
    import psycopg
    from psycopg import sql

    # Connect to default postgres maintenance database with autocommit
    conn = psycopg.connect(
        dbname="postgres",
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
        autocommit=True
    )

    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (DB_NAME,))
        exists = cur.fetchone()
        if exists:
            print(f"[OK] Database '{DB_NAME}' already exists.")
        else:
            print(f"[*] Creating database '{DB_NAME}'...")
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_NAME)))
            print(f"[OK] Database '{DB_NAME}' created successfully!")

    conn.close()
    print("\nNext step: Run migrations with:")
    print("  python manage.py makemigrations api")
    print("  python manage.py migrate")
    print("=" * 60)

except Exception as err:
    print(f"\n[!] PostgreSQL Connection Error: {err}")
    print("\nPlease verify your PostgreSQL credentials in 'backend/.env':")
    print(f"  DB_NAME={DB_NAME}")
    print(f"  DB_USER={DB_USER}")
    print(f"  DB_PASSWORD=<your_actual_postgres_password>")
    print(f"  DB_HOST={DB_HOST}")
    print(f"  DB_PORT={DB_PORT}")
    print("\nIf PostgreSQL requires a different password, update DB_PASSWORD in backend/.env and re-run this script.")
    print("=" * 60)
    sys.exit(1)
