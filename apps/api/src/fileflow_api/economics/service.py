from decimal import ROUND_UP, Decimal

from fileflow_api.config import Settings
from fileflow_api.economics.models import (
    BenchmarkBudget,
    BenchmarkResult,
    CostEstimate,
    Pricing,
    WorkloadMetrics,
)

GIB = Decimal(1024**3)
HOURS_PER_MONTH = Decimal(730)
MICRO_USD = Decimal("0.000001")


def pricing_from_settings(settings: Settings) -> Pricing:
    return Pricing(
        compute_second_usd=settings.cost_compute_per_second_usd,
        memory_gib_second_usd=settings.cost_memory_gib_second_usd,
        storage_gib_month_usd=settings.cost_storage_gib_month_usd,
        egress_gib_usd=settings.cost_egress_gib_usd,
        request_usd=settings.cost_request_usd,
        retention_hours=settings.cost_retention_hours,
    )


def estimate_cost(metrics: WorkloadMetrics, pricing: Pricing) -> CostEstimate:
    seconds = Decimal(metrics.runtime_ms) / 1000
    memory_gib = Decimal(metrics.peak_memory_bytes) / GIB
    stored_gib = Decimal(metrics.input_bytes + metrics.output_bytes) / GIB
    output_gib = Decimal(metrics.output_bytes) / GIB
    compute = seconds * pricing.compute_second_usd
    memory = seconds * memory_gib * pricing.memory_gib_second_usd
    storage = stored_gib * pricing.storage_gib_month_usd * pricing.retention_hours / HOURS_PER_MONTH
    egress = output_gib * pricing.egress_gib_usd

    def money(value: Decimal) -> Decimal:
        return value.quantize(MICRO_USD, rounding=ROUND_UP)

    rounded = tuple(
        money(value) for value in (compute, memory, storage, egress, pricing.request_usd)
    )
    return CostEstimate(
        compute_usd=rounded[0],
        memory_usd=rounded[1],
        storage_usd=rounded[2],
        egress_usd=rounded[3],
        request_usd=rounded[4],
        total_usd=sum(rounded, start=Decimal(0)),
    )


def evaluate_benchmark(
    operation: str, metrics: WorkloadMetrics, budget: BenchmarkBudget, pricing: Pricing
) -> BenchmarkResult:
    cost = estimate_cost(metrics, pricing)
    violations: list[str] = []
    if metrics.runtime_ms > budget.max_runtime_ms:
        violations.append("runtime")
    if metrics.peak_memory_bytes > budget.max_peak_memory_bytes:
        violations.append("memory")
    ratio = (
        Decimal(metrics.output_bytes) / Decimal(metrics.input_bytes)
        if metrics.input_bytes > 0
        else Decimal("Infinity")
    )
    if ratio > budget.max_output_ratio:
        violations.append("output_ratio")
    if cost.total_usd > budget.max_cost_usd:
        violations.append("cost")
    return BenchmarkResult(operation, metrics, cost, tuple(violations))
