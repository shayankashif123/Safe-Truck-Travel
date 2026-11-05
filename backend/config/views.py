from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(_request: HttpRequest) -> JsonResponse:
    """Liveness probe used by the frontend and the hosting platform."""
    return JsonResponse({"status": "ok"})
