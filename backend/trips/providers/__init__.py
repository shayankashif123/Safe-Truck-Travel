"""
Thin HTTP clients for third-party APIs.

Each client turns provider JSON into domain objects and provider failures into
the errors in errors.py. Clients do no caching and hold no business rules;
that lives in trips.services and trips.domain.
"""
