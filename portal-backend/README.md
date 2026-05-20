# Imverica Portal Backend

Django backend for the client portal. This sits beside the Astro public
site; it does not replace Astro and it does not replace the current
Node/pdf-lib PDF generator.

## Responsibility split

```text
Astro:
public website, SEO pages, service pages, FAQ, blog, pricing,
contact, intake start.

Django:
login, client dashboard, saved applications, PDF drafts,
document uploads, payment status, staff/admin review, case status,
staff notes.

Existing Node/pdf-lib:
USCIS PDF generation and current Netlify Functions until intentionally
moved into a separate service.
```

## Local setup

```bash
cd "portal-backend"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8000
```

Open:

- `http://127.0.0.1:8000/health/`
- `http://127.0.0.1:8000/api/portal/schema/`
- `http://127.0.0.1:8000/admin/`

## Production target

Use PostgreSQL via `DATABASE_URL`:

```text
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<strong secret>
DJANGO_ALLOWED_HOSTS=portal.imverica.com,api.imverica.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://imverica.com,https://portal.imverica.com
```

Hosting candidates:

- Render
- Railway
- Fly.io
- AWS / Lightsail / Elastic Beanstalk

Storage candidates:

- S3 compatible storage
- Supabase Storage
- Render disk only for local/staging, not final production document storage

## Current scope

This scaffold intentionally creates the data model and admin foundation
first. It does not yet implement:

- public login UI
- Stripe checkout
- S3/Supabase storage backend
- frontend-to-Django intake submit
- JWT/API token auth
- production email delivery

Those should be added as separate commits after the data model is stable.
