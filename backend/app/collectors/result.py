from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class CollectorResult:
    items: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def items_found(self) -> int:
        return len(self.items)

    @property
    def is_successful(self) -> bool:
        return not self.errors