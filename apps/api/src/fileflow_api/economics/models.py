from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Pricing:
    compute_second_usd: Decimal
    memory_gib_second_usd: Decimal
    storage_gib_month_usd: Decimal
    egress_gib_usd: Decimal
    request_usd: Decimal
    retention_hours: Decimal


@dataclass(frozen=True)
class WorkloadMetrics:
    runtime_ms: int
    peak_memory_bytes: int
    input_bytes: int
    output_bytes: int


@dataclass(frozen=True)
class CostEstimate:
    compute_usd: Decimal
    memory_usd: Decimal
    storage_usd: Decimal
    egress_usd: Decimal
    request_usd: Decimal
    total_usd: Decimal


@dataclass(frozen=True)
class BenchmarkBudget:
    max_runtime_ms: int
    max_peak_memory_bytes: int
    max_output_ratio: Decimal
    max_cost_usd: Decimal


@dataclass(frozen=True)
class BenchmarkResult:
    operation: str
    metrics: WorkloadMetrics
    cost: CostEstimate
    violations: tuple[str, ...]

    @property
    def passed(self) -> bool:
        return not self.violations
