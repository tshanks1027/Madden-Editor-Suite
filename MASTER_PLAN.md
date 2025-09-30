# Master Plan: Madden Retro Franchise Editor

**Project Goal:** Create a comprehensive Madden NFL modding tool for creating retro franchise experiences with 17+ specialized editors and tools.

**Tech Stack:** Vanilla JavaScript + Handsontable + Electron (LOCKED)

**Development Approach:** 8 phases, each with specific features, acceptance criteria, and automated testing.

---

## Project Overview

The Madden Retro Franchise Editor is a desktop application that enables users to:
- Edit rosters, draft classes, and franchise saves
- Create historical rosters from web data
- Customize uniforms, fields, and visual elements
- Manage retro mods for specific eras (e.g., 1994 season)
- Use utility tools for commentary, weather, and exports

### Core Principles

1. **Standalone Application** - No external dependencies or online services required
2. **Data Integrity** - All edits preserve file format and load in Madden game
3. **Historical Accuracy** - Tools support era-appropriate data and rules
4. **User-Friendly** - Intuitive UI with Handsontable grids and validation
5. **Extensible** - Architecture supports adding new tools and features

---

## Phase 1: Roster Editor (Week 1)

**Status:** 🔴 Not Started (Current Phase)

### Objective
Create a fully functional roster file editor that can parse Madden roster files, display players in an editable grid, and save back to Madden format that loads in-game.

### Features

#### 1.1 File Parsing
- Parse Madden 25/26 roster files (PLAY table)
- Support TDB Legacy, TDB2, and FBCH formats
- Extract player data with all 131 attributes
- Handle compressed and uncompressed formats
- Validate file integrity before parsing

#### 1.2 Data Display
- Display players in Handsontable grid
- Show 62 basic fields by default (user-friendly order)
- Toggle to show all 131 fields (export order)
- Decode field headers with readable names
- Position/Team/College/State lookups

#### 1.3 Player Editing
- Edit all player attributes inline
- Dropdown editors for lookup fields (Position, Team, College, State)
- Numeric validation (ratings 0-99, age 18-45)
- Text editing for names and hometown
- PID (Player ID) system for player faces
- Real-time validation with error messages

#### 1.4 File Saving
- Save roster back to Madden format
- Preserve all non-edited data
- Create backup before saving
- Verify file integrity after save
- Test that saved file loads in Madden

### Technical Implementation

#### Dependencies
```json
{
  "madden-franchise": "3.8.0",  // Binary parsing
  "bit-buffer": "^0.2.5",       // Binary operations
  "handsontable": "16.1.1"      // Data grid
}
```

#### File Structure
```
src/main/ipc/
  ├── parser-handlers.ts      // IPC handlers for parsing
  └── file-handlers.ts         // File I/O operations

src/main/parsers/
  └── RosterParser.js          // Roster file parser (adapt from madden-franchise)

src/renderer/js/
  └── app.js                   // Main application (already exists)

src/renderer/data/
  └── field-definitions.js     // Field metadata (already exists)
```

#### Code Attribution
- **madden-franchise by bep713** (MIT License) - Binary parsing approach
- **MyFranchise** - UI patterns and Handsontable integration
- Reference: RESEARCH_FINDINGS.md sections 2.1 and 3.1

### Acceptance Criteria

- [ ] Opens ROSTER-Official test file without errors
- [ ] Displays all 3500+ players in Handsontable grid
- [ ] Shows correct field headers (decoded names)
- [ ] Basic fields (62) visible by default
- [ ] "Show All Fields" toggle reveals all 131 fields
- [ ] Position/Team/College/State dropdowns work
- [ ] PID lookup shows player names
- [ ] Can edit any editable field
- [ ] Validation prevents invalid values (e.g., speed > 99)
- [ ] Save button appears after editing
- [ ] Saves file back to Madden format
- [ ] Backup created before save
- [ ] Saved file loads in Madden 25/26 without errors
- [ ] All Playwright tests pass
- [ ] App packages successfully with electron-forge

### Testing Strategy

#### Automated Tests (Playwright)
- App launches successfully
- File dialog opens
- Roster file loads
- Players display in grid
- Edit player attribute
- Save file
- Re-open and verify edit persisted

#### Manual Tests
- Load roster in Madden game
- Verify player edits show in-game
- Test with multiple roster files
- Stress test with large rosters

### Timeline

**Estimated Duration:** 1 week (40 hours)

**Day 1-2:** Parser implementation
- Install madden-franchise package
- Create RosterParser.js
- Implement IPC handlers
- Test parsing with ROSTER-Official

**Day 3-4:** UI integration
- Connect parser to Handsontable
- Implement field definitions
- Add validation
- Test editing

