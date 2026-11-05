from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from trips.api.presenters import present_place, present_suggestion, present_trip_plan
from trips.api.serializers import PlaceSuggestQuerySerializer, TripPlanRequestSerializer
from trips.services.places import resolve_place, suggest_places
from trips.services.trip_planner import plan_trip

MIN_SUGGEST_QUERY_LENGTH = 2


class PlaceSuggestView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request: Request) -> Response:
        query = PlaceSuggestQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        text = query.validated_data["q"]
        if len(text) < MIN_SUGGEST_QUERY_LENGTH:
            return Response({"results": []})
        return Response({"results": [present_suggestion(s) for s in suggest_places(text)]})


class PlaceDetailView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "places"

    def get(self, request: Request, kind: str, place_id: str) -> Response:
        return Response(present_place(resolve_place(kind, place_id)))


class TripPlanView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "trip_plan"

    def post(self, request: Request) -> Response:
        payload = TripPlanRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return Response(present_trip_plan(plan_trip(payload.to_trip_request())))
