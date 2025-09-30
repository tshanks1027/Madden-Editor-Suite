# Release Notes

All notable user-facing changes to the Madden Retro Franchise Editor will be documented in this file.

---

## [Unreleased]

### In Development
- Project setup and workflow establishment
- Documentation and planning phase
- Research of existing tools and parsers

---

## Planned Releases

### [0.1.0] - Phase 1: Roster Editor (Target: Week 1)

#### Features
- Parse Madden roster files (PLAY table extraction)
- Display players in Handsontable with decoded headers
- Edit all player attributes with validation
- Save back to Madden format that loads in-game
- Field definitions with proper data types and ranges
- Lookup system for positions, teams, colleges, states
- PID (Player ID) system for player faces

#### Technical
- Integrated madden-franchise@3.8.0 for binary parsing
- Vanilla JavaScript + Handsontable architecture
- Electron 38.1.2 desktop application
- Playwright E2E automated testing
- IPC handlers for file operations

#### Acceptance Criteria
- [ ] Opens any Madden 25/26 roster file
- [ ] All 3500+ players visible and editable
- [ ] Saves preserve all data integrity
- [ ] File loads in Madden game without errors
- [ ] All automated tests pass

---

### [0.2.0] - Phase 2: Roster Creator (Target: Week 2)

#### Features
- AI-powered roster generation from historical data
- Web scraping from pro-football-reference.com
- CSV export/import functionality
- Historical roster accuracy validation
- Auto-population of player attributes based on stats
- Team assignment and cap management

#### Technical
- Puppeteer integration for web scraping
- Data mapping from stats to Madden attributes
- CSV to roster file conversion pipeline

#### Acceptance Criteria
- [ ] Scrapes player data from pro-football-reference
- [ ] Generates valid Madden roster files
- [ ] Historical rosters match real data
- [ ] Rosters load in-game correctly

---

### [0.3.0] - Phase 3: Draft Class Editor (Target: Week 3)

#### Features
- Parse draft class files
- Edit draft prospects
- Modify player ratings and attributes
- Set draft positions and teams
- Save back to Madden format

#### Technical
- Extend RosterParser for draft class format
- Separate UI view for draft prospects
- Draft-specific validation rules

#### Acceptance Criteria
- [ ] Opens draft class files
- [ ] All prospects editable
- [ ] Draft order customizable
- [ ] Files load in franchise mode

---

### [0.4.0] - Phase 4: Draft Class Creator (Target: Week 4)

#### Features
- Generate historical draft classes
- AI-based prospect attribute generation
- Import from historical draft data
- Export to Madden draft class format
- Realistic prospect distributions

#### Technical
- Historical draft class database
- Prospect generation algorithms
- Attribute scaling based on era

#### Acceptance Criteria
- [ ] Creates realistic draft classes
- [ ] Historical accuracy validated
- [ ] Multiple eras supported
- [ ] Balanced prospect distributions

---

### [0.5.0] - Phase 5: Franchise Editor (Target: Week 5-6)

#### Features
- Full franchise file editing
- Team management (roster, coaches, finances)
- League settings and rules
- Season/week progression
- Schedule management
- Stats tracking

#### Technical
- Franchise file format parsing
- Multi-table data management
- Complex data relationships
- Reference: MyFranchise implementation

#### Acceptance Criteria
- [ ] Opens franchise save files
- [ ] All teams editable
- [ ] Settings modifiable
- [ ] Files load in franchise mode
- [ ] No corruption of save data

---

### [0.6.0] - Phase 6: Coach Editor (Target: Week 7)

#### Features
- Edit coach attributes and ratings
- Modify coaching history and records
- Change coach photos (PID system)
- Adjust coach abilities and tendencies
- Team assignment management

#### Technical
- Coach data table parsing
- Photo import/export system
- Historical record tracking

#### Acceptance Criteria
- [ ] All coaches editable
- [ ] Photos changeable
- [ ] History accurate
- [ ] Files load correctly

---

### [0.7.0] - Phase 7: Retro Mods Suite (Target: Week 8-10)

#### Features

**Uniform Editor:**
- Advanced color picker with team palettes
- DDS texture import/export
- 3D uniform preview
- Historical uniform templates

**History Editor:**
- Set franchise start year
- Historical rosters and stats
- Era-appropriate rules
- Historical schedules

