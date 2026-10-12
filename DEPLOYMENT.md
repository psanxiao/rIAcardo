# Despliegue de rIAcardo

Guía para desplegar rIAcardo en un servidor propio (macOS, Linux o cualquier
máquina con Python y Docker). Al final se explica el caso concreto de un
**mac mini accedido de forma remota con Tailscale**.

La arquitectura de despliegue recomendada es:

```
                  Tailscale (red privada)
  cliente  ───────────────────────────────►  servidor
                                               ├─ FastAPI (sirve API + frontend compilado)  :9000
                                               └─ PostgreSQL (Docker)                        :5432
```

El backend FastAPI sirve a la vez la API (`/api/*`) y el frontend ya compilado
(`frontend/dist/`), de modo que todo queda en un único puerto (9000).

---

## 1. Requisitos

- **Python 3.11+** y `pip`
- **Node.js 20+** y `npm` (solo para compilar el frontend)
- **PostgreSQL 16+** (se recomienda vía Docker)
- **Docker** y **Docker Compose** (si usas la BD en contenedor)
- **Git**

---

## 2. Obtener el código

```bash
git clone <repo-url> rIAcardo
cd rIAcardo
```

---

## 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

| Variable | Descripción |
|---|---|
| `POSTGRES_HOST` / `POSTGRES_PORT` | Conexión a PostgreSQL (por defecto `localhost:5432`). |
| `POSTGRES_DATABASE` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Base de datos y credenciales. |
| `ENCRYPTION_KEY` | Clave Fernet. Genera con `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `JWT_SECRET_KEY` | Secreto para los tokens JWT. Genera con `openssl rand -hex 32` |
| `GROQ_API_KEY` | API key del coach IA ([console.groq.com](https://console.groq.com/)). |
| `GROQ_MODEL` | Modelo de Groq (por defecto `openai/gpt-oss-120b`). |
| `ALLOWED_ORIGINS` | Opcional. Orígenes CORS extra separados por comas. |
| `DB_POOL_MIN` / `DB_POOL_MAX` | Opcional. Tamaño del pool de conexiones. |

> Las credenciales de Garmin Connect **no** van en `.env`: se introducen desde la
> interfaz y se guardan cifradas en la base de datos.

---

## 4. Base de datos

### Opción A — PostgreSQL en Docker (recomendado)

```bash
docker compose up -d db
```

El servicio `db` de `docker-compose.yml` inicializa automáticamente el esquema base (`db/schema.sql`) en el primer arranque. Además, al arrancar el servicio (`run_service.sh` o el backend), el runner `db/migrate.py` aplica automáticamente cualquier migración pendiente en `db/migrations/`. Los datos persisten en el volumen `riacardo_pgdata`.

### Opción B — PostgreSQL ya existente

Crea la base de datos y aplica el esquema:

```bash
createdb -h <host> -U <user> riacardo
psql -h <host> -U <user> -d riacardo -f db/schema.sql
```

Ajusta `POSTGRES_*` en `.env` para apuntar a esa instancia.

---

## 5. Backend (Python)

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Para ejecutar los tests:

```bash
pip install -r requirements-dev.txt
pytest
```

---

## 6. Frontend (build)

El backend sirve el frontend ya compilado desde `frontend/dist/`:

```bash
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..
```

---

## 7. Arranque

### Modo rápido (manual)

```bash
./run_service.sh
```

Compila el frontend y arranca FastAPI en `http://0.0.0.0:9000`.

### Modo desarrollo (backend + Vite separados)

```bash
./run_network.sh
```

Backend en `:9000` y frontend de desarrollo en `:5173` (con recarga en caliente).

### Arranque manual del backend

```bash
export $(grep -v '^#' .env | xargs)
./venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 9000
```

---

## 8. Servicio persistente

### macOS (launchd) — recomendado para un mac mini

1. Rellena la plantilla con las rutas reales:

   ```bash
   sed "s|__PROJECT_DIR__|$PWD|g; s|__NODE_BIN__|$(dirname "$(command -v npm)")|g; s|__HOME__|$HOME|g" \
     deploy/com.riacardo.plist.template > ~/Library/LaunchAgents/com.riacardo.plist
   ```

