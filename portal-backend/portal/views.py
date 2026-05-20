from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .models import Application


@require_GET
def health(request):
    return JsonResponse(
        {
            "ok": True,
            "service": "imverica-portal",
            "astro_origin": settings.IMVERICA_ASTRO_ORIGIN,
        }
    )


@require_GET
def portal_schema(request):
    return JsonResponse(
        {
            "application_statuses": [status for status, _label in Application.STATUS_CHOICES],
            "storage_provider": settings.IMVERICA_STORAGE_PROVIDER,
            "notes": [
                "Astro remains the public website.",
                "Django owns client portal, saved applications, uploads, payments, and admin review.",
                "PDF generation remains in the existing Node/pdf-lib pipeline until intentionally moved.",
            ],
        }
    )
