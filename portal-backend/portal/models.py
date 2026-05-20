import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ClientProfile(TimeStampedModel):
    LANGUAGE_ENGLISH = "en"
    LANGUAGE_RUSSIAN = "ru"
    LANGUAGE_UKRAINIAN = "uk"
    LANGUAGE_SPANISH = "es"

    LANGUAGE_CHOICES = [
        (LANGUAGE_ENGLISH, "English"),
        (LANGUAGE_RUSSIAN, "Russian"),
        (LANGUAGE_UKRAINIAN, "Ukrainian"),
        (LANGUAGE_SPANISH, "Spanish"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="client_profile")
    phone = models.CharField(max_length=32, blank=True)
    preferred_language = models.CharField(max_length=8, choices=LANGUAGE_CHOICES, default=LANGUAGE_ENGLISH)
    mailing_address = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return self.user.get_full_name() or self.user.email or self.user.username


class Application(TimeStampedModel):
    STATUS_DRAFT = "draft"
    STATUS_INTAKE_SUBMITTED = "intake_submitted"
    STATUS_PAYMENT_PENDING = "payment_pending"
    STATUS_PAID = "paid"
    STATUS_IN_REVIEW = "in_review"
    STATUS_PDF_READY = "pdf_ready"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELED = "canceled"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_INTAKE_SUBMITTED, "Intake submitted"),
        (STATUS_PAYMENT_PENDING, "Payment pending"),
        (STATUS_PAID, "Paid"),
        (STATUS_IN_REVIEW, "In review"),
        (STATUS_PDF_READY, "PDF ready"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELED, "Canceled"),
    ]

    SOURCE_HERO = "hero"
    SOURCE_PORTAL = "portal"
    SOURCE_STAFF = "staff"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="applications")
    service_type = models.CharField(max_length=120)
    form_code = models.CharField(max_length=32, blank=True, db_index=True)
    language = models.CharField(max_length=8, default=ClientProfile.LANGUAGE_ENGLISH)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    source = models.CharField(max_length=32, default=SOURCE_HERO)
    intake_data = models.JSONField(default=dict, blank=True)
    pdf_payload = models.JSONField(default=dict, blank=True)
    official_form_revision = models.CharField(max_length=80, blank=True)
    price_cents = models.PositiveIntegerField(default=0)
    submitted_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["status", "updated_at"]),
            models.Index(fields=["form_code", "status"]),
        ]

    def mark_submitted(self):
        self.status = self.STATUS_INTAKE_SUBMITTED
        self.submitted_at = timezone.now()
        self.save(update_fields=["status", "submitted_at", "updated_at"])

    def __str__(self):
        code = self.form_code or self.service_type
        return f"{code} — {self.client}"


class DocumentUpload(TimeStampedModel):
    TYPE_ID = "id"
    TYPE_PASSPORT = "passport"
    TYPE_NOTICE = "notice"
    TYPE_EVIDENCE = "evidence"
    TYPE_TRANSLATION = "translation"
    TYPE_OTHER = "other"

    TYPE_CHOICES = [
        (TYPE_ID, "ID"),
        (TYPE_PASSPORT, "Passport"),
        (TYPE_NOTICE, "Notice"),
        (TYPE_EVIDENCE, "Evidence"),
        (TYPE_TRANSLATION, "Translation"),
        (TYPE_OTHER, "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="documents")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploaded_documents")
    document_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default=TYPE_OTHER)
    file = models.FileField(upload_to="client-documents/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    is_reviewed = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.original_filename


class PaymentRecord(TimeStampedModel):
    STATUS_PENDING = "pending"
    STATUS_SUCCEEDED = "succeeded"
    STATUS_FAILED = "failed"
    STATUS_REFUNDED = "refunded"

    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SUCCEEDED, "Succeeded"),
        (STATUS_FAILED, "Failed"),
        (STATUS_REFUNDED, "Refunded"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.PROTECT, related_name="payments")
    amount_cents = models.PositiveIntegerField()
    currency = models.CharField(max_length=8, default="usd")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    stripe_checkout_session_id = models.CharField(max_length=255, blank=True, db_index=True)
    stripe_payment_intent_id = models.CharField(max_length=255, blank=True, db_index=True)
    raw_event = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        dollars = self.amount_cents / 100
        return f"{self.application} — ${dollars:.2f} {self.status}"


class CaseStatusEvent(TimeStampedModel):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="status_events")
    status = models.CharField(max_length=32, choices=Application.STATUS_CHOICES)
    message = models.CharField(max_length=255, blank=True)
    visible_to_client = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_status_events")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.application} — {self.status}"


class StaffNote(TimeStampedModel):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="staff_notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="staff_notes")
    body = models.TextField()
    is_private = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note by {self.author} on {self.application}"
