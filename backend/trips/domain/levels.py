from enum import IntEnum


class RiskLevel(IntEnum):
    """
    Ordered risk levels, mildest first.

    The integer value doubles as the score used for average risk
    (docs/DECISIONS.md K3), and the ordering means max() returns the worst level.
    """

    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def key(self) -> str:
        """Stable identifier used in the API contract, e.g. "no_travel"."""
        return self.name.lower()
