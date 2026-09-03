from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from app.config import WEBAPP_DIR
from app.db import init_db
from app.routes import calls, messages, users
from app.ws import signaling


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Calling & Chat Backend", lifespan=lifespan)

# CORS is only really needed while developing the frontend separately
# (vite dev server on a different port). Once built into /webapp and
# served by this same app, it's same-origin and this is moot.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(calls.router)
app.include_router(messages.router)
app.include_router(signaling.router)


# --- Serve the built React app (frontend/dist -> backend/webapp) ---
if (WEBAPP_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=WEBAPP_DIR / "assets"), name="assets")

if WEBAPP_DIR.exists():

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        """Any non-API path falls back to index.html so React Router
        (client-side routing) works on refresh/direct links too."""
        candidate = WEBAPP_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(WEBAPP_DIR / "index.html")

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}