from django.test import Client, TestCase


class PortalSmokeTests(TestCase):
    def test_health_endpoint(self):
        response = Client().get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["service"], "imverica-portal")

    def test_schema_endpoint(self):
        response = Client().get("/api/portal/schema/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("draft", response.json()["application_statuses"])
