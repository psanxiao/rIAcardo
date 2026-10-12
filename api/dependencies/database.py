import os
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool, PoolError
from dotenv import load_dotenv

load_dotenv()

PG_HOST = os.getenv("POSTGRES_HOST", "localhost")
PG_PORT = os.getenv("POSTGRES_PORT", "5432")
PG_DATABASE = os.getenv("POSTGRES_DATABASE", "riacardo")
PG_USER = os.getenv("POSTGRES_USER", "postgres")
PG_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

_POOL_MIN = int(os.getenv("DB_POOL_MIN", "2"))
_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))

_pool = None


def _get_pool():
    """Lazily initialises the connection pool (thread-safe)."""
    global _pool
    if _pool is None:
        try:
            _pool = ThreadedConnectionPool(
                _POOL_MIN, _POOL_MAX,
                host=PG_HOST, port=PG_PORT, database=PG_DATABASE,
                user=PG_USER, password=PG_PASSWORD
            )
            print(f"[DB] Connection pool created ({_POOL_MIN}-{_POOL_MAX} connections)")
        except Exception as e:
            print(f"[DB] Error creating connection pool: {e}")
            return None
    return _pool


class PooledConnection:
    """Wrapper around a psycopg2 connection that returns it to ThreadedConnectionPool on close()."""
    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool
        self._closed = False

    def close(self):
        if not self._closed:
            self._closed = True
            if self._pool is not None and self._conn is not None:
                try:
                    if not self._conn.closed and self._conn.status == psycopg2.extensions.STATUS_IN_TRANSACTION:
                        self._conn.rollback()
                except Exception:
                    pass
                try:
                    self._pool.putconn(self._conn)
                except Exception:
                    try:
                        self._conn.close()
                    except Exception:
                        pass
            elif self._conn is not None:
                try:
                    self._conn.close()
                except Exception:
                    pass

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __enter__(self):
        return self._conn.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self._conn.__exit__(exc_type, exc_val, exc_tb)


def get_db_connection():
    """Returns a pooled connection. Caller MUST call conn.close() to return it to the pool."""
    pool = _get_pool()
    if pool is None:
        # Fallback to direct connection if pool failed
        try:
            return psycopg2.connect(
                host=PG_HOST, port=PG_PORT, database=PG_DATABASE,
                user=PG_USER, password=PG_PASSWORD
            )
        except psycopg2.Error as e:
            print(f"Error connecting to the PostgreSQL database: {e}")
            return None
    try:
        conn = pool.getconn()
        return PooledConnection(conn, pool)
    except PoolError as e:
        print(f"[DB] Pool exhausted: {e}, falling back to direct connection")
        try:
            return psycopg2.connect(
                host=PG_HOST, port=PG_PORT, database=PG_DATABASE,
                user=PG_USER, password=PG_PASSWORD
            )
        except psycopg2.Error as e:
            print(f"Error connecting to the PostgreSQL database: {e}")
            return None


def close_all_connections():
    """Closes all connections in the pool — call on app shutdown."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
        print("[DB] All pool connections closed")