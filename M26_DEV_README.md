# Madden 26 Development Branch

**Branch:** `feature/m26-support`
**Version:** `1.5.0-m26-dev`
**Status:** In Development - Not for Production

---

## Purpose

This branch is for developing and testing Madden 26 franchise file support without interfering with production releases (v1.5.0 on `master` branch).

## Key Information

- **madden-franchise library version:** 3.8.0 (already supports M26)
- **File format:** IDENTICAL to M25 (FBCHUNKS header, ZLIB compression)
- **Known limitation:** Character visuals editing may corrupt files (to be investigated - MyFranchise handles this)
- **Risk level:** LOW

## Development Tasks

### Phase 1: Basic M26 Support
- [ ] Add M26 detection to `TDBFileValidator.js`
- [ ] Update game version enum to include M26
- [ ] Test file loading with real M26 franchise files
- [ ] Verify madden-franchise parsing works correctly
- [ ] Add UI indicator for M26 files

### Phase 2: Feature Compatibility Testing
- [ ] Test player editing
- [ ] Test team editing
- [ ] Test roster operations
- [ ] Test schedule editing
- [ ] Test draft class operations
- [ ] Document any M26-specific issues

### Phase 3: Character Visuals Research
- [ ] Analyze how MyFranchise handles character visuals
- [ ] Compare M25 vs M26 character visuals table structure
- [ ] Implement safe character visuals editing (if feasible)
- [ ] Add warning/blacklist if unsafe

### Phase 4: Testing & Validation
- [ ] Create comprehensive test suite for M26
- [ ] Test with multiple M26 franchise files
- [ ] Verify in-game compatibility (load modified files in M26)
- [ ] Performance testing
- [ ] Edge case testing

### Phase 5: Documentation
- [ ] Update user documentation
- [ ] Add M26-specific notes
- [ ] Document any limitations
- [ ] Create migration guide for M25 users

## How to Work on This Branch

### Switch to M26 development:
```bash
git checkout feature/m26-support
npm start  # Runs v1.5.0-m26-dev
```

### Switch back to production:
```bash
git checkout master
npm start  # Runs v1.5.0 (stable)
```

### Test M26 build:
```bash
npm run package  # Creates m26-dev build
```

## Branch Strategy

1. **All M26 development happens in `feature/m26-support`**
2. **Master branch stays clean** for production releases
3. **When M26 support is stable:**
   - Merge `feature/m26-support` → `master`
   - Bump version to `1.6.0`
   - Release as stable

## Reference Documents

- **M26_FORMAT_RESEARCH.md** - Complete format research (17 KB)
- **M26_QUICK_SUMMARY.md** - Quick reference (2.2 KB)
- **M26_DEVELOPER_REFERENCE.md** - Implementation guide (11 KB)

## Testing Files

M26 franchise files should be placed in:
```
C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 26\
```

## Important Notes

⚠️ **DO NOT merge to master until:**
- [ ] All tests pass
- [ ] Real M26 files load correctly
- [ ] Modified files load in-game without corruption
- [ ] User documentation is complete
- [ ] Production build is ready for release

⚠️ **Character Visuals:**
- Research indicates editing may corrupt files
- MyFranchise successfully handles this - investigate their approach
- Do NOT enable until proven safe

---

**Created:** 2025-10-16
**Last Updated:** 2025-10-16
**Branch Created From:** master (9 commits ahead of origin/master)