2. Cárgalo (y actívalo al inicio de sesión):

   ```bash
   launchctl load ~/Library/LaunchAgents/com.riacardo.plist
   ```

3. Comprobación y control:

   ```bash
   launchctl list | grep riacardo
   launchctl kickstart -k "gui/$(id -u)/com.riacardo"   # reiniciar
   launchctl unload ~/Library/LaunchAgents/com.riacardo.plist   # detener
   ```

Los logs quedan en `logs/`.

> Evita que el mac se suspenda: Ajustes del Sistema → Batería/Energía →
> "Impedir que el Mac se duerma automáticamente cuando la pantalla está apagada".

### Linux (systemd)

1. Compila el frontend (paso 6) y crea el servicio:

   ```bash
   sudo sed "s|__PROJECT_DIR__|$PWD|g; s|__USER__|$USER|g" \
     deploy/riacardo.service > /etc/systemd/system/riacardo.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now riacardo
   ```

2. Estado y logs:

   ```bash
   systemctl status riacardo
   journalctl -u riacardo -f
   ```

### Docker (solo base de datos)

`docker-compose.yml` levanta únicamente PostgreSQL. El backend se ejecuta en el
host con launchd/systemd o manualmente.

---

## 9. Acceso remoto con Tailscale

[Tailscale](https://tailscale.com/) crea una red privada entre tus dispositivos
sin abrir puertos a Internet.

1. Instala Tailscale en el servidor y en el dispositivo cliente, e inicia sesión
   en la misma cuenta:

   ```bash
   tailscale up
   ```

2. Averigua la IP/nombre del servidor en la tailnet:

   ```bash
   tailscale status
   tailscale ip -4          # p. ej. 100.101.102.103
   ```

3. Accede desde cualquier dispositivo de la red:

   ```
   http://<nombre-o-ip-tailscale>:9000
   ```

El backend ya permite CORS desde `localhost` y desde el rango de Tailscale
(`100.64.0.0/10`), por lo que no hay que configurar nada más. Si sirves la app
desde un dominio propio, añádelo a `ALLOWED_ORIGINS`.

### HTTPS con Tailscale

```bash
# Publica la app en https://<nodo>:8443 sin tocar el puerto 443
tailscale serve --bg --yes --https=8443 http://127.0.0.1:9000
```

Expone la app con certificado TLS dentro de la tailnet en el puerto **8443**, y
deja libre el 443 para otros servicios del mismo nodo (p. ej. un Apache). Revisa
la configuración con `tailscale serve status` y desactívala con
`tailscale serve --https=8443 off`.

---

## 10. Google Calendar (opcional)

Permite sincronizar el plan de entrenamiento con Google Calendar mediante una
Service Account. Pasos detallados en la sección
["Configuración de Google Calendar"](README.es.md#configuración-de-google-calendar-opcional)
del README.

---

## 11. Actualización

```bash
git pull
source venv/bin/activate && pip install -r requirements.txt
cd frontend && npm install --legacy-peer-deps && npm run build && cd ..
# reiniciar el servicio:
launchctl kickstart -k "gui/$(id -u)/com.riacardo"   # macOS
# o:  sudo systemctl restart riacardo                 # Linux
```

Si el esquema de base de datos cambia, vuelve a aplicar `db/schema.sql`
(usa `CREATE TABLE IF NOT EXISTS`, es idempotente).

---

## 12. Copias de seguridad

Los datos viven en PostgreSQL. Volcado y restauración:

```bash
# Backup
pg_dump -h localhost -U postgres -d riacardo > riacardo_backup.sql

# Restaurar
psql -h localhost -U postgres -d riacardo < riacardo_backup.sql
```

Si usas el contenedor de Docker, el volumen de datos es `riacardo_pgdata`.

---

## 13. Notas de seguridad

- No subas `.env` ni `google_service_account.json` al repositorio (ya están en
  `.gitignore`).
- Rota `JWT_SECRET_KEY` y `ENCRYPTION_KEY` si sospechas que se han expuesto.
  **Nota:** cambiar `ENCRYPTION_KEY` invalida las credenciales de Garmin
  guardadas (habrá que volver a introducirlas).
- Exponer la app **solo** a través de Tailscale; no la publiques directamente a
  Internet salvo que añadas un proxy con HTTPS y autenticación.
