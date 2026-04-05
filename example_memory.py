"""
Full system example: SMEP + Double Loop + Memory

This shows the complete flow:
  1. Check memory for what we already know
  2. Inject context into the protocol
  3. Run the double loop
  4. Persist results back to memory
  5. Extract patterns for future runs

Run this twice to see memory in action - the second run
will know what the first run already tried.
"""

import asyncio
import random
from smep import quick_protocol, TaskContext, TaskStatus
from smep_loop import DoubleLoop
from smep_memory import MemoryStore, Pattern


HYPOTHESIS_ID = "rate-limiter-v1"


async def run_protocol():
    # === 1. Initialize memory ===
    mem = MemoryStore(".smep")

    # === 2. Check what we already know ===
    ctx = mem.load_context(HYPOTHESIS_ID)
    print(ctx.prompt_fragment())
    print()

    # Check if a specific approach was already falsified
    already_failed = {
        d.task for d in ctx.past_decisions if d.action == "falsified"
    }
    if already_failed:
        print(f"⚠ Skipping previously falsified: {already_failed}")
        print()

    # === 3. Build the protocol (skip known-bad paths) ===
    proto = quick_protocol(
        goal="Ship a rate limiter that handles 100k req/s",
        constraints=[
            "Must be in-process (no Redis)",
            "Max 50MB memory",
            "p99 overhead under 1ms",
        ],
        max_iterations=10,
    )

    if "test_token_bucket_throughput" not in already_failed:
        @proto.task(risk=0.9, timeout_s=5.0)
        async def test_token_bucket_throughput(ctx: TaskContext):
            """Attack: can token bucket keep up at 100k req/s?"""
            throughput = random.randint(85_000, 130_000)
            ctx.evidence("throughput_rps", throughput)
            if throughput < 100_000:
                ctx.falsify(f"Token bucket only handles {throughput} req/s")

    if "test_memory_usage" not in already_failed:
        @proto.task(risk=0.7, timeout_s=5.0)
        async def test_memory_usage(ctx: TaskContext):
            """Attack: will memory exceed 50MB with 500k buckets?"""
            buckets = 500_000
            bytes_per = random.randint(70, 130)
            total_mb = (buckets * bytes_per) / (1024 * 1024)
            ctx.evidence("total_memory_mb", round(total_mb, 1))
            if total_mb > 50:
                ctx.falsify(f"Memory {total_mb:.1f}MB > 50MB budget")

    @proto.task(risk=0.3, timeout_s=5.0)
    async def test_latency_overhead(ctx: TaskContext):
        """Attack: does the limiter add more than 1ms of latency?"""
        p99_ms = random.uniform(0.2, 1.5)
        ctx.evidence("p99_overhead_ms", round(p99_ms, 3))
        if p99_ms > 1.0:
            ctx.falsify(f"p99 overhead {p99_ms:.2f}ms > 1ms budget")

    # === 4. Run the protocol ===
    print("=" * 60)
    print("RUNNING PROTOCOL")
    print("=" * 60)
    report = await proto.execute()
    print()
    print(report.summary())

    # === 5. Persist results to memory ===
    session_dir = mem.record_session(HYPOTHESIS_ID, report)
    print(f"\nResults saved to: {session_dir}")

    # === 6. Record any learned constraints ===
    for tr in report.task_results:
        if tr.status == TaskStatus.FALSIFIED:
            if "memory" in tr.task_name.lower():
                mem.record_constraint(
                    f"In-process rate limiters with 500k buckets may exceed 50MB",
                    source_hypothesis=HYPOTHESIS_ID,
                )
            if "throughput" in tr.task_name.lower():
                mem.record_constraint(
                    f"Token bucket implementation may not sustain 100k req/s",
                    source_hypothesis=HYPOTHESIS_ID,
                )

    # === 7. Try to extract patterns ===
    patterns = mem.extract_patterns(min_occurrences=1, min_confidence=0.3)
    if patterns:
        print(f"\nExtracted {len(patterns)} pattern(s):")
        for p in patterns:
            print(f"  • {p.pattern} (confidence: {p.confidence:.0%})")
            mem.record_pattern(p)

    # === 8. Search memory ===
    print("\n--- Memory search: 'latency' ---")
    results = mem.search("latency")
    for r in results[:5]:
        print(f"  [{r['file']}:{r['line']}] {r['content']}")

    return report


async def main():
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  RUN 1 - First attempt (no prior knowledge)            ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()
    await run_protocol()

    print()
    print()
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  RUN 2 - Second attempt (WITH memory from Run 1)       ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()
    await run_protocol()

    # Show what's in memory now
    mem = MemoryStore(".smep")
    print()
    print("=" * 60)
    print("FINAL MEMORY STATE")
    print("=" * 60)
    print()

    hypotheses = mem.list_hypotheses()
    for h in hypotheses:
        print(f"  {h['id']}: {h['runs']} runs, last={h['last_status']}")

    print()
    print("--- Full LLM context for next run ---")
    print(mem.export_for_llm(HYPOTHESIS_ID))


if __name__ == "__main__":
    # Clean up from previous runs
    import shutil
    shutil.rmtree(".smep", ignore_errors=True)

    asyncio.run(main())