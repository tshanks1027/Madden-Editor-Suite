# Test Deduplication: Never Test the Same Thing Twice

How the intelligent tester prevents redundant testing and guides toward productive tests.

## The Problem

You build → it fails → Claude suggests the same test again → it fails the same way → repeat.

This wastes time and frustrates you.

## The Solution

Before suggesting ANY test, the system checks:

1. **Have we already tested this exact thing?**
2. **What type of error are we seeing?**
3. **What test actually targets the root cause?**
4. **Is this a novel test or testing a different layer?**

## How It Works in Practice

### Scenario 1: Repeated Build Test (THE PROBLEM)

**Build 1:**
```
Error: Undefined reference to `UGameplayAbility::Execute()`
```

Claude suggests: "Run the build again"
→ Same error
→ Claude suggests: "Run the build again"
→ Same error

**What the skill does instead:**

Test History Check:
```
test_history.db shows:
- 2024-11-03 14:22 Build attempt: "shader compilation" → FAILED
- 2024-11-03 14:25 Build attempt: "link error" → FAILED
```

Failure Pattern Analysis:
```
failure_patterns.json shows:
- Last 3 build attempts: ALL "undefined reference" class
- This is a linking problem, not a shader problem
```

Claude's response:
```
"The last 3 builds all failed with linking errors. 
Running build #4 with identical settings would fail identically.

Instead, let's test the specific layer causing this:
1. Verify UGameplayAbility.h is included
2. Check the library is linked in .Build.cs
3. Verify the plugin is enabled

This tests a DIFFERENT LAYER (includes/linking) not just recompiling."
```

### Scenario 2: Novel Test After Learning

**After testing includes → still fails:**
```
New error: Undefined reference: likely module linking
```

Claude checks:
- Have we tested "modify project file" before? No.
- Does it target linking layer specifically? Yes.
- Is this a new hypothesis? Yes (move from includes to .Build.cs)

Claude suggests: "Edit YourGame.Build.cs to add the module"
→ Different test, different layer, targets root cause

### Scenario 3: Confirming a Fix Works

**After fix is applied:**
```
Build attempt before fix: FAILED (with undefined reference)
```

Claude checks:
- The error type changed? No → don't retest
- Something in the code changed? Yes (includes added)
- Does the original test now make sense? Yes

Claude suggests: "Run build again to confirm the fix"
→ This IS a retest, but it's justified (code changed, testing the fix)

Claude logs it:
```
test_history.db:
- Build #3: FAILED (undefined reference)
- Include added in UGameplayAbility.cpp
- Build #4: Testing if include fix resolved linking error
- Build #4 result: SUCCESS
```

## Test Deduplication Logic

```
BEFORE suggesting a test:

1. Query: "Have we run this exact test before?"
   - Same file modified?
   - Same command executed?
   - Same error to investigate?
   
   If YES and code unchanged: SKIP (redundant)
   If YES but code changed: RETEST (validating fix)
   
2. Query: "What error are we seeing?"
   - Parse error message
   - Classify error type (compile, link, runtime, etc.)
   - Check failure_patterns.json for similar errors
   
3. Query: "Did we already test this error type?"
   - Look at last 5 test results
   - Have we tested this error type already?
   
   If YES and hypothesis unchanged: SKIP (redundant)
   If YES but new hypothesis: TEST (different approach)
   
4. Query: "Does this test target a different layer?"
   - Compile layer: compilation, preprocessing
   - Link layer: linking, symbols
   - Runtime layer: execution, logic
   - Integration layer: interaction between systems
   
   If testing same layer same way: SKIP
   If testing same layer different way: CONDITIONAL (new approach)
   If testing different layer: TEST (productive)

5. Log the decision:
   - Why we skipped / why we tested
   - What layer we're targeting
   - What hypothesis we're testing
```

## Test Categories

Understanding test layers helps avoid redundancy:

### Compile Layer Tests
- Syntax errors
- Type checking
- Preprocessor directives
- Include paths

**Examples:**
```
"Check includes are correct"
"Verify type definitions"
"Run compiler with verbose flags"
```

