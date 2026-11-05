from django.urls import path

from trips.api.views import PlaceDetailView, PlaceSuggestView, TripPlanView

urlpatterns = [
    path("places/suggest/", PlaceSuggestView.as_view(), name="place-suggest"),
    path("places/<str:kind>/<str:place_id>/", PlaceDetailView.as_view(), name="place-detail"),
    path("trips/plan/", TripPlanView.as_view(), name="trip-plan"),
]
