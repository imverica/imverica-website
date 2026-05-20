import tempfile
import shutil
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase

from .models import Application, ClientProfile, DocumentUpload


class PortalSmokeTests(TestCase):
    def tearDown(self):
        # Django's default storage can resolve relative upload paths from the
        # test working directory; keep local test runs from leaving artifacts.
        shutil.rmtree(Path("client-documents"), ignore_errors=True)

    def test_health_endpoint(self):
        response = Client().get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "imverica-portal")

    def test_schema_endpoint(self):
        response = Client().get("/api/portal/schema/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("draft", response.json()["application_statuses"])

    def test_portal_intake_requires_core_fields(self):
        response = Client().post("/api/portal/intake/", {})

        self.assertEqual(response.status_code, 400)
        errors = response.json()["errors"]
        self.assertIn("first_name", errors)
        self.assertIn("last_name", errors)
        self.assertIn("phone", errors)
        self.assertIn("service", errors)

    def test_portal_intake_creates_user_profile_and_application(self):
        response = Client().post(
            "/api/portal/intake/",
            {
                "first_name": "Yana",
                "last_name": "Hovdan",
                "phone": "+1 (916) 399-3992",
                "email": "YANA@example.com",
                "service": "I-485",
                "description": "Adjustment of status document preparation.",
            },
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["ok"])
        self.assertEqual(body["status"], Application.STATUS_INTAKE_SUBMITTED)
        self.assertEqual(body["documents_received"], 0)

        User = get_user_model()
        user = User.objects.get(username="yana@example.com")
        self.assertEqual(user.first_name, "Yana")
        self.assertEqual(user.last_name, "Hovdan")
        self.assertEqual(user.email, "yana@example.com")
        self.assertEqual(user.client_profile.phone, "9163993992")

        application = Application.objects.get(id=body["application_id"])
        self.assertEqual(application.client, user)
        self.assertEqual(application.service_type, "I-485")
        self.assertEqual(application.source, Application.SOURCE_PORTAL)
        self.assertEqual(application.intake_data["contact"]["phone"], "9163993992")

    def test_portal_intake_accepts_uploaded_documents(self):
        with tempfile.TemporaryDirectory() as media_dir:
            with self.settings(
                STORAGES={
                    "default": {
                        "BACKEND": "django.core.files.storage.FileSystemStorage",
                        "OPTIONS": {"location": media_dir},
                    },
                    "staticfiles": {
                        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
                    },
                }
            ):
                upload = SimpleUploadedFile(
                    "passport.pdf",
                    b"%PDF-1.4 sample",
                    content_type="application/pdf",
                )
                response = Client().post(
                    "/api/portal/intake/",
                    {
                        "fname": "Test",
                        "lname": "Client",
                        "phone": "9163993992",
                        "service": "Document upload",
                        "documents": upload,
                    },
                )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["documents_received"], 1)

        application = Application.objects.get(id=response.json()["application_id"])
        document = DocumentUpload.objects.get(application=application)
        self.assertEqual(document.original_filename, "passport.pdf")
        self.assertEqual(document.content_type, "application/pdf")
        self.assertGreater(document.size_bytes, 0)
        self.assertTrue(ClientProfile.objects.filter(user=application.client).exists())