**When to repeat:** Only if you changed source code

### Link Layer Tests
- Undefined references
- Missing libraries
- Symbol conflicts
- Module dependencies

**Examples:**
```
"Verify module in .Build.cs"
"Check .lib files exist"
"Add missing third-party library"
```

**When to repeat:** Only if you changed .Build.cs or dependencies

### Runtime Layer Tests
- Logic errors
- Crashes during execution
- Incorrect output
- Memory issues

**Examples:**
```
"Step through debugger"
"Add debug print statements"
"Check variable values"
```

**When to repeat:** After each logic change

### Integration Layer Tests
- Systems interacting incorrectly
- Data not flowing between components
- Timing/race conditions
- API mismatches

**Examples:**
```
"Test component A alone"
"Test component B alone"
"Test A and B together"
```

**When to repeat:** After interface changes

## Test History Database Structure

```json
{
  "test_history": [
    {
      "id": 1,
      "timestamp": "2024-11-03T14:22:00Z",
      "phase": "Test",
      "test_type": "build_compile",
      "layer": "compile",
      "command": "uat.bat BuildCook ...",
      "result": "FAILED",
      "error_type": "undefined_reference",
      "error_message": "Undefined reference to `UGameplayAbility::Execute()`",
      "duration_seconds": 45,
      "hypothesis": "Missing include file"
    },
    {
      "id": 2,
      "timestamp": "2024-11-03T14:25:00Z",
      "phase": "Test",
      "test_type": "build_compile",
      "layer": "compile",
      "command": "uat.bat BuildCook ...",
      "result": "FAILED",
      "error_type": "undefined_reference",
      "error_message": "Undefined reference to `UGameplayAbility::Execute()`",
      "duration_seconds": 47,
      "hypothesis": "Missing include file (identical test, should skip)"
    },
    {
      "id": 3,
      "timestamp": "2024-11-03T14:28:00Z",
      "phase": "Debug",
      "test_type": "code_review",
      "layer": "link",
      "command": "grep -r UGameplayAbility .",
      "result": "SUCCESS",
      "error_type": "none",
      "error_message": "Found reference in GameplayAbility.Build.cs",
      "duration_seconds": 2,
      "hypothesis": "Module might not be linked in Build.cs"
    }
  ],
  "failure_patterns": {
    "undefined_reference": [1, 2],
    "compile_errors": [1, 2],
    "recent_errors": ["undefined_reference", "undefined_reference", "none"]
  }
}
```

When Claude sees test #2, it checks history:
- Test #1 exists with identical: command, error_type, layer
- Code hasn't changed since #1
- Hypothesis is identical ("Missing include")
- Recommendation: SKIP, move to Debug layer instead

## Preventing Test Redundancy: Checklist

Before Claude suggests any test:

- [ ] Check test_history.db for identical test
- [ ] If found and code unchanged: ASK FIRST (don't just repeat)
- [ ] If code changed: OK to repeat (validating fix)
- [ ] Check error classification (compile/link/runtime/integration)
- [ ] Check if we've tested this error classification already
- [ ] If yes same approach: propose DIFFERENT approach
- [ ] If no: TEST
- [ ] Document the layer we're testing
- [ ] Document the hypothesis

## Example Flow

```
Build FAILED → "Link error: missing symbol"

Check history:
✓ Have we tested this symbol before? YES (5 minutes ago)
✓ Code changed? NO
✓ Hypothesis same? YES (module linking)
→ Decision: SKIP identical test

Instead suggest:
✗ "Run build again" (redundant)
✓ "Check if module is enabled in Editor" (different approach)
✓ "Verify plugin .uplugin file is correct" (different approach)
✓ "Search for symbol in all files" (debug layer)

This is productive testing that targets different angles.
```

## The Result

- **First build failure:** Test → fail → log
- **Second identical failure:** Check history → skip redundancy → suggest different layer
- **After fix:** Re-test to confirm (justified retest)
- **Never:** Suggest the same test multiple times without code changes

You progress faster, waste less time, and Claude learns your patterns.
