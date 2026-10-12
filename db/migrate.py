"""
Database Migration & Initialization Runner for rIAcardo.

This script ensures that:
1. On fresh deployments, base schema (`db/schema.sql`) is executed if the database is uninitialized.
2. The `public.schema_migrations` table tracks all applied migration scripts.
3. Any pending `.sql` files in `db/migrations/` are applied in alphabetical order in transactions.

Usage:
    python -m db.migrate
    python db/migrate.py
    Or imported into FastAPI startup: from db.migrate import run_migrations
"""

import os
import sys
import time
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

# Load environment variables
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_PORT = os.getenv("POSTGRES_PORT", "5432")
PG_DATABASE = os.getenv("POSTGRES_DATABASE", "riacardo")
PG_USER = os.getenv("POSTGRES_USER", "postgres")
PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

DB_DIR = Path(__file__).resolve().parent
SCHEMA_FILE = DB_DIR / "schema.sql"
MIGRATIONS_DIR = DB_DIR / "migrations"


def get_connection(retries: int = 5, delay: float = 2.0):
    """Obtains a direct psycopg2 connection, retrying if PostgreSQL is starting up."""
    for attempt in range(1, retries + 1):
        try:
            conn = psycopg2.connect(
                host=PG_HOST,
                port=PG_PORT,
                database=PG_DATABASE,
                user=PG_USER,
                password=PG_PASSWORD,
            )
            return conn
        except psycopg2.OperationalError as e:
            if attempt < retries:
                print(f"[DB] Waiting for database ({attempt}/{retries})...")
                time.sleep(delay)
            else:
                print(f"[DB ERROR] Could not connect to database after {retries} attempts: {e}")
                raise


def run_migrations():
    """
    Runs schema initialization and pending migrations.
    Returns True if successful, False otherwise.
    """
    print("[DB] Checking database status and migrations...")
    try:
        conn = get_connection()
    except Exception as e:
        print(f"[DB ERROR] Migration runner aborted: {e}")
        return False

    try:
        with conn.cursor() as cur:
            # 1. Check if base tables exist (e.g. users table)
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                );
            """)
            has_users_table = cur.fetchone()[0]

            if not has_users_table:
                if SCHEMA_FILE.exists():
                    print(f"[DB INIT] Database empty. Applying initial schema from {SCHEMA_FILE.name}...")
                    with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
                        schema_sql = f.read()
                    cur.execute(schema_sql)
                    conn.commit()
                    print("[DB INIT] Initial schema created successfully.")
                else:
                    print(f"[DB WARNING] Initial schema file not found at {SCHEMA_FILE}")

            # 2. Ensure schema_migrations table exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS public.schema_migrations (
                    version VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)
            conn.commit()

            # 3. Retrieve already applied migrations
            cur.execute("SELECT version FROM public.schema_migrations;")
            applied = set(row[0] for row in cur.fetchall())

            # 4. Find all migration files in db/migrations/*.sql
            if MIGRATIONS_DIR.exists():
                migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
                for m_file in migration_files:
                    version = m_file.name
                    if version not in applied:
                        print(f"[DB MIGRATION] Applying migration: {version}...")
                        try:
                            with open(m_file, "r", encoding="utf-8") as f:
                                sql_content = f.read()
                            cur.execute(sql_content)
                            cur.execute(
                                "INSERT INTO public.schema_migrations (version) VALUES (%s);",
                                (version,)
                            )
                            conn.commit()
                            print(f"[DB MIGRATION] Successfully applied: {version}")
                        except Exception as err:
                            conn.rollback()
                            print(f"[DB MIGRATION ERROR] Failed applying {version}: {err}")
                            raise
            else:
                print(f"[DB] No migrations folder found at {MIGRATIONS_DIR}")

        print("[DB] All migrations are up to date.")
        return True
    finally:
        conn.close()


if __name__ == "__main__":
    success = run_migrations()
    sys.exit(0 if success else 1)
