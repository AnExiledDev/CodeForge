# Interpreting Profiler Output

How to read and analyze output from profiling tools, with annotated examples.

## Contents

- [Reading cProfile Output](#reading-cprofile-output)
- [Reading Flamegraphs](#reading-flamegraphs)
- [Reading memory_profiler Output](#reading-memory_profiler-output)
- [Reading line_profiler Output](#reading-line_profiler-output)
- [Reading `time` Output](#reading-time-output)
- [Benchmark Result Analysis](#benchmark-result-analysis)
- [Common Pitfalls](#common-pitfalls)

---

## Reading cProfile Output

### Annotated Example

```
         2847 function calls (2832 primitive calls) in 1.234 seconds

   Ordered by: cumulative time

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    0.000    0.000    1.234    1.234 app.py:1(<module>)
        1    0.002    0.002    1.230    1.230 app.py:45(process_data)
      100    0.850    0.009    1.100    0.011 app.py:60(parse_record)
      100    0.200    0.002    0.200    0.002 app.py:80(validate_fields)
      100    0.050    0.001    0.050    0.001 app.py:95(compute_hash)
     1000    0.030    0.000    0.030    0.000 {built-in method builtins.len}
      500    0.025    0.000    0.025    0.000 {method 'split' of 'str' objects}
```

**Column meanings:**
- `ncalls`: Number of calls. `100/50` means 100 total calls, 50 non-recursive.
- `tottime`: Time spent **in this function only** (excluding subfunctions). This is where the CPU actually spent its cycles.
- `percall` (first): `tottime / ncalls`. Average time per call in this function body.
- `cumtime`: Time spent in this function **and all functions it calls**. This is the total "cost" of calling this function.
- `percall` (second): `cumtime / ncalls`. Average total cost per call.

**How to read this example:**
1. `process_data` takes 1.23s cumulative but only 0.002s in its own body → it's a coordinator, not the bottleneck.
2. `parse_record` takes 0.85s in its own body (`tottime`) and 1.1s cumulative → it's the hot function. The 0.25s difference (1.1 - 0.85) is spent in its subfunctions.
3. `validate_fields` takes 0.2s → secondary target for optimization.
4. Built-in functions (`len`, `split`) are fast — don't optimize these.

**Action:** Focus on `parse_record`. It's called 100 times, spending 8.5ms per call in its own body. Can you cache results, reduce calls, or use a faster parsing library?

---

## Reading Flamegraphs

### Anatomy of a Flamegraph

A flamegraph is a visualization where:
- **X-axis** = stack frames sorted alphabetically (NOT time). Width = proportion of total samples.
- **Y-axis** = call stack depth. Bottom = entry point, top = leaf function.
- **Color** = typically random warm colors (no semantic meaning by default).

### What to Look For

**Wide bars at the top (plateaus):**
These are leaf functions where the CPU actually spends time. A wide bar at the top of the graph means this function is consuming a large portion of CPU time directly.

```
Example: A wide "json.loads" bar at the top means JSON parsing is the bottleneck.
Action: Reduce the number of parse calls, use a faster JSON library (orjson, ujson),
or change the data format.
```

**Wide bars at the bottom:**
These are entry points that lead to expensive call trees. The function itself may be cheap, but its children are expensive.

```
Example: A wide "handle_request" bar at the bottom that narrows into many children
means request handling is expensive collectively, but no single child dominates.
Action: Look for the widest children and optimize those first.
```

**Towers (deep narrow stacks):**
Deep but narrow stacks are recursive calls or deeply nested abstractions. They're not usually bottlenecks unless they're also wide.

**Missing frames:**
If the flamegraph shows `[unknown]` or gaps, the profiler couldn't resolve the frame. This happens with:
- JIT-compiled code (Node.js, Java) — use `--perf-basic-prof` for Node
- Native extensions — use `py-spy --native` for Python
- Optimized code with frame pointers stripped — compile with `-fno-omit-frame-pointer`

---

## Reading memory_profiler Output

### Annotated Example

```
Line #    Mem usage    Increment  Occurrences   Line Contents
============================================================
    10     50.2 MiB     50.2 MiB           1   @profile
    11                                         def process():
    12    550.2 MiB    500.0 MiB           1       data = load_csv("big.csv")
    13    750.2 MiB    200.0 MiB           1       expanded = expand_rows(data)
    14    780.5 MiB     30.3 MiB           1       result = aggregate(expanded)
    15    280.5 MiB   -500.0 MiB           1       del data
    16    180.5 MiB   -100.0 MiB           1       del expanded
    17    180.5 MiB      0.0 MiB           1       return result
```

**How to read:**
- `Mem usage`: Total memory of the process at this line.
- `Increment`: Change in memory from the previous line.
- Line 12: Loading the CSV adds 500 MiB. This is the peak driver.
- Line 13: Expanding rows adds another 200 MiB. Peak memory is 780 MiB.
- Lines 15-16: Deleting intermediate data reclaims 600 MiB.
- **Peak memory: 780.5 MiB** (at line 14).

**Action:** If 780 MiB is too much:
1. Process the CSV in chunks instead of loading all at once.
2. Stream `expand_rows` as a generator instead of materializing the full list.
3. If `data` is only needed for expansion, delete it before aggregation (already done here).

---

## Reading line_profiler Output

### Annotated Example

```
Timer unit: 1e-06 s

Total time: 2.5 s
File: parser.py
Function: parse_records at line 15

Line #      Hits         Time  Per Hit   % Time  Line Contents
==============================================================
    15                                           def parse_records(raw_data):
    16         1          5.0      5.0      0.0      results = []
    17      1000       2500.0      2.5      0.1      for line in raw_data:
    18      1000    1200000.0   1200.0     48.0          parsed = json.loads(line)
    19      1000     800000.0    800.0     32.0          validated = validate(parsed)
    20       950     450000.0    473.7     18.0          results.append(transform(validated))
    21        50      47500.0    950.0      1.9          log_invalid(parsed)
    22         1          2.0      2.0      0.0      return results
```

**How to read:**
- `Hits`: How many times the line executed.
- `Time`: Total time spent on this line (microseconds).
- `Per Hit`: Average time per execution.
- `% Time`: Percentage of total function time.

**Analysis:**
- Line 18 (`json.loads`): 48% of time. 1.2ms per call × 1000 calls = 1.2s.
- Line 19 (`validate`): 32% of time. 0.8ms per call.
- Line 20 (`transform`): 18% of time. 0.47ms per call, but only 950 hits (50 were invalid).

**Action:** `json.loads` is the primary target. Options:
1. Use `orjson.loads` (3-10x faster than `json.loads`).
2. If the JSON structure is known, use a streaming parser.
3. If data is coming from a controlled source, consider a faster format (msgpack).

---

## Reading `time` Output

```bash
$ /usr/bin/time -v python script.py

        Command being timed: "python script.py"
        User time (seconds): 3.45          ← CPU time in user space
        System time (seconds): 0.12        ← CPU time in kernel
        Elapsed (wall clock) time: 8.23    ← actual time elapsed
        Maximum resident set size (kbytes): 524288  ← peak memory (512 MB)
        Major (requiring I/O) page faults: 0
        Minor (reclaiming a frame) page faults: 131072
        Voluntary context switches: 1523   ← waiting for I/O
        Involuntary context switches: 45   ← preempted by scheduler
```

**Interpretation patterns:**

| Condition | Meaning | Action |
|-----------|---------|--------|
| wall >> user + sys | I/O bound | Profile I/O: network calls, disk reads, sleep/wait |
| user >> sys | CPU bound (computation) | Profile CPU: use cProfile or py-spy |
| sys >> user | Kernel bound (syscalls) | Profile syscalls: use strace |
| high voluntary ctx switches | Lots of I/O waiting | Batch I/O, use async, reduce round-trips |
| high involuntary ctx switches | CPU contention | Reduce thread count, check other processes |
| high max RSS | Memory hungry | Profile memory: use memory_profiler or scalene |

**This example:** Wall time (8.23s) >> user + sys (3.57s) → the script is I/O bound, spending 4.66s waiting for something. Investigate network calls, database queries, or file I/O.

---

## Benchmark Result Analysis

### hyperfine Output

```
Benchmark 1: python v1.py
  Time (mean ± σ):      1.234 s ±  0.056 s    [User: 1.180 s, System: 0.045 s]
  Range (min … max):    1.156 s …  1.345 s    10 runs

Benchmark 2: python v2.py
  Time (mean ± σ):      0.876 s ±  0.034 s    [User: 0.830 s, System: 0.040 s]
  Range (min … max):    0.823 s …  0.934 s    10 runs

Summary
  python v2.py ran
    1.41 ± 0.08 times faster than python v1.py
```

**How to evaluate:**
1. **Is the difference significant?** The 1.41x speedup is outside the standard deviation range, so yes.
2. **Is the variance acceptable?** σ = 0.056s for v1, 0.034s for v2. Both are <5% of the mean — good.
3. **Is the improvement meaningful?** 1.234s → 0.876s = 0.358s saved. For a batch job running once: marginal. For a request handler running 1000x/sec: substantial.

### Statistical Significance Rules of Thumb

- **Difference > 2σ**: Likely real (p < 0.05 roughly).
- **Difference < 1σ**: Probably noise. Don't ship it.
- **Coefficient of variation (σ/mean) > 10%**: Your benchmark is noisy. Increase runs, reduce background load, or pin CPU frequency.
- **Outliers in range**: If min and max are far apart, investigate. Was there a GC pause? A background process?

---

## Common Pitfalls

1. **Profiling optimized code with debug flags**: Debug builds disable optimizations. Profile release/production builds.
2. **Profiling on a loaded machine**: Other processes compete for CPU. Use isolated environments for benchmarks.
3. **Ignoring warmup**: JIT compilers (Node.js V8, PyPy) are slow on first run. Always warm up.
4. **Optimizing by percentage**: A 50% improvement on a 2ms function saves 1ms. A 5% improvement on a 10s function saves 500ms. Optimize by absolute time, not percentage.
5. **Micro-benchmarking in isolation**: A function that's fast alone may be slow under real load (cache eviction, memory pressure, GC pauses). Benchmark in realistic conditions.