**Day 5:** Save functionality
- Implement file writing
- Create backup system
- Test round-trip (load → edit → save → reload)

**Day 6:** Testing and polish
- Run Playwright test suite
- Fix any issues
- Test in Madden game
- Optimize performance

**Day 7:** Documentation and commit
- Update ERROR_LOG.md with any issues found
- Update RELEASE_NOTES.md with Phase 1 completion
- Git commit with proper attribution
- Prepare for Phase 2

---

## Phase 2: Roster Creator (Week 2)

**Status:** ⚪ Not Started

### Objective
Build an AI-powered roster generation system that scrapes historical player data from pro-football-reference.com and creates valid Madden roster files.

### Features

#### 2.1 Web Scraping
- Scrape player data from pro-football-reference.com
- Extract player stats by season/year
- Get player biographical data (college, height, weight, age)
- Handle pagination and rate limiting
- Cache scraped data locally

#### 2.2 Data Mapping
- Map real player stats to Madden attributes
- Algorithm: Convert passing yards → throw power/accuracy
- Algorithm: Convert rushing yards → speed/acceleration/carrying
- Position-specific attribute generation
- Era-appropriate rating scales (1994 vs 2024)

#### 2.3 CSV Management
- Export scraped data to CSV
- Import CSV for manual edits
- CSV templates for each position
- Validate CSV format before import
- Merge multiple CSVs

#### 2.4 Roster Generation
- Convert CSV data to Madden roster format
- Assign team IDs and jersey numbers
- Generate Player IDs (PIDs)
- Set salary cap data
- Create complete PLAY table

### Technical Implementation

#### Dependencies
```json
{
  "puppeteer": "^24.22.3",  // Web scraping
  "csv-parser": "^3.0.0",    // CSV parsing
  "csv-writer": "^1.6.0"     // CSV generation
}
```

#### File Structure
```
src/main/scrapers/
  ├── ProFootballReference.js   // PFR scraper
  └── PlayerDataMapper.js        // Stats to Madden attributes

src/renderer/js/
  └── roster-creator.js          // Roster creator UI
```

#### Code Attribution
- Web scraping patterns from community tools
- Mapping algorithms: Custom (documented in code)

### Acceptance Criteria

- [ ] Scrapes player data from pro-football-reference.com
- [ ] Generates CSV with all required fields
- [ ] CSV can be edited manually
- [ ] Imports CSV and creates roster file
- [ ] Generated roster loads in Madden game
- [ ] Player ratings match real-world performance
- [ ] Historical rosters (e.g., 1994) are accurate
- [ ] All automated tests pass

### Timeline

**Estimated Duration:** 1 week

---

## Phase 3: Draft Class Editor (Week 3)

**Status:** ⚪ Not Started

### Objective
Enable editing of Madden draft class files with same functionality as Roster Editor but for draft prospects.

### Features

#### 3.1 Draft Class Parsing
- Parse draft class files (CAREERDRAFT format)
- Extract prospect data
- Handle 7-round draft classes
- Support custom draft class sizes

#### 3.2 Prospect Editing
- Edit prospect attributes and ratings
- Set draft positions and teams
- Modify college and biographical data
- Assign PIDs for prospect faces
- Set draft grade and potential

#### 3.3 Draft Class Saving
- Save back to draft class format
- Preserve draft order
- Backup before save
- Verify loads in franchise mode

### Technical Implementation

Extend RosterParser to handle draft class format. Similar architecture to Phase 1.

### Acceptance Criteria

- [ ] Opens draft class files
- [ ] Displays all prospects
- [ ] Edit prospect attributes
- [ ] Save draft class
- [ ] Loads in franchise mode
- [ ] Draft order preserved
- [ ] All tests pass

### Timeline

**Estimated Duration:** 1 week

---

## Phase 4: Draft Class Creator (Week 4)

**Status:** ⚪ Not Started

### Objective
AI-powered generation of historical draft classes from real NFL draft data.

### Features

#### 4.1 Historical Draft Data
- Scrape NFL draft history
- Get prospect scouting reports
- Extract college stats
- Map to Madden attributes

#### 4.2 Prospect Generation
- Generate realistic prospect distributions
- Position-specific attribute curves
- Bust/star probability based on history
- Era-appropriate prospects (1994 vs 2024)

#### 4.3 Draft Class Export
- Create draft class file from generated data
- Support multiple years/eras
- Balance draft class quality
- Assign realistic combine measurables

### Acceptance Criteria

- [ ] Generates historical draft classes
- [ ] Accurate to real NFL drafts
- [ ] Balanced prospect distributions
- [ ] Loads and works in franchise mode
- [ ] Multiple eras supported

### Timeline

**Estimated Duration:** 1 week

---

## Phase 5: Franchise Editor (Week 5-6)