**Stats Editor:**
- Modify career statistics
- Season-by-season editing
- Historical stat accuracy
- Import from web sources

**PIC Editor:**
- Player photo management
- Image format conversion (PNG/JPG)
- Face ID assignment
- Batch photo processing

**Expansion Draft:**
- Custom expansion rules
- Team creation
- Player protection
- Draft simulation

**Field Editor:**
- Stadium customization
- Field textures and logos
- Era-appropriate designs
- Lighting and atmosphere

**Splash Screen Editor:**
- Loading screen customization
- Era-specific branding
- Historical presentation packages

**Scorebug Editor:**
- On-screen graphics customization
- Period-accurate designs
- Network packages recreation

**Equipment Editor:**
- Historical helmet designs
- Era-appropriate equipment
- Custom equipment creation

#### Technical
- Three.js for 3D previews
- DDS texture parser
- Image processing pipeline
- Complex data migrations

---

### [0.8.0] - Phase 8: Toolkit (Target: Week 11)

#### Features

**Commentary ID Editor:**
- Player name to commentary mapping
- Bulk assignment
- Audio validation

**Export Tool:**
- Franchise to roster conversion
- Team extraction
- Data preservation

**Weather Controls:**
- Stadium weather patterns
- Historical weather data
- Custom scenarios
- Seasonal adjustments

#### Technical
- Export pipeline development
- Weather system integration
- Audio file handling

---

## Version History

### [0.0.1] - 2025-09-30 - Project Initialization

#### Added
- Project structure and configuration
- Electron + Vite + TypeScript setup
- CLAUDE.md with critical rules and tech stack
- WORKFLOW.md with development process
- ERROR_LOG.md for issue tracking
- RESEARCH_FINDINGS.md with all tool analysis
- Playwright testing framework
- Development documentation

#### Technical
- Established vanilla JS + Handsontable architecture
- Configured Electron Forge for packaging
- Set up ESLint and Prettier
- Created subagent workflow
- Documented all reference implementations

#### Research Completed
- Analyzed 5 GitHub repositories
- Documented MyFranchise implementation
- Cataloged 1994 Mod tools (7 utilities)
- Identified madden-franchise package as primary parser
- Created test file inventory
- Mapped code attribution sources

---

## Credits and Attribution

### Core Technologies
- **Electron 38.1.2** - Desktop application framework
- **Handsontable 16.1.1** - Data grid component (Commercial license required for production)
- **Vite 5** - Build tool
- **Playwright** - E2E testing

### Reference Implementations
- **madden-franchise** by bep713 (MIT License) - Binary parsing
- **MyFranchise** by bep713 - UI patterns and architecture
- **1994 Mod V2** - Retro modding tools reference

### Repositories Referenced
- kn1meR/MaddenRosterEditor
- ethpec/MaddenTools
- Sinthros/madden-franchise-utils
- tshanks1027/MaddenRosterEditor
- bep713/madden-franchise

### Community
- Madden modding community for tools and knowledge
- pro-football-reference.com for historical data

---

## License

**Madden Retro Franchise Editor** - MIT License (for original code)

**Third-Party Licenses:**
- madden-franchise: MIT License
- Handsontable: Commercial license required for production use
- Other dependencies: See package.json

---

## Support

### Getting Help
- Check ERROR_LOG.md for known issues
- Review WORKFLOW.md for development process
- Consult RESEARCH_FINDINGS.md for technical guidance
- See CLAUDE.md for rules and architecture

### Reporting Issues
- Document in ERROR_LOG.md
- Include error messages and steps to reproduce
- Note which phase/feature was being used
- Attach relevant screenshots or console logs

---

## Roadmap

### Short Term (Weeks 1-4)
- Complete Phase 1: Roster Editor
- Complete Phase 2: Roster Creator
- Complete Phase 3: Draft Class Editor
- Complete Phase 4: Draft Class Creator

### Mid Term (Weeks 5-7)
- Complete Phase 5: Franchise Editor
- Complete Phase 6: Coach Editor

### Long Term (Weeks 8-11)
- Complete Phase 7: Retro Mods Suite
- Complete Phase 8: Toolkit

### Future Considerations
- Plugin system for community extensions
- Cloud sync for rosters
- Multi-language support
- Mobile companion app
- Online roster sharing platform

---

*Last Updated: 2025-09-30*
*Version: 0.0.1 (Initial Setup)*
