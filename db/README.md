# Gestión de Base de Datos y Migraciones de rIAcardo

Este directorio contiene el esquema base y el sistema de migraciones automáticas de rIAcardo.

## Estructura

- **`schema.sql`**: Esquema maestro completo de la base de datos (foto fija inicial).
- **`migrations/`**: Carpeta de migraciones incrementales (`0001_...sql`, `0002_...sql`, etc.).
- **`migrate.py`**: Runner automático de inicialización y migraciones.

---

## ¿Cómo funciona el despliegue desde cero?

Cuando la aplicación o el servicio arrancan por primera vez (`run_service.sh` o `uvicorn api.main:app`):
1. **Comprobación:** Si la base de datos está vacía (no existe la tabla `users`), ejecuta automáticamente `schema.sql`.
2. **Historial de migraciones:** Crea la tabla `public.schema_migrations` si no existe.
3. **Migraciones pendientes:** Aplica en orden cualquier archivo `.sql` en `migrations/` que no haya sido aplicado previamente y lo registra.

Todo el proceso es **100% automático y desatendido**.

---

## Regla para hacer cambios en la base de datos ("a mano")

Cuando se añada una columna, tabla o índice a la base de datos:

1. **Crea un archivo en `db/migrations/`**:
   Usa un prefijo numérico secuencial de 4 dígitos y un nombre claro:
   ```bash
   db/migrations/0003_add_user_preferences.sql
   ```
2. **Escribe las sentencias SQL**:
   Usa sentencias seguras/idempotentes siempre que sea posible:
   ```sql
   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'dark';
   ```
3. **Actualiza también `db/schema.sql`**:
   Refleja la nueva columna o tabla en `schema.sql` para mantener actualizada la foto fija completa.

Al hacer esto, el cambio se aplicará automáticamente tanto en entornos existentes como en cualquier deploy nuevo desde cero.
