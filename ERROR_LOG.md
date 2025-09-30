# Error Log

This document tracks all errors encountered during development, how they were fixed, and prevention strategies.

---

## Format

Each error entry should include:

```markdown
## [Date] - [Brief Description]

**Feature:** [What was being worked on]
**Phase:** [Which development phase]
**Error:**
```
[Error message or description]
```
**Cause:** [Root cause analysis]
**Fix:** [How it was resolved]
**Prevention:** [How to avoid in the future]
**Status:** [✅ Fixed | ⚠️ Workaround | ❌ Unresolved]
**Commit:** [Git commit hash if applicable]
```

---

## Active Issues

*No active issues at this time.*

---

## Resolved Issues

### [Example] 2025-09-30 - Initial Setup

**Feature:** Project initialization
**Phase:** Setup
**Error:**
```
No errors - baseline established
```
**Status:** ✅ Setup complete

---

## Issue Categories

### Parsing Errors
*Issues related to binary file parsing, roster files, franchise files, etc.*

### IPC Communication Errors
*Issues with Electron main/renderer IPC communication*

### UI/Rendering Errors
*Issues with Handsontable, DOM manipulation, styling*

### Build/Packaging Errors
*Issues with Vite, Electron Forge, packaging, ASAR*

### Testing Errors
*Issues with Playwright tests, Jest tests*

### Data Validation Errors
*Issues with player attributes, field validation, data integrity*

### Performance Issues
*Memory leaks, slow operations, optimization needs*

### Dependency Issues
*Problems with npm packages, native modules, versions*

---

## Error Prevention Checklist

Before committing code, verify:

- [ ] All Playwright tests pass
- [ ] No console errors in Electron app
- [ ] App packages successfully
- [ ] No memory leaks detected
- [ ] All file paths resolved correctly
- [ ] Error handling exists for all async operations
- [ ] User-facing errors have friendly messages

---

## Known Limitations

### Current Limitations
*Document any known issues that are accepted limitations*

### Technical Debt
*Track technical debt that should be addressed later*

---

## Recovery Procedures

### If App Won't Start
1. Check `npm start` output for errors
2. Verify all IPC handlers registered in src/main.ts
3. Check preload.ts exposes correct APIs
4. Clear `.vite` build directory: `npm run clean`
5. Reinstall dependencies: `rm -rf node_modules && npm install`

### If Parsing Fails
1. Verify file format with hex editor (first 4 bytes)
2. Check file size is reasonable (>1MB for roster files)
3. Test with known-good test files from test directory
4. Enable debug logging in parser
5. Compare against working MyFranchise implementation

### If Tests Fail
1. Run tests with headed mode to see UI
2. Check test-reports directory for screenshots
3. Verify test fixtures exist
4. Check console logs in test output
5. Run individual test in isolation

### If Packaging Fails
1. Check forge.config.ts for correct ASAR unpacking
2. Verify native modules rebuild
3. Check all data files copied to build
4. Test on clean install (different directory)
5. Review electron-forge output for specific errors

---

## Debugging Tips

### Enable Debug Logging
```javascript
// In main.ts
if (isDevelopment) {
  console.log('Debug mode enabled');
  // Add verbose logging
}
```

### Inspect Binary Files
```bash
# View first 100 bytes of roster file
xxd -l 100 ROSTER-Official
```

### Check IPC Communication
```javascript
// In renderer
window.electronAPI.parser.parseRosterFile(path)
  .then(result => console.log('Parse result:', result))
  .catch(err => console.error('Parse error:', err));
```

### Monitor Memory Usage
```javascript
// In main process
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('Memory:', Math.round(usage.heapUsed / 1024 / 1024), 'MB');
}, 5000);
```

---

## Contributing to Error Log

When you encounter and fix an error:

1. **Immediately document it** - Don't wait
2. **Be specific** - Include exact error messages
3. **Explain the fix** - Help future you understand
4. **Add prevention** - How to avoid this in the future
5. **Update status** - Mark as resolved when fixed

**This log is critical for:**
- Avoiding repeated mistakes
- Understanding system behavior
- Debugging similar issues
- Training new contributors
- Maintaining code quality

---

*Last Updated: 2025-09-30*
