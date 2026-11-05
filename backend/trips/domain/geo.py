from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class LatLng:
    lat: float
    lng: float

    def __post_init__(self) -> None:
        if not -90 <= self.lat <= 90:
            raise ValueError(f"latitude out of range: {self.lat}")
        if not -180 <= self.lng <= 180:
            raise ValueError(f"longitude out of range: {self.lng}")

    def __reduce__(self):
        # Routes hold ~10,000 points and are cached (pickled). Pickling as a
        # plain (lat, lng) pair is several times faster than the generic
        # dataclass path.
        return (LatLng, (self.lat, self.lng))