**Status:** ⚪ Not Started

### Objective
Full franchise save file editor with team management, league settings, and season progression.

### Features

#### 5.1 Franchise Parsing
- Parse franchise save files (CAREER format)
- Extract all tables (teams, players, coaches, schedules, stats)
- Handle relationships between tables
- Support all franchise file versions

#### 5.2 Team Management
- Edit team rosters
- Modify team finances (salary cap)
- Change team settings
- Manage coaching staff
- Edit team history/records

#### 5.3 League Settings
- Modify league rules
- Change sliders and difficulty
- Set season length
- Configure playoffs
- Edit weather settings

#### 5.4 Season Progression
- Advance/rewind weeks
- Edit game results
- Modify player stats
- Manage injuries
- Control draft order

### Technical Implementation

**Reference:** MyFranchise implementation (see RESEARCH_FINDINGS.md section 3.1)

Complex multi-table editing with data relationships. Requires careful transaction management to prevent corruption.

### Acceptance Criteria

- [ ] Opens franchise save files
- [ ] All tables editable
- [ ] Relationships preserved
- [ ] Season progression works
- [ ] Saves load in franchise mode
- [ ] No data corruption
- [ ] All tests pass

### Timeline

**Estimated Duration:** 2 weeks (complex feature)

---

## Phase 6: Coach Editor (Week 7)

**Status:** ⚪ Not Started

### Objective
Edit coach attributes, histories, and photos.

### Features

#### 6.1 Coach Data
- Edit coach ratings and attributes
- Modify coaching history
- Change team assignments
- Set coaching abilities/tendencies

#### 6.2 Coach Photos
- Import/export coach photos
- PID system for coach faces
- Batch photo processing
- Format conversion (PNG/JPG)

#### 6.3 Historical Records
- Edit win/loss records
- Modify playoff history
- Set coaching achievements
- Historical team assignments

### Acceptance Criteria

- [ ] Edit all coach attributes
- [ ] Photo import/export works
- [ ] History editing functional
- [ ] Changes load in-game
- [ ] Tests pass

### Timeline

**Estimated Duration:** 1 week

---

## Phase 7: Retro Mods Suite (Week 8-10)

**Status:** ⚪ Not Started

### Objective
Comprehensive retro modding tools for uniforms, fields, stats, and visual customization.

### Features (7 Sub-Tools)

#### 7.1 Uniform Editor
- DDS texture import/export
- 3D uniform preview (Three.js)
- Color picker with team palettes
- Historical uniform templates
- Batch uniform generation

**Technical:** Three.js for 3D preview, DDS parser for textures

#### 7.2 History Editor
- Set franchise start year
- Load historical rosters
- Era-appropriate rules
- Historical schedules
- Period-accurate salary caps

#### 7.3 Stats Editor
- Edit career statistics
- Season-by-season stats
- Historical stat accuracy
- Import stats from web

#### 7.4 PIC Editor
- Player photo management
- Batch photo processing
- Face ID assignment
- Image format conversion

#### 7.5 Expansion Draft
- Custom expansion rules
- Team creation
- Player protection
- Draft simulation

#### 7.6 Field Editor
- Stadium customization
- Field textures and logos
- Era-appropriate designs
- End zone customization

#### 7.7 Splash Screen / Scorebug / Equipment Editors
- Loading screen customization
- On-screen graphics (scorebugs)
- Equipment editor (helmets, era-appropriate gear)

### Technical Implementation

**Reference:** 1994 Mod V2 tools (see RESEARCH_FINDINGS.md section 3.2)

Each sub-tool is a separate module with shared UI framework.

### Acceptance Criteria

- [ ] All 7 sub-tools functional
- [ ] DDS texture handling works
- [ ] 3D previews render correctly
- [ ] Historical data accurate
- [ ] Changes load in-game
- [ ] Tests pass for each tool

### Timeline

**Estimated Duration:** 3 weeks (7 tools, some complex)

**Week 8:** Uniform, History, Stats editors
**Week 9:** PIC, Expansion Draft editors
**Week 10:** Field, Splash/Scorebug/Equipment editors

---

## Phase 8: Toolkit (Week 11)

**Status:** ⚪ Not Started

### Objective
Utility tools for commentary, export, and weather control.

### Features (3 Utilities)

#### 8.1 Commentary ID Editor
- Player name to commentary mapping
- Bulk assignment
- Audio file validation
- Name pronunciation guide

**Reference:** presentationIdFixV3.0.exe (see RESEARCH_FINDINGS.md)

#### 8.2 Export Tool
- Franchise to roster conversion
- Team extraction
- Data preservation during export
- Batch export

**Reference:** franchiseToRosterV0.3.exe (see RESEARCH_FINDINGS.md)

