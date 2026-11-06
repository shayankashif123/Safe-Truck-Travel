from django.test import RequestFactory, override_settings

from trips.api.throttling import ClientRateThrottle


def ident(**meta):
    request = RequestFactory().get("/api/places/suggest/", REMOTE_ADDR="10.0.0.1", **meta)
    return ClientRateThrottle().get_ident(request)


@override_settings(CLIENT_IP_HEADER="CF-Connecting-IP")
def test_uses_the_trusted_header_and_ignores_forged_forwarded_for():
    real = {"HTTP_CF_CONNECTING_IP": "203.0.113.7"}

    assert ident(**real) == "203.0.113.7"
    # A caller rotating X-Forwarded-For is still the same client.
    assert ident(HTTP_X_FORWARDED_FOR="1.1.1.1, 10.0.0.9", **real) == "203.0.113.7"
    assert ident(HTTP_X_FORWARDED_FOR="2.2.2.2, 10.0.0.8", **real) == "203.0.113.7"


@override_settings(CLIENT_IP_HEADER="CF-Connecting-IP")
def test_falls_back_to_the_default_when_the_header_is_missing():
    assert ident() == "10.0.0.1"


@override_settings(CLIENT_IP_HEADER="")
def test_default_identification_when_no_header_is_configured():
    assert ident(HTTP_CF_CONNECTING_IP="203.0.113.7") == "10.0.0.1"
