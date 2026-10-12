from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import mimetypes
import os
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from api.dependencies.limiter import limiter
from api.routes.auth_routes import router as auth_router
from api.routes.garmin_routes import router as garmin_router
from api.routes.analysis_routes import router as analysis_router
from api.routes.coach_routes import router as coach_router
from api.routes.settings_routes import router as settings_router
from api.services.sync_service import resume_interrupted_syncs

app = FastAPI(title="rIAcardo API", description="SaaS Backend for Cycling Performance Analysis")

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.on_event("startup")
async def startup_event():
    # Ensure database schema is up to date and all migrations are applied
    try:
        from db.migrate import run_migrations
        run_migrations()
    except Exception as e:
        print(f"[INIT] Database migration error on startup: {e}")

    # Resume any syncs that were interrupted when the server stopped
    await resume_interrupted_syncs()

@app.on_event("shutdown")
async def shutdown_event():
    from api.dependencies.database import close_all_connections
    close_all_connections()

# Register routers
app.include_router(auth_router)
app.include_router(garmin_router)
app.include_router(analysis_router)
app.include_router(coach_router)
app.include_router(settings_router)

# CORS: localhost (dev) + cualquier IP de Tailscale (100.64.0.0/10) + dominios custom
# Tailscale usa IPs 100.64.x.x a 100.127.x.x (CGNAT range)
_allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
_allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]
# Regex: localhost en cualquier puerto + rango Tailscale 100.64-127.x.x en cualquier puerto
# Tailscale CGNAT = 100.64.0.0/10 → 100.64.0.0 a 100.127.255.255
_tailscale_regex = r"^http://(localhost|127\.0\.0\.1|100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3})(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_tailscale_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    # In production (dist/ served), return the SPA index.html
    dist_index = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist", "index.html")
    if os.path.exists(dist_index):
        return FileResponse(dist_index)
    return {"status": "ok", "message": "Welcome to rIAcardo API — run `npm run build` and restart to serve the frontend"}


# --- Production: serve built frontend (dist/) ---
# Static assets (JS/CSS/images) at /assets and /static
_dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(_dist_dir):
    # Mount static asset directories
    for _asset_dir in ("assets", "static", "icons", "pwa"):
        _p = os.path.join(_dist_dir, _asset_dir)
        if os.path.isdir(_p):
            app.mount(f"/{_asset_dir}", StaticFiles(directory=_p), name=f"static-{_asset_dir}")

    # Explicit MIME types for files Python's mimetypes may not know
    _MIME_OVERRIDES = {
        ".webmanifest": "application/manifest+json",
    }

    _dist_index = os.path.join(_dist_dir, "index.html")

    # SPA fallback: serve real files from dist root (sw.js, registerSW.js,
    # manifest.webmanifest, favicon.svg...), otherwise index.html for the SPA.
    @app.api_route("/{full_path:path}", methods=["GET"])
    def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        candidate = os.path.normpath(os.path.join(_dist_dir, full_path))
        if candidate.startswith(_dist_dir + os.sep) and os.path.isfile(candidate):
            ext = os.path.splitext(candidate)[1].lower()
            return FileResponse(candidate, media_type=_MIME_OVERRIDES.get(ext))

        return FileResponse(_dist_index)