#### 8.3 Weather Controls
- Stadium weather patterns
- Historical weather data
- Custom scenarios
- Seasonal adjustments

**Reference:** transferRetroSchedule.exe (see RESEARCH_FINDINGS.md)

### Acceptance Criteria

- [ ] Commentary IDs assignable
- [ ] Franchise exports to roster
- [ ] Weather controls functional
- [ ] All utilities tested
- [ ] Tests pass

### Timeline

**Estimated Duration:** 1 week

---

## Success Metrics

### Phase 1 (Roster Editor)
- ✅ Opens roster files
- ✅ Edits players
- ✅ Saves and reloads in-game
- ✅ All tests pass

### Overall Project
- 8 phases completed
- 17+ tools functional
- All Playwright tests passing (>95% pass rate)
- App packages for distribution
- Community adoption (GitHub stars, downloads)
- Positive user feedback

---

## Risk Management

### Technical Risks

**Risk:** Binary file format changes in new Madden versions
**Mitigation:** Use madden-franchise package (actively maintained), versioned parsers

**Risk:** Performance issues with large datasets
**Mitigation:** Handsontable virtualization, lazy loading, pagination

**Risk:** File corruption during save
**Mitigation:** Mandatory backups, transaction-based saves, integrity validation

### Project Risks

**Risk:** Scope creep (adding features mid-phase)
**Mitigation:** Strict phase definitions, approval required for changes

**Risk:** Time overruns
**Mitigation:** Weekly milestones, buffer weeks, MVP first approach

**Risk:** AI workflow violations
**Mitigation:** CLAUDE.md enforcement, WORKFLOW.md checkpoints, user oversight

---

## Development Workflow (Per Phase)

```
Week N: Phase X
├── Day 1-2: Research and Planning
│   ├── Review RESEARCH_FINDINGS.md
│   ├── Study reference implementations
│   ├── Create detailed technical spec
│   └── User approval
├── Day 3-5: Implementation
│   ├── Write code (following WORKFLOW.md)
│   ├── Testing agent runs Playwright tests
│   ├── Fix issues
│   └── User testing
├── Day 6: Integration and Optimization
│   ├── Packaging agent verifies build
│   ├── Optimizer agent checks code
│   ├── Performance testing
│   └── Fix any issues
└── Day 7: Documentation and Commit
    ├── Update ERROR_LOG.md
    ├── Update RELEASE_NOTES.md
    ├── Git commit (user approval)
    └── Prepare next phase
```

---

## Post-Launch (Beyond Week 11)

### Version 1.1
- Bug fixes from user feedback
- Performance optimizations
- Additional test coverage

### Version 1.2
- Plugin system for community tools
- Cloud sync (optional)
- Online roster sharing

### Version 2.0
- Multi-language support
- Mobile companion app
- Advanced AI features (auto-rating generation)

---

## Resources

### Documentation
- **CLAUDE.md** - Rules and tech stack
- **WORKFLOW.md** - Development workflow
- **RESEARCH_FINDINGS.md** - All reference implementations
- **ERROR_LOG.md** - Known issues and solutions
- **RELEASE_NOTES.md** - Version history

### Reference Implementations
- **madden-franchise** (npm package) - Primary parser
- **MyFranchise** (local tool) - UI patterns
- **1994 Mod V2** (local tools) - Retro modding examples

### Test Files
- **ROSTER-Official** (6.1 MB) - Test roster
- **CAREER-AUG07-02h00m07p-AUTOSAVE** (5.5 MB) - Test franchise
- **CAREERDRAFT-2026DRAFT7RND** (1.9 MB) - Test draft class

Location: `C:/Users/tshan/OneDrive/Documents/Madden Files/KNuttZFranchiseSandBox/Madden Files/`

---

## Credits and Attribution

### Phase 1-8 Code Attribution

**Primary References:**
- **madden-franchise** by bep713 (MIT License) - Binary parsing
- **MyFranchise** by bep713 - UI architecture
- **1994 Mod V2** tools - Retro modding patterns

**Community Resources:**
- kn1meR/MaddenRosterEditor
- ethpec/MaddenTools
- Sinthros/madden-franchise-utils

**Data Sources:**
- pro-football-reference.com - Historical player data
- Madden modding community - Tools and knowledge

---

## Conclusion

This master plan provides a clear roadmap for building the Madden Retro Franchise Editor. Each phase builds on the previous, ensuring a solid foundation. By following the WORKFLOW.md process and using reference implementations from RESEARCH_FINDINGS.md, we can deliver a professional, feature-rich modding tool.

**Next Step:** Begin Phase 1 - Roster Editor

---

*Last Updated: 2025-09-30*
*Version: 1.0 (Initial Plan)*
