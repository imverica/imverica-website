#!/usr/bin/env python3
import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PORTAL = ROOT / "portal-backend"


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def read(relative):
    return (ROOT / relative).read_text(encoding="utf-8")


def parse(relative):
    return ast.parse(read(relative), filename=relative)


required_files = [
    "portal-backend/manage.py",
    "portal-backend/requirements.txt",
    "portal-backend/.env.example",
    "portal-backend/README.md",
    "portal-backend/imverica_portal/settings.py",
    "portal-backend/imverica_portal/urls.py",
    "portal-backend/portal/models.py",
    "portal-backend/portal/admin.py",
    "portal-backend/portal/views.py",
    "portal-backend/portal/urls.py",
    "portal-backend/portal/tests.py",
]

for file_path in required_files:
    assert_true((ROOT / file_path).exists(), f"Missing {file_path}")

for file_path in required_files:
    if file_path.endswith(".py"):
        parse(file_path)

requirements = read("portal-backend/requirements.txt")
assert_true("Django>=4.2,<5.0" in requirements, "Django must be pinned to 4.2 LTS for Python 3.9")
assert_true("psycopg" in requirements, "PostgreSQL driver missing")
assert_true("gunicorn" in requirements, "Production WSGI server missing")

settings = read("portal-backend/imverica_portal/settings.py")
for marker in [
    "dj_database_url.config",
    "DATABASE_URL",
    "CSRF_TRUSTED_ORIGINS",
    "WhiteNoiseMiddleware",
    "IMVERICA_ASTRO_ORIGIN",
]:
    assert_true(marker in settings, f"settings.py missing {marker}")

models = read("portal-backend/portal/models.py")
for model in [
    "ClientProfile",
    "Application",
    "DocumentUpload",
    "PaymentRecord",
    "CaseStatusEvent",
    "StaffNote",
]:
    assert_true(f"class {model}" in models, f"models.py missing {model}")

assert_true("FileField" in models, "DocumentUpload must store uploaded files")
assert_true("JSONField" in models, "Application must preserve intake/pdf JSON payloads")
assert_true("stripe_checkout_session_id" in models, "PaymentRecord must be Stripe-ready")

admin = read("portal-backend/portal/admin.py")
for model in ["Application", "DocumentUpload", "PaymentRecord", "StaffNote"]:
    assert_true(f"@admin.register({model})" in admin, f"admin.py missing {model} admin registration")

urls = read("portal-backend/portal/urls.py")
assert_true('path("health/"' in urls, "health endpoint missing")
assert_true('path("api/portal/schema/"' in urls, "portal schema endpoint missing")

gitignore = read(".gitignore")
for marker in ["portal-backend/.venv/", "portal-backend/db.sqlite3", "portal-backend/media/"]:
    assert_true(marker in gitignore, f".gitignore missing {marker}")

print("Django portal static QA passed")
