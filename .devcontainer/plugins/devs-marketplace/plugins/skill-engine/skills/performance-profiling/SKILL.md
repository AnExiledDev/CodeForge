---
name: performance-profiling
description: >-
  This skill should be used when the user asks to "profile this code",
  "find the bottleneck", "optimize performance", "measure execution time",
  "check memory usage", "create a flamegraph", "benchmark this function",
  "find memory leaks", "reduce latency", "run a performance test",
  or discusses profiling tools, flamegraphs, benchmarking methodology,
  cProfile, py-spy, scalene, Chrome DevTools performance,
  memory profiling, or hot path analysis.
version: 0.1.0
---

# Performance Profiling

## Mental Model

Performance work follows one rule: **measure first, optimize second**. Bottlenecks are almost never where you think they are. Developers consistently misjudge performance by 10-100x -- the "obviously slow" nested loop is often fast, while the "simple" database query is the real bottleneck.

The profiling workflow is:
1. **Establish a baseline** -- measure current performance with a reproducible benchmark
2. **Profile** -- identify where time and memory are actually spent
3. **Hypothesize** -- form a specific theory about the bottleneck
4. **Optimize** -- make one targeted change
5. **Measure again** -- verify the optimization actually helped
6. **Compare** -- did the change improve the baseline? By how much?

Without this discipline, you'll waste time optimizing code that doesn't matter, introduce complexity without measurable benefit, and have no proof that your changes helped.

**Amdahl's Law** sets the ceiling: if a function consumes 5% of total runtime, making it infinitely fast saves only 5%. Focus on the biggest bars in the profile first.

---

## Python Profiling

### cProfile (built-in, deterministic)

cProfile instruments every function call. It shows call count, cumulative time, and per-call time:

```bash
# Profile a script
python -m cProfile -s cumtime myapp.py

# Profile and save to a file for analysis
python -m cProfile -o profile.prof myapp.py

# Analyze the saved profile
python -c "
import pstats
p = pstats.Stats('profile.prof')
p.sort_stats('cumulative')
p.print_stats(20)  # top 20 functions
"
```

**Tradeoff:** cProfile adds ~30% overhead and measures wall-clock time. It's deterministic (traces every call) so it catches everything but distorts timing for very fast functions.

### py-spy (sampling, no overhead)

py-spy samples the call stack without modifying the target process. It can attach to running processes:

```bash
# Record a flamegraph (SVG)
py-spy record -o flamegraph.svg -- python myapp.py

# Attach to a running process
py-spy record -o flamegraph.svg --pid 12345

# Top-like live view
py-spy top --pid 12345

# Profile for a specific duration
py-spy record --duration 30 -o flamegraph.svg --pid 12345
```

**Tradeoff:** Sampling misses very short functions but has near-zero overhead. Ideal for production profiling.

### scalene (CPU + memory + GPU)

Scalene profiles CPU time, memory allocation, and memory usage simultaneously. It distinguishes Python time from native (C) time:

```bash
# Profile a script
scalene myapp.py

# Profile with specific options
scalene --cpu --memory --reduced-profile myapp.py

# Profile a specific function (in code)
# from scalene import scalene_profiler
# scalene_profiler.start()
# ... code to profile ...
# scalene_profiler.stop()
```

### memory_profiler (line-by-line memory)

```python
from memory_profiler import profile
import pandas as pd

@profile
def process_data() -> pd.DataFrame:
    data = pd.read_csv("large.csv")     # Line 5: +500 MiB
    filtered = data[data["active"]]      # Line 6: +200 MiB
    result = filtered.groupby("region").sum()  # Line 7: +50 MiB
    del data, filtered                   # Line 8: -700 MiB
    return result
```

```bash
python -m memory_profiler myapp.py
```

### line_profiler (line-by-line CPU)

```python
# Decorate functions to profile
@profile
def expensive_function():
    result = []                     # 0.0%
    for item in large_list:         # 2.1%
        parsed = parse(item)        # 45.3%  <-- hot line
        if validate(parsed):        # 12.7%
            result.append(parsed)   # 0.4%
    return result
```

```bash
kernprof -l -v myapp.py
```

> **Deep dive:** See `references/tool-commands.md` for the full command reference per language and tool.

---

## JavaScript / Node.js Profiling

### V8 Profiler (`--prof`)

Node's built-in V8 profiler generates a log that can be processed into a human-readable report:

```bash
# Generate a V8 profile log
node --prof app.js

# Process the log into readable output
node --prof-process isolate-*.log > processed.txt
```

### clinic.js

A suite of profiling tools for Node.js:

```bash
# Install
npm install -g clinic

# Doctor: overall health check (event loop, GC, I/O)
clinic doctor -- node app.js

# Flame: flamegraph
clinic flame -- node app.js

# Bubbleprof: async flow visualization
clinic bubbleprof -- node app.js
```

### Chrome DevTools

For both browser and Node.js profiling:

```bash
# Start Node with inspector
node --inspect app.js

# Or break on first line
node --inspect-brk app.js
```

Then open `chrome://inspect` in Chrome:
- **Performance tab:** Record a profile, see flamechart, call tree, and bottom-up views
- **Memory tab:** Take heap snapshots, record allocation timelines, detect leaks

### Lighthouse (Web Performance)

```bash
# CLI audit
npx lighthouse https://example.com --output json --output html

# Key metrics: FCP, LCP, TTI, TBT, CLS
# Target: Performance score > 90
```

---

## System Profiling

When the bottleneck isn't in your code but in the system:

```bash
# Wall-clock time, user CPU, system CPU
time python myapp.py

# Process-level resource usage (live)
htop                    # interactive process viewer
htop -p 12345           # monitor specific PID

# I/O statistics
iostat -x 1             # disk I/O per device, every 1 second

# CPU performance counters (Linux)
perf stat python myapp.py
# Counts: cycles, instructions, cache misses, branch misses

# System call tracing
strace -c python myapp.py       # summary of syscall time
strace -e trace=network app     # only network syscalls
```

**Interpreting `time` output:**
- **real** > **user** + **sys** → I/O bound (waiting for disk, network, or sleep)
- **user** >> **sys** → CPU bound in userspace (computation)
- **sys** >> **user** → CPU bound in kernel (many syscalls, context switches)

---

## Benchmarking Methodology

Benchmarks must be reproducible, statistically sound, and isolated from noise.

### CLI Benchmarking with hyperfine

```bash
# Basic benchmark with warmup
hyperfine --warmup 3 'python myapp.py'

# Compare two implementations
hyperfine --warmup 3 'python v1.py' 'python v2.py'

# With parameter sweeps
hyperfine --warmup 3 -P size 100,1000,10000 'python bench.py --size {size}'

# Export results
hyperfine --warmup 3 --export-json results.json 'python myapp.py'
```

hyperfine automatically detects outliers, calculates mean/median/stddev, and warns about statistical issues.

### Python Benchmarking with pytest-benchmark

```python
# benchmark fixture is injected by pytest-benchmark — no import needed
def test_sort_performance(benchmark) -> None:
    data = list(range(10000, 0, -1))
    result = benchmark(sorted, data)
    assert result == list(range(1, 10001))


def test_json_parse_performance(benchmark) -> None:
    """Benchmark with setup to exclude data preparation from timing."""
    import json
    payload = json.dumps({"users": [{"id": i, "name": f"user_{i}"} for i in range(1000)]})
    result = benchmark(json.loads, payload)
    assert len(result["users"]) == 1000
```

```bash
pytest --benchmark-only --benchmark-sort=mean
pytest --benchmark-compare          # compare against saved baseline
pytest --benchmark-save=baseline    # save current results
```

### Benchmarking Rules

1. **Warmup runs** -- JIT compilers, caches, and OS page faults all affect the first run. Always include warmup.
2. **Multiple iterations** -- A single measurement is noise. Run at least 10 iterations and report mean, median, and stddev.
3. **Isolate variables** -- Change one thing at a time. Benchmark before and after each optimization.
4. **Control the environment** -- Close other applications, disable turbo boost for CPU benchmarks, use consistent hardware.
5. **Statistical significance** -- If the difference is less than 2x the standard deviation, it's probably noise.

---

## Interpreting Results

### Reading Flamegraphs

Flamegraphs show the call stack over time. The x-axis is **not** time -- it's alphabetically sorted stack frames. Width represents the proportion of total samples.

- **Wide bars at the top** = functions that consume a lot of CPU directly
- **Wide bars at the bottom** = functions that call expensive children
- **Plateaus** (flat tops) = functions where time is spent in the function itself, not its children
- **Look for:** the widest bars at the top of the graph -- these are your hot paths

### Identifying Hot Paths

A hot path is the sequence of function calls that consumes the most cumulative time:

1. Sort by cumulative time (`cumtime` in cProfile)
2. Find the top-level function with the highest cumulative time
3. Follow its callees -- which child function consumes the most?
4. Repeat until you reach a leaf function

The hot path tells you where optimization effort will have the most impact.

### Memory Leak Patterns

Signs of a memory leak:
- Memory usage grows linearly with time/requests
- `gc.collect()` doesn't reclaim memory
- Heap snapshots show growing object counts for a specific type

Common causes:
- **Unbounded caches** -- dictionaries that grow forever. Fix: use `functools.lru_cache(maxsize=N)` or TTL-based caching.
- **Event listener accumulation** -- listeners added but never removed. Fix: use weak references or explicit cleanup.
- **Circular references with `__del__`** -- Python's GC can't collect cycles that have finalizers. Fix: use `weakref` to break the cycle.
- **Global state accumulation** -- appending to module-level lists. Fix: scope the collection to the request/session lifecycle.

> **Deep dive:** See `references/interpreting-results.md` for annotated examples of profiler output and how to read them.

---

## Ambiguity Policy

These defaults apply when the user does not specify a preference. State the assumption when making a choice:

- **Profiler choice:** Default to py-spy for Python (low overhead, flamegraph output), clinic.js for Node.js, and Chrome DevTools for browser. Use cProfile when the user needs exact call counts.
- **Benchmark iterations:** Default to at least 10 iterations with 3 warmup runs. Increase for sub-millisecond operations.
- **Metric focus:** Default to wall-clock time. Switch to CPU time when I/O is deliberately excluded. Switch to memory when the user mentions "memory", "leak", or "OOM".
- **Optimization scope:** Optimize only the identified hot path. Do not refactor surrounding code for "consistency" unless it's part of the hot path.
- **Baseline requirement:** Always establish a baseline measurement before optimizing. Refuse to optimize without one -- "it feels slow" is not a baseline.
- **Reporting:** Report absolute numbers (ms, MB) alongside relative improvements (%). A 50% improvement from 2ms to 1ms matters less than a 10% improvement from 10s to 9s.

---

## Reference Files

| File | Contents |
|------|----------|
| `references/tool-commands.md` | Full command reference for Python, JavaScript, and system profiling tools with all flags and options |
| `references/interpreting-results.md` | How to read profiler output: annotated cProfile tables, flamegraph walkthroughs, memory timeline interpretation, and benchmark result analysis |
