# Performance Profiling: Tool Command Reference

Full command reference for Python, JavaScript, and system profiling tools.

## Contents

- [Python Profiling Tools](#python-profiling-tools)
  - [cProfile](#cprofile)
  - [py-spy](#py-spy)
  - [scalene](#scalene)
  - [memory_profiler](#memory_profiler)
  - [line_profiler](#line_profiler)
  - [pytest-benchmark](#pytest-benchmark)
- [JavaScript / Node.js Profiling Tools](#javascript--nodejs-profiling-tools)
  - [V8 Built-in Profiler](#v8-built-in-profiler)
  - [clinic.js](#clinicjs)
  - [Chrome DevTools (Node.js)](#chrome-devtools-nodejs)
  - [Lighthouse](#lighthouse)
- [System Profiling Tools](#system-profiling-tools)
  - [time](#time)
  - [htop / top](#htop--top)
  - [iostat](#iostat)
  - [perf (Linux)](#perf-linux)
  - [strace (Linux)](#strace-linux)
- [Benchmarking Tools](#benchmarking-tools)
  - [hyperfine](#hyperfine)

---

## Python Profiling Tools

### cProfile

```bash
# Profile a script, sorted by cumulative time
python -m cProfile -s cumtime script.py

# Sort options: calls, cumulative, filename, line, module, name, nfl, pcalls,
#               stdname, time, tottime
python -m cProfile -s tottime script.py     # sort by time spent in function itself
python -m cProfile -s calls script.py       # sort by call count

# Save profile data for later analysis
python -m cProfile -o output.prof script.py

# Analyze saved profile
python -c "
import pstats
p = pstats.Stats('output.prof')
p.strip_dirs()
p.sort_stats('cumulative')
p.print_stats(30)             # top 30 functions
p.print_callers('function_name')  # who calls this function
p.print_callees('function_name')  # what does this function call
"

# Profile a specific function in code
import cProfile
profiler = cProfile.Profile()
profiler.enable()
result = my_function()
profiler.disable()
profiler.print_stats(sort='cumulative')
```

### py-spy

```bash
# Install
pip install py-spy

# Record a flamegraph (SVG output)
py-spy record -o flamegraph.svg -- python script.py

# Record with specific rate (samples/second, default 100)
py-spy record --rate 200 -o flamegraph.svg -- python script.py

# Record native (C extension) frames too
py-spy record --native -o flamegraph.svg -- python script.py

# Attach to a running process
py-spy record -o flamegraph.svg --pid 12345

# Record for a specific duration (seconds)
py-spy record --duration 30 -o flamegraph.svg --pid 12345

# Top-like live view
py-spy top -- python script.py
py-spy top --pid 12345

# Dump current stack traces (one-shot)
py-spy dump --pid 12345

# Output formats
py-spy record -f speedscope -o profile.json -- python script.py  # speedscope
py-spy record -f raw -o profile.txt -- python script.py          # raw text

# Profile subprocesses too
py-spy record --subprocesses -o flamegraph.svg -- python script.py

# Filter by thread
py-spy record --threads -o flamegraph.svg -- python script.py
```

### scalene

```bash
# Install
pip install scalene

# Basic profile
scalene script.py

# CPU only
scalene --cpu script.py

# Memory only
scalene --memory script.py

# Reduced profile (only functions with significant time)
scalene --reduced-profile script.py

# Profile specific files only
scalene --profile-only mymodule.py script.py

# Output formats
scalene --json --outfile profile.json script.py
scalene --html --outfile profile.html script.py

# Programmatic usage
from scalene import scalene_profiler
scalene_profiler.start()
# ... code to profile ...
scalene_profiler.stop()
```

### memory_profiler

```bash
# Install
pip install memory_profiler

# Profile a script (requires @profile decorators in code)
python -m memory_profiler script.py

# Time-based memory usage plot (outputs to mprofile_*.dat)
mprof run script.py
mprof plot                    # opens matplotlib plot
mprof plot -o memory.png      # save to file

# Track memory over time for a running process
mprof run --include-children script.py
```

### line_profiler

```bash
# Install
pip install line_profiler

# Profile (requires @profile decorators in code)
kernprof -l script.py         # generates script.py.lprof
python -m line_profiler script.py.lprof  # view results

# Or combined
kernprof -l -v script.py      # run and view immediately
```

### pytest-benchmark

```bash
# Install
pip install pytest-benchmark

# Run benchmarks only
pytest --benchmark-only

# Sort by mean time
pytest --benchmark-sort=mean

# Other sort options: min, max, stddev, name, fullname, rounds
pytest --benchmark-sort=stddev

# Save baseline
pytest --benchmark-save=baseline

# Compare against saved baseline
pytest --benchmark-compare=0001_baseline

# Minimum rounds and warmup
pytest --benchmark-min-rounds=20 --benchmark-warmup=on

# Disable GC during benchmarks (more stable results)
pytest --benchmark-disable-gc

# Output formats
pytest --benchmark-json=results.json
pytest --benchmark-histogram=output    # generates output.svg
```

---

## JavaScript / Node.js Profiling Tools

### V8 Built-in Profiler

```bash
# Generate V8 profile log
node --prof app.js

# Process the log
node --prof-process isolate-*.log > profile.txt

# CPU profiling with V8 inspector
node --cpu-prof app.js
# Generates CPU.*.cpuprofile — open in Chrome DevTools

# Heap snapshot
node --heap-prof app.js
# Generates Heap.*.heapprofile
```

### clinic.js

```bash
# Install
npm install -g clinic

# Doctor: overall health (event loop delays, GC, active handles)
clinic doctor -- node app.js

# Flame: CPU flamegraph
clinic flame -- node app.js

# Bubbleprof: async flow visualization
clinic bubbleprof -- node app.js

# HeapProfiler: memory allocation tracking
clinic heapprofiler -- node app.js

# Combine with autocannon for load testing
clinic doctor --autocannon [ /api/endpoint ] -- node app.js
clinic flame --autocannon [ -m POST /api/data ] -- node app.js
```

### Chrome DevTools (Node.js)

```bash
# Start with inspector (attach when ready)
node --inspect app.js

# Start with inspector and break on first line
node --inspect-brk app.js

# Custom port
node --inspect=0.0.0.0:9229 app.js

# Then open chrome://inspect in Chrome and click "inspect"
```

### Lighthouse

```bash
# Install
npm install -g lighthouse

# Basic audit
lighthouse https://example.com

# Output formats
lighthouse https://example.com --output json --output-path report.json
lighthouse https://example.com --output html --output-path report.html

# Specific categories
lighthouse https://example.com --only-categories=performance

# Mobile vs Desktop
lighthouse https://example.com --preset=desktop
lighthouse https://example.com --preset=perf   # mobile (default)

# Headless Chrome flags
lighthouse https://example.com --chrome-flags="--headless --no-sandbox"
```

---

## System Profiling Tools

### time

```bash
# Basic timing
time python script.py

# GNU time with more details (note: use \time or /usr/bin/time, not the shell builtin)
/usr/bin/time -v python script.py
# Outputs: wall clock, user CPU, system CPU, max RSS, page faults, context switches
```

### htop / top

```bash
# Interactive process monitor
htop

# Monitor specific PID
htop -p 12345

# Sort by memory
htop --sort-key=PERCENT_MEM

# Non-interactive (for scripting)
top -b -n 1 -p 12345
```

### iostat

```bash
# Disk I/O statistics, refresh every 1 second
iostat -x 1

# Specific device
iostat -x -d sda 1

# Key columns: r/s (reads/sec), w/s (writes/sec), %util (device utilization)
```

### perf (Linux)

```bash
# Count hardware events
perf stat python script.py
# Reports: cycles, instructions, cache misses, branch misses

# Specific events
perf stat -e cache-misses,cache-references python script.py

# Record for flamegraph
perf record -g python script.py
perf script > perf.data.txt

# Generate flamegraph from perf data
# (requires FlameGraph tools: https://github.com/brendangregg/FlameGraph)
perf script | stackcollapse-perf.pl | flamegraph.pl > flamegraph.svg
```

### strace (Linux)

```bash
# Summary of syscall time
strace -c python script.py

# Trace specific syscall categories
strace -e trace=network python script.py    # network calls
strace -e trace=file python script.py       # file operations
strace -e trace=memory python script.py     # memory operations

# Trace with timestamps
strace -t python script.py                  # HH:MM:SS
strace -T python script.py                  # time spent in each syscall
```

---

## Benchmarking Tools

### hyperfine

```bash
# Install: cargo install hyperfine, or brew install hyperfine

# Basic benchmark
hyperfine 'python script.py'

# With warmup runs
hyperfine --warmup 3 'python script.py'

# Compare two commands
hyperfine --warmup 3 'python v1.py' 'python v2.py'

# Parameter sweep
hyperfine --warmup 3 -P threads 1 8 'python script.py --threads {threads}'

# Parameter list
hyperfine --warmup 3 -L algo bubble,merge,quick 'python sort.py --algo {algo}'

# Minimum runs
hyperfine --min-runs 20 'python script.py'

# Setup and cleanup commands
hyperfine --setup 'python generate_data.py' --cleanup 'rm data.tmp' 'python script.py'

# Export results
hyperfine --warmup 3 --export-json results.json --export-markdown results.md 'python script.py'
```
