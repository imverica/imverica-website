from django.contrib import admin

from .models import (
    Application,
    CaseStatusEvent,
    ClientProfile,
    DocumentUpload,
    PaymentRecord,
    StaffNote,
)


@admin.register(ClientProfile)
class ClientProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "phone", "preferred_language", "updated_at")
    search_fields = ("user__first_name", "user__last_name", "user__email", "phone")
    list_filter = ("preferred_language",)


class DocumentUploadInline(admin.TabularInline):
    model = DocumentUpload
    extra = 0
    readonly_fields = ("created_at", "updated_at")


class PaymentRecordInline(admin.TabularInline):
    model = PaymentRecord
    extra = 0
    readonly_fields = ("created_at", "updated_at", "raw_event")


class StaffNoteInline(admin.TabularInline):
    model = StaffNote
    extra = 0
    readonly_fields = ("created_at", "updated_at")


class CaseStatusEventInline(admin.TabularInline):
    model = CaseStatusEvent
    extra = 0
    readonly_fields = ("created_at", "updated_at")


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("form_code", "service_type", "client", "status", "language", "price_cents", "updated_at")
    list_filter = ("status", "language", "service_type", "form_code")
    search_fields = ("client__first_name", "client__last_name", "client__email", "form_code", "service_type")
    readonly_fields = ("id", "created_at", "updated_at", "submitted_at", "paid_at")
    inlines = [DocumentUploadInline, PaymentRecordInline, CaseStatusEventInline, StaffNoteInline]


@admin.register(DocumentUpload)
class DocumentUploadAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "application", "document_type", "is_reviewed", "created_at")
    list_filter = ("document_type", "is_reviewed")
    search_fields = ("original_filename", "application__form_code", "application__client__email")


@admin.register(PaymentRecord)
class PaymentRecordAdmin(admin.ModelAdmin):
    list_display = ("application", "amount_cents", "currency", "status", "updated_at")
    list_filter = ("status", "currency")
    search_fields = ("application__form_code", "application__client__email", "stripe_checkout_session_id")
    readonly_fields = ("raw_event", "created_at", "updated_at")


@admin.register(CaseStatusEvent)
class CaseStatusEventAdmin(admin.ModelAdmin):
    list_display = ("application", "status", "visible_to_client", "created_by", "created_at")
    list_filter = ("status", "visible_to_client")
    search_fields = ("application__form_code", "application__client__email", "message")


@admin.register(StaffNote)
class StaffNoteAdmin(admin.ModelAdmin):
    list_display = ("application", "author", "is_private", "created_at")
    list_filter = ("is_private",)
    search_fields = ("application__form_code", "application__client__email", "body")
