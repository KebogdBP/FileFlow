import argparse
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from fileflow_api.config import get_settings
from fileflow_api.economics.models import BenchmarkBudget, WorkloadMetrics
from fileflow_api.economics.service import evaluate_benchmark, pricing_from_settings


def load_json(path: Path) -> dict[str, Any]:
    payload: object = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Check FileFlow benchmark results against budgets")
    parser.add_argument("report", type=Path)
    parser.add_argument("budgets", type=Path)
    args = parser.parse_args()
    report = load_json(args.report)
    budgets = load_json(args.budgets)
    failed = False
    for operation, raw_metrics in sorted(report.items()):
        if operation not in budgets or not isinstance(raw_metrics, dict):
            print(f"FAIL {operation}: missing budget or invalid metrics")
            failed = True
            continue
        raw_budget = budgets[operation]
        if not isinstance(raw_budget, dict):
            print(f"FAIL {operation}: invalid budget")
            failed = True
            continue
        metrics = WorkloadMetrics(
            runtime_ms=int(raw_metrics["runtime_ms"]),
            peak_memory_bytes=int(raw_metrics["peak_memory_bytes"]),
            input_bytes=int(raw_metrics["input_bytes"]),
            output_bytes=int(raw_metrics["output_bytes"]),
        )
        budget = BenchmarkBudget(
            max_runtime_ms=int(raw_budget["max_runtime_ms"]),
            max_peak_memory_bytes=int(raw_budget["max_peak_memory_bytes"]),
            max_output_ratio=Decimal(str(raw_budget["max_output_ratio"])),
            max_cost_usd=Decimal(str(raw_budget["max_cost_usd"])),
        )
        result = evaluate_benchmark(
            operation, metrics, budget, pricing_from_settings(get_settings())
        )
        label = "PASS" if result.passed else "FAIL"
        reasons = ",".join(result.violations) or "within budget"
        print(f"{label} {operation}: ${result.cost.total_usd} ({reasons})")
        failed = failed or not result.passed
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
