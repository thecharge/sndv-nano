"""
Example: The Double Loop in action.

Scenario: Build a rate limiter for an API.

Cycle 1:
  FALSIFY  → Can we even do token bucket at our scale?
  DELIVER  → Build the rate limiter
  VERIFY   → Does it actually hold under load?

If verification fails, the loop cycles again with the surviving paths.
"""

import asyncio
import random
import logging
from smep_loop import DoubleLoop, Phase

logging.basicConfig(level=logging.INFO, format="%(message)s")


async def main():
    loop = DoubleLoop(
        goal="Ship a rate limiter that handles 100k req/s",
        constraints=[
            "Must be in-process (no Redis dependency)",
            "Max 50MB memory overhead",
            "p99 latency overhead under 1ms",
        ],
        max_cycles=3,
    )

    # ===== FALSIFICATION TASKS (attack the plan) =====

    @loop.falsify(risk=0.9)
    async def can_token_bucket_handle_100k(ctx):
        """Try to prove token bucket can't keep up at 100k req/s."""
        # Simulate benchmarking
        throughput = random.randint(80_000, 130_000)
        ctx.evidence("measured_throughput", throughput)
        if throughput < 100_000:
            ctx.falsify(f"Token bucket only handles {throughput} req/s")

    @loop.falsify(risk=0.7)
    async def memory_under_budget(ctx):
        """Try to prove memory usage will exceed 50MB."""
        buckets = 500_000  # one per unique client
        bytes_per_bucket = random.randint(80, 120)
        total_mb = (buckets * bytes_per_bucket) / (1024 * 1024)
        ctx.evidence("total_memory_mb", round(total_mb, 1))
        if total_mb > 50:
            ctx.falsify(f"Memory usage {total_mb:.1f}MB exceeds 50MB budget")

    # ===== DELIVERY TASKS (build it) =====

    @loop.deliver(depends_on=["can_token_bucket_handle_100k", "memory_under_budget"])
    async def implement_rate_limiter(ctx):
        """Actually build the rate limiter. Only runs if falsification passed."""
        # Simulate implementation work
        await asyncio.sleep(0.1)
        ctx.evidence("implementation", "token_bucket_v1")
        ctx.evidence("lines_of_code", 342)
        ctx.shared["limiter_built"] = True
        return "rate_limiter.py"

    # ===== VERIFICATION TASKS (attack what was built) =====

    @loop.verify(risk=0.8, depends_on=["implement_rate_limiter"])
    async def load_test_the_build(ctx):
        """Now that it's built, try to break it under real load."""
        if not ctx.shared.get("limiter_built"):
            ctx.falsify("Rate limiter was never built")

        # Simulate load test
        p99_overhead_ms = random.uniform(0.3, 1.5)
        ctx.evidence("p99_overhead_ms", round(p99_overhead_ms, 3))
        if p99_overhead_ms > 1.0:
            ctx.falsify(f"p99 overhead {p99_overhead_ms:.2f}ms exceeds 1ms budget")

    @loop.verify(risk=0.6, depends_on=["implement_rate_limiter"])
    async def verify_correctness(ctx):
        """Verify the limiter actually limits (not just a passthrough)."""
        # Simulate correctness testing
        allowed_over_limit = random.randint(0, 50)
        ctx.evidence("requests_leaked_over_limit", allowed_over_limit)
        if allowed_over_limit > 10:
            ctx.falsify(f"{allowed_over_limit} requests leaked past the limit")

    # ===== RUN THE SPIRAL =====

    print("=" * 60)
    print("THE DOUBLE LOOP")
    print("=" * 60)
    print()

    cycles = await loop.run()

    print()
    print(loop.summary())
    print()

    # Show what happened each cycle
    for c in cycles:
        print(f"\n--- Cycle {c.cycle_number} ({c.duration_s:.2f}s) ---")
        if c.tasks_verified:
            print(f"  Verified:  {', '.join(c.tasks_verified)}")
        if c.tasks_delivered:
            print(f"  Delivered: {', '.join(c.tasks_delivered)}")
        if c.tasks_falsified:
            print(f"  Falsified: {', '.join(c.tasks_falsified)}")
        print(f"  Converged: {c.converged}")


if __name__ == "__main__":
    asyncio.run(main())