from rest_framework import serializers

from trips.domain.checkpoints import SUPPORTED_SPACINGS_MI
from trips.domain.geo import LatLng
from trips.domain.hours_of_service import DriverMode
from trips.services.trip_planner import TripRequest

MAX_LOAD_LB = 100_000


class PointSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lng = serializers.FloatField(min_value=-180, max_value=180)


class TripPlanRequestSerializer(serializers.Serializer):
    origin = PointSerializer()
    destination = PointSerializer()
    departure = serializers.DateTimeField()  # ISO 8601; the frontend sends UTC
    load_lb = serializers.IntegerField(min_value=0, max_value=MAX_LOAD_LB)
    spacing_mi = serializers.ChoiceField(choices=SUPPORTED_SPACINGS_MI)
    # Solo is the safe default: it never makes an ETA earlier than reality.
    driver = serializers.ChoiceField(choices=[m.value for m in DriverMode], default=DriverMode.SOLO)

    def to_trip_request(self) -> TripRequest:
        data = self.validated_data
        return TripRequest(
            origin=LatLng(**data["origin"]),
            destination=LatLng(**data["destination"]),
            departure=data["departure"],
            load_lb=data["load_lb"],
            spacing_mi=data["spacing_mi"],
            driver=DriverMode(data["driver"]),
        )


class PlaceSuggestQuerySerializer(serializers.Serializer):
    q = serializers.CharField(max_length=100, trim_whitespace=True, allow_blank=True)
