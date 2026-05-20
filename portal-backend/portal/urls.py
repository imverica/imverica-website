from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("api/portal/schema/", views.portal_schema, name="portal-schema"),
]
