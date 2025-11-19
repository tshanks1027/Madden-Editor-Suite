---
name: game-dev-workflow
description: "Comprehensive game development workflow system enforcing structured methodology (Research→Plan→Implement→Test→Debug→User Test→Commit→Package Test) with intelligent test history tracking, automatic failure pattern detection, and mandatory project context loading. Prevents redundant testing by analyzing build history. Integrates security scanning workflows for Unreal and Madden projects. Use when starting any game development or modding project, during development cycles to maintain workflow discipline, when testing to prevent repetitive test cycles, and for security validation before release."
---

# Game Dev Workflow Skill

Complete workflow system for game development and modding with intelligent test tracking and security integration.

## Core Workflow

The system enforces this sequence for all projects:

1. **Research** - Investigate requirements, existing solutions, technical constraints
2. **Plan** - Create detailed implementation plan with milestones
3. **Implement** - Execute plan with regular checkpoints
4. **Test (Loop)** - Systematic testing; prevented from repeating failed tests
5. **Debug (Loop)** - Root cause analysis; guided by test history
6. **User Test** - Validation with actual users/stakeholders
7. **Commit** - Version control with verified working state
8. **Package Test** - Final validation before distribution

**Nightly Automation:** Code optimization, dead code removal, security scanning

## Getting Started: Project Setup

Every project must have a `.project-memory/` directory (gitignored) with metadata files.

### Required Documentation Files

Create these in your project root before starting work:

**`PROJECT_SETUP.md`** - How to build and run this specific project
```
# Build Instructions
[Your exact build commands]

# Run Instructions
[How to test locally]

# Critical Dependencies
[Libraries, versions, requirements]
```

**`TESTING_STRATEGY.md`** - What testing matters for THIS project
```
# Test Categories
- Unit Tests: [what to test]
- Integration Tests: [combinations that matter]
- Performance Tests: [benchmarks and thresholds]

# Known Test Pitfalls
- [Tests to avoid, they're unreliable]
- [Tests that are expensive/unnecessary]
```

**`KNOWN_ISSUES.md`** - Solutions to problems you've already solved
```
## Issue: [Problem Description]
**Symptoms:** What you observe
**Root Cause:** Why it happens
**Solution:** What fixed it
**Prevention:** How to avoid next time
```

**`ARCHITECTURE.md`** - How components interact
```
# System Architecture
[Major components and relationships]

# Critical Dependencies
[What breaks if X fails]

# Performance Constraints
[Limits you must respect]
```

**`SECURITY_REQUIREMENTS.md`** - Security specifics (Unreal or Madden)

For **Unreal projects with payments:**
```
# Payment Protection
Users can pay: yes
Code must be protected: yes
User data stored: yes/no

# Scanning Requirements
- Dependency vulnerabilities: CRITICAL
- Secrets detection: CRITICAL
- Code obfuscation: REQUIRED
```

For **Madden modding:**
```
# Code Protection
Code must be protected: yes
Dependencies scanning: optional
```

### Automatic Project Memory

The skill creates this structure automatically in `.project-memory/` (gitignore it):

- **`test_history.db`** - SQLite tracking all test runs, results, errors
- **`build_log.json`** - Build attempts with compiler output
- **`failure_patterns.json`** - Grouped errors and their solutions
- **`security_scans.json`** - Vulnerability scan results
- **`session_log.json`** - Current session progress and phase

## How This Skill Prevents Your Pet Peeve

### The Problem You Had
Claude would run a build, it would fail, then suggest the exact same test again.

### How This Prevents It

**Before any test is suggested:**
1. Check test_history.db: "Have we tested this exact condition?"
2. If yes: Skip it
3. If no: Check failure_patterns.json: "What type of error are we seeing?"
4. Match against TESTING_STRATEGY.md: "What test actually targets this?"
5. Only suggest tests that are either:
   - Novel (not run before)
   - Targeting a different stack layer
   - Based on a new hypothesis about the root cause

**Example:**
- First build attempt fails with "shader compilation error"
- Claude logs the test and failure
- Next suggestion is NOT "run the build again"
- Instead: "Unit test the shader separately" or "Check the shader includes" (different layer)
- If the same build is suggested, it's because something changed, and Claude references what changed

