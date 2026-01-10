#!/bin/bash
# Ralph - Production Quality Mode
# For code that will be maintained long-term
# Usage: ralph-prod <iterations>  (run from project root)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Stay in current directory (where user runs from), don't cd

if [ -z "$1" ]; then
    echo "Usage: $0 <iterations>"
    echo "Production mode: Prioritizes quality, tests, edge cases"
    exit 1
fi

# Rotate progress.txt if too large (>500 lines)
if [ -f "plans/progress.txt" ] && [ $(wc -l < plans/progress.txt) -gt 500 ]; then
    mv plans/progress.txt "plans/progress-$(date +%Y%m%d-%H%M%S).txt"
    echo "# New sprint started $(date)" > plans/progress.txt
    echo "Previous progress archived." >> plans/progress.txt
fi

PROMPT="@plans/prd.json @plans/progress.txt

QUALITY MODE: PRODUCTION
This codebase will outlive you. Every shortcut becomes someone else's burden.
Every hack compounds into technical debt. Fight entropy.
Leave the codebase better than you found it.

1. Find the highest-priority feature (lowest priority number with passes: false).
   PRIORITIZE BY RISK, NOT EASE:
   - Priority 0: Architectural work, integration points (decisions cascade)
   - Priority 1: Unknown unknowns, spikes (fail fast)
   - Priority 2: Standard features
   - Priority 3: UI polish, quick wins (easy to slot in anytime)

2. Implement the feature following the steps listed.
   KEEP CHANGES SMALL:
   - One logical change per commit
   - If task feels too large, break into subtasks first
   - Prefer multiple small commits over one large commit

3. RUN ALL FEEDBACK LOOPS before committing:
   - TypeScript: npx tsc --noEmit (must pass, no errors)
   - Build: npm run build (must pass)
   - Lint: npm run lint (if available, must pass)
   - Tests: npm test (if available, must pass)
   Do NOT commit if ANY feedback loop fails. Fix issues first.

4. Quick verification: Start dev server, check for console errors.
   If critical errors, fix them. Max 2 minutes on verification.

5. Update the PRD (set passes: true when complete).

6. Append to progress.txt (concise, sacrifice grammar):
   - Task completed and PRD item reference
   - Key decisions made and reasoning
   - Files changed
   - Any blockers or notes for next iteration
   This helps future iterations skip exploration.

7. Make a git commit with clear message.

8. PM CHECK in progress.txt:
   - New bugs discovered?
   - Improvements to add?
   - Ready for user testing?

9. FINAL LOOP CHECK (if this is the last feature OR PRD is complete):
   Be proactive! In progress.txt, write a section '## RALPH RECOMMENDATIONS':
   - List 3-5 new features/improvements worth adding to PRD
   - Flag any issues that took a long time or couldn't be solved
   - Recommend: 'SHIP IT for user feedback' OR 'More work needed because...'
   - Note what needs manual testing before shipping

ONLY WORK ON A SINGLE FEATURE.
If PRD is complete, output <promise>COMPLETE</promise>."

completed=0
for ((i=1; i<=$1; i++)); do
    echo "============================================"
    echo "Iteration $i of $1 (PRODUCTION MODE)"
    echo "Working directory: $(pwd)"
    echo "============================================"
    result=$(claude --permission-mode bypassPermissions -p "$PROMPT")

    echo "$result"
    ((completed++))

    if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
        echo "PRD complete, exiting."
        # Extract recommendations if present
        recs=$(grep -A 20 "RALPH RECOMMENDATIONS" plans/progress.txt 2>/dev/null | head -15 || echo "Check progress.txt for details")
        "$SCRIPT_DIR/notify.sh" "🎉 Ralph (prod) COMPLETE!

✅ $completed features done

📋 RECOMMENDATIONS:
$recs"
        exit 0
    fi
done

echo "============================================"
echo "Completed $1 iterations"
echo "============================================"

# Send notification with summary
remaining=$(grep -c '"passes": false' plans/prd.json 2>/dev/null || echo "?")
"$SCRIPT_DIR/notify.sh" "Ralph (prod) finished $completed iterations.
📊 Remaining: $remaining features"
