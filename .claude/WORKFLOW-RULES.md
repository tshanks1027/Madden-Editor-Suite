# MANDATORY PRE-ACTION WORKFLOW

**CRITICAL: You MUST follow these 5 steps BEFORE taking ANY action on ANY user request.**

This workflow is **NON-NEGOTIABLE** and exists because of repeated failures including:
- Breaking working code (October 28, 2025 - broke franchise editor portraits)
- Not committing working code when explicitly asked
- Spending entire days identifying problems without fixing them
- Using automated tools (Edit/sed/awk) that corrupt files
- Suggesting the user manually fix code YOU broke

---

## THE 5 MANDATORY STEPS

### STEP 1: READ PROJECT INSTRUCTIONS
**Action:** Read the entire `CLAUDE.md` file in the project root

**Why:** Contains critical project architecture, file structure, common pitfalls, and development workflows

**How to verify:**
```bash
# Use the Read tool
Read CLAUDE.md
```

**You must be able to answer:**
- What are the 3 Electron process types?
- Where are IPC handlers registered?
- What libraries are vendored and why?
- What are the 5 common pitfalls?

---

### STEP 2: READ GIT STATUS AND RECENT COMMITS
**Action:** Check current git state and last 10 commits

**Why:** Understand what's been changed recently, what's uncommitted, and what the user was working on

**How to verify:**
```bash
# Use Bash tool
git status
git log --oneline -10
git diff --stat
```

**You must be able to answer:**
- What files have uncommitted changes?
- What was the last commit about?
- Are there any conflicts or issues?

---

### STEP 3: IDENTIFY WHAT USER IS ASKING FOR
**Action:** Clearly state in your own words what the user wants

**Why:** Prevents misunderstanding and working on the wrong thing

**Format:**
```
USER REQUEST ANALYSIS:
- Primary goal: [what they want achieved]
- Affected files: [which files will be modified]
- Type of task: [bug fix / feature / refactor / investigation]
- Success criteria: [how to know it's done]
```

---

### STEP 4: STATE YOUR PLAN (3-5 BULLET POINTS)
**Action:** Write a concise plan with specific steps

**Why:** Allows user to catch mistakes BEFORE you waste time

**Format:**
```
EXECUTION PLAN:
1. [Specific action with file name and line numbers if applicable]
2. [Next specific action]
3. [Testing/verification step]
4. [Commit step if applicable]
```

**Requirements:**
- Be SPECIFIC (not "fix the bug" but "change line 1103 in franchise-editor.js to add portraitColumn")
- Include file paths and line numbers
- Include how you'll verify it works
- Include commit message if code changes

---

### STEP 5: WAIT FOR USER APPROVAL
**Action:** Output your plan and explicitly ask: "Proceed with this plan?"

**Why:** User needs to review and approve before you potentially break things

**DO NOT:**
- Start executing immediately
- Assume approval
- Begin any file modifications
- Run any non-readonly tools

**Wait for user to say:** "yes", "go ahead", "proceed", or similar confirmation

---

## ADDITIONAL CRITICAL RULES

### When Making Code Changes

1. **Use Write tool for complex changes** - NOT Edit, NOT sed, NOT awk
2. **Read files first** - Always read before writing
3. **Test after changes** - Verify syntax at minimum
4. **Commit working code immediately** - When user says "commit this", do it right then
5. **Never suggest user fixes your mistakes** - If you break it, YOU fix it

### When Things Go Wrong

1. **Stop immediately** - Don't make it worse
2. **Restore from git** - Use `git restore` or `git checkout` to undo
3. **Re-read these rules** - Figure out which step you skipped
4. **Ask for help** - Tell user what went wrong and get guidance

### Examples of Failures to Avoid

**October 29, 2025 - Portrait Rendering Disaster:**
- ❌ What happened: Spent 9 hours "finding the problem" without fixing it
- ❌ Root cause: Skipped Step 4 (stating plan) and Step 5 (waiting for approval)
- ❌ Made it worse: Used sed/awk which corrupted the file
- ❌ Final insult: Suggested USER manually fix the code
- ✅ What should have happened: Read file, state plan ("I will add portraitColumn definition at line 1103"), wait for approval, use Write tool, commit

**October 28, 2025 - Didn't Commit Working Code:**
- ❌ What happened: User asked to commit working franchise editor code, I didn't
- ❌ Root cause: Ignored explicit instruction
- ❌ Result: Working code was lost
- ✅ What should have happened: When user says "commit this", immediately run git add && git commit

---

## WORKFLOW CHECKLIST

Before responding to ANY user request, verify:

- [ ] I have read CLAUDE.md
- [ ] I have checked git status and recent commits
- [ ] I understand what the user wants
- [ ] I have stated a specific 3-5 step plan
- [ ] I have asked for approval and received it
- [ ] I will NOT use Edit/sed/awk for complex changes
- [ ] I will commit immediately if user asks

**If you cannot check all boxes, STOP and complete the missing steps.**

---

## SUCCESS CRITERIA

You are following this workflow correctly when:
1. Every response starts with reading CLAUDE.md and git status
2. Every response includes a clear plan statement
3. User approves your plan before you execute
4. Code changes work on first try
5. Commits happen when requested
6. Zero time wasted on broken approaches

---

## EMERGENCY STOP PHRASES

If user says any of these, STOP EVERYTHING:
- "stop"
- "that's wrong"
- "you broke it"
- "why the fuck"
- "useless"

When you see these, immediately:
1. Stop all execution
2. Ask what went wrong
3. Re-read these rules
4. Start over from Step 1
