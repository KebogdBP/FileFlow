from decimal import Decimal

from fileflow_api.economics.models import BenchmarkBudget, Pricing, WorkloadMetrics
from fileflow_api.economics.service import estimate_cost, evaluate_benchmark

PRICING = Pricing(
    compute_second_usd=Decimal("0.00002"),
    memory_gib_second_usd=Decimal("0.000002"),
    storage_gib_month_usd=Decimal("0.023"),
    egress_gib_usd=Decimal("0.09"),
    request_usd=Decimal("0.00001"),
    retention_hours=Decimal("1"),
)


def test_cost_model_includes_compute_memory_storage_egress_and_request() -> None:
    estimate = estimate_cost(
        WorkloadMetrics(
            runtime_ms=10_000,
            peak_memory_bytes=512 * 1024 * 1024,
            input_bytes=100 * 1024 * 1024,
            output_bytes=50 * 1024 * 1024,
        ),
        PRICING,
    )
    assert estimate.compute_usd == Decimal("0.000200")
    assert estimate.memory_usd == Decimal("0.000010")
    assert estimate.storage_usd > 0
    assert estimate.egress_usd > estimate.compute_usd
    assert estimate.total_usd == sum(
        (
            estimate.compute_usd,
            estimate.memory_usd,
            estimate.storage_usd,
            estimate.egress_usd,
            estimate.request_usd,
        )
    )


def test_benchmark_gate_reports_each_exceeded_budget() -> None:
    result = evaluate_benchmark(
        "video.compress",
        WorkloadMetrics(
            runtime_ms=61_000,
            peak_memory_bytes=2 * 1024**3,
            input_bytes=10 * 1024**2,
            output_bytes=20 * 1024**2,
        ),
        BenchmarkBudget(
            max_runtime_ms=60_000,
            max_peak_memory_bytes=1024**3,
            max_output_ratio=Decimal("1.5"),
            max_cost_usd=Decimal("0.000001"),
        ),
        PRICING,
    )
    assert not result.passed
    assert result.violations == ("runtime", "memory", "output_ratio", "cost")


def test_benchmark_gate_accepts_result_within_budget() -> None:
    result = evaluate_benchmark(
        "image.compress",
        WorkloadMetrics(500, 64 * 1024**2, 10 * 1024**2, 5 * 1024**2),
        BenchmarkBudget(1_000, 128 * 1024**2, Decimal("1"), Decimal("0.01")),
        PRICING,
    )
    assert result.passed
    assert result.violations == ()