**Automatic Logging:**
- Every test result is auto-logged with timestamp, error type, and context
- You never need to manually tell Claude "log this"
- The database prevents repeats automatically

## Using the Skill

### Starting a New Project

```
"I'm starting a new Unreal game with in-app purchases.
Here's my PROJECT_SETUP.md:
[paste content]

I also have TESTING_STRATEGY.md, KNOWN_ISSUES.md, ARCHITECTURE.md, 
and SECURITY_REQUIREMENTS.md in my project root."
```

The skill will:
1. Load all MD files and understand your project
2. Create `.project-memory/` structure
3. Update Claude memory with your project type and requirements
4. Begin at Research phase

### During Development

```
"I'm at the Implement phase. Starting work on [feature]"
```

Skill automatically:
- Tracks your progress through workflow phases
- Guides you through each stage systematically
- Prevents skipping phases
- Maintains state across conversations

### When a Build Fails

```
"Build failed with this error:
[paste compiler output]"
```

Skill:
1. Parses the error
2. Checks test_history.db for similar errors
3. Reviews KNOWN_ISSUES.md for solutions
4. Analyzes failure_patterns.json for patterns
5. Suggests the NEXT test to run (not a repeat)
6. Auto-logs the attempt

### At Transition Points

```
"Tests are passing. Ready to move to Debug phase"
```

Skill validates you're ready and transitions you through the workflow safely.

### Before Release

```
"Ready for Package Test"
```

Skill runs final security and quality validation based on your SECURITY_REQUIREMENTS.md.

## Key Features That Solve Your Problems

### 1. No Redundant Tests
Test history database prevents repeating identical tests. Claude understands the difference between "testing the same thing again" vs "testing a different layer."

### 2. Automatic Logging
All test results logged without manual intervention. Build log, failure patterns, and security scans all recorded automatically.

### 3. Failure Pattern Recognition
Similar errors grouped automatically. If you've solved this type of problem before, Claude checks KNOWN_ISSUES.md first.

### 4. Security Integrated by Project Type
- **Unreal with payments:** Full security workflow (dependencies, secrets, obfuscation)
- **Madden mods:** Code protection focus
- Security requirements are verified at each phase

### 5. Claude Memory Integration
Your personal patterns persist across all projects:
- Which tests typically work for your code style
- Common failure types you encounter
- Effective debugging strategies for your architecture

## Project Memory Structure

```
your-project/
├── .gitignore           (add: .project-memory/)
├── .project-memory/     (auto-created, holds logs)
│   ├── test_history.db
│   ├── build_log.json
│   ├── failure_patterns.json
│   ├── security_scans.json
│   └── session_log.json
├── PROJECT_SETUP.md     (you create)
├── TESTING_STRATEGY.md  (you create)
├── KNOWN_ISSUES.md      (you create)
├── ARCHITECTURE.md      (you create)
├── SECURITY_REQUIREMENTS.md (you create)
└── [your game code]
```

## Reference Materials

See included references for detailed guidance:

- **`unreal-security.md`** - Complete Unreal security checklist for payment-protected code
- **`madden-security.md`** - Madden modding code protection patterns
- **`test-deduplication.md`** - How test history prevents redundant testing
- **`failure-analysis.md`** - Root cause analysis methodology

## Scripts

The skill includes automation scripts:

- **`project_memory_manager.py`** - Manages SQLite database and JSON logs
- **`test_history_analyzer.py`** - Analyzes test patterns and prevents repeats
- **`security_validator.py`** - Validates security requirements before release
- **`failure_pattern_detector.py`** - Groups and analyzes errors automatically

## Quick Checklist: First Time Setup

- [ ] Create `.project-memory/` directory at project root
- [ ] Add `.project-memory/` to `.gitignore`
- [ ] Write `PROJECT_SETUP.md` (copy the template above)
- [ ] Write `TESTING_STRATEGY.md` (what tests matter for your game)
- [ ] Write `KNOWN_ISSUES.md` (start empty, fill as you solve problems)
- [ ] Write `ARCHITECTURE.md` (your game's major components)
- [ ] Write `SECURITY_REQUIREMENTS.md` (are you Unreal/payments or Madden/code-only?)
- [ ] Paste content when you tell Claude you're starting this project
- [ ] Let the skill auto-create the database and logs

Done. Now your workflow is tracked, tests won't repeat, and Claude remembers your project patterns.
