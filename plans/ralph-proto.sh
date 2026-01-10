#!/bin/bash
# Ralph - Prototype/Spike Mode
# For quick experiments, demos, MVPs
# Usage: ralph-proto <iterations>  (run from project root)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Stay in current directory (where user runs from), don't cd

if [ -z "$1" ]; then
    echo "Usage: $0 <iterations>"
    echo "Prototype mode: Speed over perfection, skip edge cases"
    exit 1
fi

# Rotate progress.txt if too large (>500 lines)
if [ -f "plans/progress.txt" ] && [ $(wc -l < plans/progress.txt) -gt 500 ]; then
    mv plans/progress.txt "plans/progress-$(date +%Y%m%d-%H%M%S).txt"
    echo "# New sprint started $(date)" > plans/progress.txt
    echo "Previous progress archived." >> plans/progress.txt
fi

PROMPT="@plans/prd.json @plans/progress.txt

QUALITY MODE: PROTOTYPE
This is a prototype. Speed over perfection.
Skip edge cases, focus on happy path. Minimal tests - just verify it works.
Document shortcuts with TODO comments for later cleanup.

1. Find the highest-priority feature to work on (lowest priority number with passes: false).
   Move fast - pick what unblocks the most progress.

2. Implement the feature following the steps listed.
   Keep it simple:
   - Happy path only
   - Skip error handling unless critical
   - No tests unless explicitly required
   - TODO comments for shortcuts taken

3. Check that TypeScript compiles via npx tsc --noEmit and build passes via npm run build.
   If minor type errors, use // @ts-ignore and move on.

4. Quick smoke test: Does it basically work? If yes, continue.

5. Update the PRD with the work that was done (set passes: true when complete).

6. Append brief progress to progress.txt.
   Note any shortcuts taken for future cleanup.

7. Make a git commit.

8. FINAL LOOP CHECK (if this is the last feature OR PRD is complete):
   In progress.txt, write '## RALPH RECOMMENDATIONS':
   - What shortcuts were taken that need cleanup?
   - Ready to show users? Or more work needed?
   - Any blockers or issues that need human attention?

ONLY WORK ON A SINGLE FEATURE.
If PRD is complete, output <promise>COMPLETE</promise>."

completed=0
for ((i=1; i<=$1; i++)); do
    echo "============================================"
    echo "Iteration $i of $1 (PROTOTYPE MODE)"
    echo "Working directory: $(pwd)"
    echo "============================================"
    result=$(claude --permission-mode bypassPermissions -p "$PROMPT")

    echo "$result"
    ((completed++))

    if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
        echo "PRD complete, exiting."
        recs=$(grep -A 15 "RALPH RECOMMENDATIONS" plans/progress.txt 2>/dev/null | head -10 || echo "Check progress.txt")
        "$SCRIPT_DIR/notify.sh" "🚀 Ralph (proto) COMPLETE!

✅ $completed features done

📋 $recs"
        exit 0
    fi
done

echo "============================================"
echo "Completed $1 iterations"
echo "============================================"

remaining=$(grep -c '"passes": false' plans/prd.json 2>/dev/null || echo "?")
"$SCRIPT_DIR/notify.sh" "Ralph (proto) finished $completed iterations.
📊 Remaining: $remaining features"
