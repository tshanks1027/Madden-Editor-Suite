# Development Workflow

This document defines the exact workflow for developing the Madden Retro Franchise Editor. **Every feature must follow this workflow - no exceptions.**

---

## Workflow Overview

```
User Request
    ↓
AI reads CLAUDE.md
    ↓
Research (if needed)
    ↓
Plan Mode - Propose Approach
    ↓
User Approval
    ↓
AI Implementation
    ↓
Testing Agent (Playwright)
    ↓
User Testing
    ↓
Packaging Agent
    ↓
Optimizer Agent
    ↓
Git Commit (user approval)
```

---

## Phase 1: User Request

**What happens:**
- User describes the feature or fix needed
- User may reference CLAUDE.md or this WORKFLOW.md

**AI Response:**
1. Read CLAUDE.md completely
2. Confirm tech stack is understood
3. Ask clarifying questions if needed

---

## Phase 2: Research (When Needed)

**When to use Research:**
- ANY parsing or binary file work
- IPC handlers or file I/O
- Complex features without clear implementation path
- When you don't know the best approach

**Research Process:**
1. Use Task agent (general-purpose subagent)
2. Research existing implementations in:
   - RESEARCH_FINDINGS.md
   - GitHub repos documented
   - Local tools (MyFranchise, etc.)
3. Create findings document
4. Present findings to user
5. Wait for approval before coding

**Example:**
```
User: "Add roster file parsing"
AI: "I need to research parsing approaches first"
→ Task agent researches madden-franchise package
→ Creates research doc with recommendations
→ Shows user the options
→ Waits for "use madden-franchise approach"
```

---

## Phase 3: Plan Mode - Propose Approach

**AI Must:**
1. Stay in plan mode
2. List ALL files that will be modified/created
3. Describe the exact approach
4. Reference source code (if adapting from references)
5. Estimate complexity
6. Wait for explicit approval

**User Responses:**
- "approved" or "proceed" → AI can start coding
- "no" or raises concerns → AI must revise plan
- "explain X" → AI clarifies then waits again

**Example Plan:**
```markdown
## Proposed Approach: Roster File Parsing

### Files to Modify:
- src/main/ipc/parser-handlers.ts (create)
- src/main.ts (register IPC handlers)
- src/preload.ts (expose API)

### Files to Create:
- src/main/parsers/RosterParser.js (adapt from madden-franchise)

### Approach:
1. Install madden-franchise@3.8.0 and bit-buffer
2. Create RosterParser.js based on FranchiseFile.js pattern
3. Add IPC handler for parse-roster-file
4. Expose to renderer via preload
5. Test with ROSTER-Official file

### Source Attribution:
- Code adapted from madden-franchise by bep713 (MIT License)
- Reference: RESEARCH_FINDINGS.md section 2.1

### Estimated Time: 2-3 hours

Waiting for approval to proceed...
```

---

## Phase 4: User Approval

**User must explicitly approve with:**
- "approved"
- "proceed"
- "go ahead"
- "looks good"

**If user says anything else:**
- Stop and wait for clarification
- Revise plan if requested
- Answer questions
- Do NOT proceed without explicit approval

---

## Phase 5: Implementation

**AI Implements:**
1. Write code as proposed
2. Add source attribution comments
3. Follow existing code patterns
4. Use tech stack (Vanilla JS + Handsontable + Electron)
5. No deletions without permission
6. No new dependencies without approval

**During Implementation:**
- If you need to deviate from plan, STOP and get approval
- If you discover issues, report them immediately
- Update ERROR_LOG.md if fixing bugs
- Keep user informed of progress

---

## Phase 6: Testing Agent (Playwright)

**Automated Testing:**
1. Testing agent launches Electron app
2. Runs Playwright E2E tests
3. Verifies feature works end-to-end
4. Captures console logs
5. Takes screenshots
6. Generates HTML test report

**Test Results:**
- ✅ **PASS** → Continue to Phase 7
- ❌ **FAIL** → Back to Phase 5, AI fixes issues

**Example Test:**
```javascript
test('Roster File Parsing', async ({ page }) => {
  // Launch app
  await page.waitForSelector('#openFileBtn');

  // Open test file
  await page.click('#openFileBtn');
  // ... file dialog handling

  // Verify players loaded
  const playerCount = await page.textContent('#playerCount');
  expect(playerCount).toContain('3500 players');

  // Screenshot for verification
  await page.screenshot({ path: 'test-reports/roster-loaded.png' });
});
```

**Testing agent reports:**
- Pass/fail status
- Console log output
- Screenshots
- Error details (if failed)

---

## Phase 7: User Testing

**User manually verifies:**
1. Feature works as expected
2. No regressions (old features still work)
3. UI looks correct
4. Performance is acceptable

**User Responses:**
- "Feature works" or "confirmed" → Continue to Phase 8
- "Issue with X" or "doesn't work" → Back to Phase 5

**What user tests:**
- Click through UI
- Try edge cases
- Verify file outputs
- Check for errors in console

---

## Phase 8: Packaging Agent

**Packaging Verification:**
1. Run `npm run package`
2. Verify app bundles without errors
3. Check for dependency issues
4. Test that packaged app runs
5. Verify all assets included

**Packaging agent checks:**
- No missing dependencies
- ASAR packaging works
- Native modules rebuild correctly
- Data files copied to build
- App launches from package

**Results:**
- ✅ **SUCCESS** → Continue to Phase 9
- ❌ **ISSUES** → Back to Phase 5, fix packaging problems

---

## Phase 9: Optimizer Agent

