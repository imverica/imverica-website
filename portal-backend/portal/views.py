import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import Application, ClientProfile, DocumentUpload


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


def _post_value(request, *keys):
    for key in keys:
        value = request.POST.get(key)
        if value is not None:
            return value.strip()
    return ""


def _phone_digits(value):
    digits = "".join(character for character in value if character.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        return digits[1:]
    return digits


def _validate_portal_intake(request):
    email = _post_value(request, "email")
    phone = _phone_digits(_post_value(request, "phone"))
    payload = {
        "first_name": _post_value(request, "first_name", "fname"),
        "last_name": _post_value(request, "last_name", "lname"),
        "phone": phone,
        "email": email.lower(),
        "service": _post_value(request, "service", "service_type"),
        "description": _post_value(request, "description"),
    }
    errors = {}

    for field in ["first_name", "last_name", "phone", "service"]:
        if not payload[field]:
            errors[field] = "This field is required."

    if phone and len(phone) != 10:
        errors["phone"] = "Use a 10-digit U.S. phone number."

    if email:
        try:
            EmailValidator()(email)
        except ValidationError:
            errors["email"] = "Use a valid email address."

    return payload, errors


def _portal_username(payload):
    if payload["email"]:
        return payload["email"][:150]
    suffix = payload["phone"] or uuid.uuid4().hex[:12]
    return f"portal-{suffix}"[:150]


def _get_or_create_portal_user(payload):
    User = get_user_model()
    username = _portal_username(payload)
    user, _created = User.objects.get_or_create(username=username)
    update_fields = []

    for field in ["first_name", "last_name", "email"]:
        value = payload[field]
        if getattr(user, field) != value:
            setattr(user, field, value)
            update_fields.append(field)

    if update_fields:
        user.save(update_fields=update_fields)

    profile, _profile_created = ClientProfile.objects.get_or_create(user=user)
    if profile.phone != payload["phone"]:
        profile.phone = payload["phone"]
        profile.save(update_fields=["phone", "updated_at"])

    return user


@require_POST
def portal_intake(request):
    payload, errors = _validate_portal_intake(request)
    if errors:
        return JsonResponse({"ok": False, "errors": errors}, status=400)

    user = _get_or_create_portal_user(payload)
    application = Application.objects.create(
        client=user,
        service_type=payload["service"],
        language=ClientProfile.LANGUAGE_ENGLISH,
        status=Application.STATUS_INTAKE_SUBMITTED,
        source=Application.SOURCE_PORTAL,
        submitted_at=timezone.now(),
        intake_data={
            "source": "portal.html",
            "contact": {
                "first_name": payload["first_name"],
                "last_name": payload["last_name"],
                "phone": payload["phone"],
                "email": payload["email"],
            },
            "service": payload["service"],
            "description": payload["description"],
        },
    )

    documents = []
    for uploaded_file in request.FILES.getlist("documents"):
        documents.append(
            DocumentUpload.objects.create(
                application=application,
                uploaded_by=user,
                document_type=DocumentUpload.TYPE_OTHER,
                file=uploaded_file,
                original_filename=uploaded_file.name,
                content_type=getattr(uploaded_file, "content_type", "") or "",
                size_bytes=uploaded_file.size,
            )
        )

    return JsonResponse(
        {
            "ok": True,
            "application_id": str(application.id),
            "status": application.status,
            "documents_received": len(documents),
        },
        status=201,
    )
