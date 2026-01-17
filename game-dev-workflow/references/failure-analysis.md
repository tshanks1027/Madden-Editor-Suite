# Failure Analysis: Root Cause Investigation

Systematic methodology for analyzing build failures and identifying root causes.

## The 5 Whys Method

When a build fails, ask "why" repeatedly until you reach the root cause:

```
Build failed with linking error
└── Why? Missing symbol `UGameplayAbility::Execute`
    └── Why? Header not included
        └── Why? New dependency added without updating includes
            └── Why? Developer copied code from example without checking imports
                └── ROOT CAUSE: Missing include statement
```

## Error Classification

### Level 1: Surface Error (What you see)
```
error LNK2019: unresolved external symbol
```

### Level 2: Proximate Cause (Direct reason)
```
Function declared but not defined/linked
```

### Level 3: Root Cause (Why it happened)
```
Module not added to Build.cs dependencies
```

### Level 4: Systemic Cause (Why it keeps happening)
```
No automated dependency checking in build pipeline
```

## Failure Categories

### Compile-Time Failures

| Error Type | Common Causes | First Check |
|------------|---------------|-------------|
| Syntax error | Typo, missing semicolon | Line indicated in error |
| Type mismatch | Wrong argument type | Function signature |
| Undefined identifier | Missing include/import | Header files |
| Template error | Incorrect template usage | Template instantiation |

### Link-Time Failures

| Error Type | Common Causes | First Check |
|------------|---------------|-------------|
| Unresolved external | Missing library/module | Build.cs/CMakeLists |
| Multiple definitions | Duplicate symbols | Header guards |
| Missing entry point | No main/WinMain | Project settings |

### Runtime Failures

| Error Type | Common Causes | First Check |
|------------|---------------|-------------|
| Null pointer | Uninitialized reference | Object lifecycle |
| Access violation | Memory corruption | Array bounds |
| Stack overflow | Infinite recursion | Call stack |
| Assertion failed | Precondition violated | Assert message |

### Logic Failures

| Error Type | Common Causes | First Check |
|------------|---------------|-------------|
| Wrong output | Algorithm bug | Input/output trace |
| Race condition | Threading issue | Synchronization |
| State corruption | Side effects | State transitions |

## Analysis Workflow

```
1. CAPTURE the error exactly
   - Full error message
   - Stack trace if available
   - Context (what action triggered it)

2. CLASSIFY the error
   - Compile/Link/Runtime/Logic?
   - Which layer of the stack?

3. CHECK history
   - Have we seen this before?
   - What fixed it last time?

4. ISOLATE the cause
   - Minimum reproduction case
   - Which change introduced it?

5. VERIFY the fix
   - Does fix address root cause?
   - Could it break something else?

6. DOCUMENT for future
   - Add to KNOWN_ISSUES.md
   - Update failure_patterns.json
```

## Pattern Recognition

### Recurring Patterns

**Pattern: "Works in Debug, Fails in Release"**
- Usually: Uninitialized variables
- Check: Variable initialization, compiler optimizations

**Pattern: "Works Locally, Fails in CI"**
- Usually: Environment differences
- Check: Path dependencies, missing files, permissions

**Pattern: "Worked Yesterday"**
- Usually: Recent change broke it
- Check: Git diff since last working commit

**Pattern: "Random Failures"**
- Usually: Race condition or timing issue
- Check: Threading, async operations, external dependencies

### Error Message Decoding

**Unreal Engine:**
```
LogCompile: Error: ... missing '#include "..."'
→ Add the missing include

LogLinker: Error: ... unresolved external ...
→ Add module to Build.cs PublicDependencyModuleNames

LogBlueprint: Error: ... accessed None ...
→ Null check before accessing object
```

**Visual Studio:**
```
C2065: undeclared identifier
→ Missing include or typo in name

LNK2019: unresolved external symbol
→ Missing library or implementation

C4716: must return a value
→ Missing return statement
```

## Debugging Decision Tree

```
Error Occurred
│
├─ Compile Error?
│  ├─ Syntax → Fix syntax at line indicated
│  ├─ Type → Check function signatures
│  └─ Include → Add missing header
│
├─ Link Error?
│  ├─ Unresolved → Add library/module
│  ├─ Duplicate → Check header guards
│  └─ Missing → Verify project configuration
│
├─ Runtime Error?
│  ├─ Crash → Check stack trace, add null checks
│  ├─ Exception → Handle or prevent the condition
│  └─ Assertion → Fix violated precondition
│
└─ Logic Error?
   ├─ Wrong Output → Trace data flow
   ├─ Performance → Profile and optimize
   └─ Intermittent → Check threading/timing
```

## Integration with Test History

When analyzing a failure:

1. **Query test_history.db:**
   ```sql
   SELECT * FROM test_history
   WHERE error_type = 'link_error'
   ORDER BY timestamp DESC LIMIT 5;
   ```

2. **Check failure_patterns.json:**
   ```json
   {
     "link_error": {
       "count": 5,
       "solutions": ["Add to Build.cs", "Enable plugin"],
       "last_occurrence": "2024-11-03T14:22:00Z"
     }
   }
   ```

3. **Review KNOWN_ISSUES.md:**
   ```markdown
   ## Issue: Unresolved UGameplayAbility
   **Solution:** Add "GameplayAbilities" to Build.cs
   ```

4. **If solution exists:** Apply it
5. **If new error:** Investigate, solve, document

## Post-Mortem Template

After fixing a significant failure:

```markdown
## Failure Post-Mortem: [Date]

### What Happened
[Description of the failure]

### Impact
[What was affected, how long]

### Root Cause
[The actual reason, not symptoms]

### Fix Applied
[What was changed]

### Prevention
[How to avoid in future]

### Detection
[How to catch earlier next time]
```