**Code Optimization Check:**
1. Scan for abandoned code
2. Check for memory leaks
3. Find unused imports
4. Detect dead logic paths
5. Verify no duplicate code

**Optimizer agent looks for:**
- Unused variables/functions
- Memory not being freed
- Inefficient loops
- Dead code paths
- Code duplication

**Results:**
- ✅ **CLEAN** → Continue to Phase 10
- ⚠️ **ISSUES FOUND** → Fix them, then continue

---

## Phase 10: Git Commit

**Commit Process:**
1. User says "commit this" or "ready to commit"
2. AI shows `git status` and `git diff`
3. AI proposes commit message
4. User approves commit message
5. Git agent commits with proper attribution

**Commit Message Format:**
```
[Feature/Fix]: Brief description

Detailed explanation of what changed and why.

Source Attribution:
- Code adapted from [source] ([license])

✅ Testing: Playwright tests passed
✅ User Testing: Confirmed working
✅ Packaging: Verified bundling
✅ Optimized: No issues found

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Git agent ONLY commits when:**
- User explicitly approves
- All previous phases passed
- Commit message approved

---

## Agent Configurations

### Task Agent (Research)
**Purpose:** Research existing implementations before coding

**When to use:**
- Parsing/binary file work
- IPC handlers
- Complex features
- Unclear implementation path

**Output:** Markdown document with findings and recommendations

---

### Testing Agent (Playwright)
**Purpose:** Automated E2E feature testing

**Configuration:**
```javascript
// tests/e2e/helpers/test-config.js
{
  browser: 'chromium',
  headless: false, // Show window for user to see
  timeout: 30000,
  retries: 1,
  screenshot: 'on',
  video: 'retain-on-failure',
  trace: 'on'
}
```

**Output:** HTML report with pass/fail, screenshots, console logs

---

### Packaging Agent
**Purpose:** Verify app can be packaged without errors

**Process:**
1. Run `npm run clean`
2. Run `npm run package`
3. Check for errors
4. Test packaged app launches
5. Verify assets included

**Output:** Pass/fail with error details if failed

---

### Optimizer Agent
**Purpose:** Check for code quality issues

**Checks:**
```javascript
// Check for:
- Unused imports
- Unused variables
- Memory leaks (event listeners not removed)
- Dead code paths
- Duplicate code blocks
- Inefficient algorithms
- Missing error handling
```

**Output:** List of issues found with file/line numbers

---

### Git Agent
**Purpose:** Create properly formatted commits

**Process:**
1. Verify all phases passed
2. Run `git status`
3. Run `git diff`
4. Propose commit message
5. Wait for user approval
6. Execute commit

**Commit Requirements:**
- Clear description
- Source attribution if applicable
- Testing confirmation
- Proper formatting

---

## Error Handling

**When errors occur:**
1. Log error to ERROR_LOG.md
2. Include:
   - Date/time
   - Feature being worked on
   - Error message
   - How it was fixed
   - Prevention strategy
3. Continue workflow from appropriate phase

**Example Error Log Entry:**
```markdown
## 2025-09-30 - Roster Parser Error

**Feature:** Phase 1 - Roster Editor parsing

**Error:**
```
Error: Cannot read property 'tables' of undefined
```

**Cause:** madden-franchise FranchiseFile expects different file format

**Fix:** Added file type detection before parsing

**Prevention:** Always validate file format before attempting parse

**Status:** ✅ Fixed and tested
```

---

## Release Notes

**When to update RELEASE_NOTES.md:**
- After completing any user-facing feature
- After fixing any significant bug
- At the end of each development phase

**Format:**
```markdown
## [0.1.0] - 2025-09-30

### Added
- Roster file parsing (Phase 1)
- Handsontable-based editor
- Player attribute editing
- Save back to Madden format

### Technical
- Integrated madden-franchise@3.8.0
- Created RosterParser.js
- Added Playwright test suite

### Credits
- Binary parsing: madden-franchise by bep713 (MIT License)
```

---

## Workflow Violations

**If AI violates workflow:**
1. User stops AI immediately
2. User points out violation
3. AI acknowledges error
4. AI returns to appropriate phase
5. AI does NOT proceed until workflow restored

**Common Violations:**
- Skipping research phase
- Not staying in plan mode
- Proceeding without approval
- Deleting files without permission
- Skipping testing phases
- Committing without approval

**Consequences:**
- Restart from Phase 1
- Re-read CLAUDE.md
- Fix any damage caused
- Continue workflow properly

---

## Summary Checklist

For EVERY feature, verify:

- [ ] Read CLAUDE.md
- [ ] Research completed (if needed)
- [ ] Plan proposed and approved
- [ ] Implementation follows tech stack
- [ ] Playwright tests pass
- [ ] User testing confirmed
- [ ] Packaging verified
- [ ] Optimization check passed
- [ ] Commit approved and executed
- [ ] ERROR_LOG.md updated (if errors occurred)
- [ ] RELEASE_NOTES.md updated (if user-facing feature)

**If any checkbox is unchecked, workflow is incomplete.**

---

## Contact

**Questions about workflow:**
- Check CLAUDE.md for rules
- Check RESEARCH_FINDINGS.md for technical guidance
- Check MASTER_PLAN.md for feature requirements
- Ask user for clarification

**Never:**
- Assume you can skip a phase
- Proceed without approval
- Delete files without permission
- Change tech stack without permission
- Bypass workflow because "it's faster"

---

*This workflow ensures quality, prevents breaking changes, and maintains code attribution.*
