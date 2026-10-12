#!/bin/bash
# rIAcardo - Production Service Script
# Designed to be run by launchd for constant availability

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$PROJECT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
PID_FILE="$LOG_DIR/service.pid"
NODE_BIN="$(dirname "$(command -v npm 2>/dev/null || echo '/usr/local/bin/npm')")"

mkdir -p "$LOG_DIR"

echo "[$(date)] Starting rIAcardo Service..." >> "$LOG_DIR/service.log"

# Export environment variables if .env exists
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Ensure Docker Desktop is running
if ! docker info >/dev/null 2>&1; then
    echo "[$(date)] Docker is not running. Launching Docker Desktop..." >> "$LOG_DIR/service.log"
    open -a Docker
    DOCKER_TIMEOUT=60
    while ! docker info >/dev/null 2>&1; do
        sleep 2
        DOCKER_TIMEOUT=$((DOCKER_TIMEOUT - 2))
        if [ $DOCKER_TIMEOUT -le 0 ]; then
            echo "[$(date)] ERROR: Timed out waiting for Docker daemon to start." >> "$LOG_DIR/service.log"
            break
        fi
    done
fi

# Ensure PostgreSQL container is running and healthy
if docker info >/dev/null 2>&1; then
    echo "[$(date)] Ensuring database container (riacardo-db) is running..." >> "$LOG_DIR/service.log"
    docker compose -f "$PROJECT_DIR/docker-compose.yml" up -d db >> "$LOG_DIR/service.log" 2>&1

    # Wait up to 30 seconds for PostgreSQL to accept connections
    DB_TIMEOUT=30
    POSTGRES_USER="${POSTGRES_USER:-postgres}"
    POSTGRES_DB="${POSTGRES_DATABASE:-riacardo}"
    while ! docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
        sleep 1
        DB_TIMEOUT=$((DB_TIMEOUT - 1))
        if [ $DB_TIMEOUT -le 0 ]; then
            echo "[$(date)] WARNING: Timed out waiting for PostgreSQL to be ready." >> "$LOG_DIR/service.log"
            break
        fi
    done
    echo "[$(date)] Database is ready." >> "$LOG_DIR/service.log"
    echo "[$(date)] Running database migrations..." >> "$LOG_DIR/service.log"
    "$PROJECT_DIR/venv/bin/python" -m db.migrate >> "$LOG_DIR/service.log" 2>&1 || true
else
    echo "[$(date)] WARNING: Docker is unavailable. Proceeding anyway, but database may fail." >> "$LOG_DIR/service.log"
fi

# Build Frontend if dist/ doesn't exist yet or if REBUILD_FRONTEND=true
if [ "$REBUILD_FRONTEND" = "true" ] || [ ! -f "$PROJECT_DIR/frontend/dist/index.html" ]; then
    echo "[$(date)] Building Frontend..." >> "$LOG_DIR/service.log"
    cd "$PROJECT_DIR/frontend"
    "$NODE_BIN/npm" run build 2>&1 | tail -1 >> "$LOG_DIR/service.log"
    cd "$PROJECT_DIR"
else
    echo "[$(date)] Frontend build found in dist/ (skipping rebuild)." >> "$LOG_DIR/service.log"
fi

# Trap to gracefully stop backend on termination
cleanup() {
    echo "[$(date)] Stopping rIAcardo Service (PID: $BACKEND_PID)..." >> "$LOG_DIR/service.log"
    if [ -n "$BACKEND_PID" ]; then
        kill -TERM "$BACKEND_PID" 2>/dev/null
        wait "$BACKEND_PID" 2>/dev/null
    fi
    rm -f "$PID_FILE"
    exit 0
}
trap cleanup SIGINT SIGTERM SIGHUP

# Start Backend (FastAPI) - no --reload in production
cd "$PROJECT_DIR"
"$PROJECT_DIR/venv/bin/uvicorn" api.main:app --host 0.0.0.0 --port 9000 >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo $BACKEND_PID > "$PID_FILE"
echo "[$(date)] Backend running (PID: $BACKEND_PID), Frontend served from dist/" >> "$LOG_DIR/service.log"

# Wait for backend process
wait "$BACKEND_PID"
