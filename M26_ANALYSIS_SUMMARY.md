# Madden 26 Franchise Analysis - Executive Summary

**Analysis Date**: October 16, 2025
**Franchise File**: CAREER-AUG07-02h00m07p-AUTOSAVE
**Game Version**: Madden 26
**Schema Version**: 660.1

---

## Quick Reference

| Document | Purpose | Location |
|----------|---------|----------|
| **This File** | Executive summary and quick reference | M26_ANALYSIS_SUMMARY.md |
| **M26_FRANCHISE_STRUCTURE.json** | Complete data structure (380KB) | M26_FRANCHISE_STRUCTURE.json |
| **M26_FRANCHISE_STRUCTURE.md** | Human-readable structure (303KB) | M26_FRANCHISE_STRUCTURE.md |
| **M26_KEY_TABLES.json** | Key tables with full field definitions | M26_KEY_TABLES.json |
| **M26_KEY_TABLES.md** | Key tables reference guide | M26_KEY_TABLES.md |
| **MYFRANCHISE_UI_ANALYSIS.md** | MyFranchise UI pattern study | MYFRANCHISE_UI_ANALYSIS.md |
| **M26_UI_DESIGN_RECOMMENDATIONS.md** | Comprehensive UI design guide | M26_UI_DESIGN_RECOMMENDATIONS.md |

---

## Key Findings

### Scale of Data

```
Total Tables in Schema:     3,324
Tables with Actual Data:    1,189  (35.8%)
Largest Table (Player):     459 records, 334 attributes
Most Records Table:         PlaycallHistoryConceptDetails (19,752 records)
Total Data Categories:      16 main categories
```

### Top 5 Most Important Tables

1. **Player** (459 records, 334 attributes)
   - Core entity for all player data
   - Includes ratings, traits, contract, physical attributes
   - Integrated with 70+ related tables

2. **Team** (1 record currently, should be 32)
   - Team properties and settings
   - Linked to 60+ supporting tables
   - Note: Current save shows only 1 record (likely incomplete data)

3. **SeasonInfo** (1 record, 46 attributes)
   - Current season state
   - Week number, season year
   - Critical for season progression

4. **DraftPlayer** (670 records, 28 attributes)
   - Incoming draft class
   - Scouting data
   - Draft board integration

5. **Coach** (117 records, 121 attributes)
   - Coaching staff data
   - Schemes and ratings
   - Contract information

### Data Distribution

**Top 10 Tables by Record Count**:
| Rank | Table | Records | Category |
|------|-------|---------|----------|
| 1 | PlaycallHistoryConceptDetails | 19,752 | Gameplay |
| 2 | DraftBoardPlayerEvaluation | 12,864 | Draft |
| 3 | PlayerAcquisitionEvaluation | 7,439 | Draft |
| 4 | TalentTier | 7,348 | Player Abilities |
| 5 | CharacterVisuals | 3,026 | Player Appearance |
| 6 | ReceiveRushStatSnapShot | 1,728 | Statistics |
| 7 | UnpublishedGameStats | 1,535 | Statistics |
| 8 | GameDefensiveStats | 1,444 | Statistics |
| 9 | GamedayTalent | 989 | Player Abilities |
| 10 | TeamNeedEvaluation | 905 | Team Management |

---

## Table Categories (16 Main Groups)

1. **Player** (73 tables) - Player data, attributes, abilities
2. **Team** (63 tables) - Team properties, stats, management
3. **Staff** (50 tables) - Coaches, scouts, owners
4. **Season** (77 tables) - Games, schedule, progression
5. **Draft** (74 tables) - Draft class, scouting, picks
6. **Contract** (15 tables) - Salary cap, negotiations, contracts
7. **Injury** (15 tables) - Health, wear & tear, injury effects
8. **Statistics** (200+ tables) - Career, season, game stats
9. **Media** (88 tables) - News, stories, social media
10. **Awards** (6 tables) - MVP, Pro Bowl, All-Pro
11. **League** (11 tables) - League settings, rules
12. **Stadium** (9 tables) - Venue properties, weather
13. **Trade** (29 tables) - Trade logic, proposals, history
14. **Presentation** (14 tables) - UI, commentary, broadcast
15. **Settings** (1 table) - User preferences
16. **System** (8 tables) - Schema, metadata, internal

**Other/Internal**: 766 tables (formulas, events, tuning data, AI logic)

---

## Player Table Deep Dive

### Overview
- **334 total attributes**
- **459 active records** in test file
- **Capacity**: 3,960 records

### Attribute Breakdown

**Ratings** (50+ attributes):
- Core: SpeedRating, AccelerationRating, AgilityRating, StrengthRating
- Position-specific: ThrowPowerRating, CatchingRating, TackleRating, etc.
- Range: 0-127 for most ratings

**Physical Attributes**:
- Age (0-63)
- Height, Weight
- CharacterBodyType (enum)
- CharacterVisuals (reference to appearance table)

**Contract** (16 attributes):
- ContractSalary0-7 (8 years)
- ContractBonus0-7 (8 years)
- ContractLength, ContractStatus, ContractYear
- Range: 0-16,383 (represents dollars in thousands)

**Traits** (60+ boolean flags):
- Personality: PT_AGGRESSIVE, PT_CONSERVATIVE, PT_RISKTAKER
- Play Style: PT_SCRAMBLER, PT_POCKETPASSER, PT_PLAYBALL
- Special: PT_CANNON, PT_BIGHITTER, PT_COVERBALL
- Each trait is a boolean (true/false)

**Wear & Tear** (20 attributes):
- Body parts: WearAndTear_LKnee, WearAndTear_RShoulder, WearAndTear_Back
- Range: 0-10 (injury risk level)
- Critical for injury system

**Development**:
- DevelopmentTrait (enum: Normal, Star, Superstar, X-Factor)
- ConfidenceRating (0-127)
- SeasonHealthPool (0-1000)

**References to Other Tables**:
- CharacterGameplay
- CharacterVisuals
- College
- CareerStats (embedded structure, not separate table)
- Team (via TeamIndex reference)

---

## MyFranchise UI Insights

### What They Do Well

1. **Browser-Style Tabs**
   - Multiple tables open simultaneously
   - Tab state persistence (remembers row/column)
   - Familiar interaction model

2. **Table Pinning**
   - Quick access to Player, Team, Coach
   - User-configurable favorites
   - Reduces clicks for common tables

3. **Reference Handling**
   - Special modal for editing references
   - Shows relationship between tables
   - "Show References" feature (reverse lookup)

4. **Handsontable Integration**
   - Excel-like grid interface
   - Handles large datasets well
   - Built-in sort, copy/paste, etc.

### What Could Be Better

1. **Table Discovery**
   - Current: Flat dropdown of 3,000+ tables
   - Needed: Categorized, searchable, with filters

2. **User Guidance**
   - Current: Must know table names and structure
   - Needed: Wizard-style workflows for common tasks

3. **Entity Views**
   - Current: Table-centric only (see all players in grid)
   - Needed: Player-centric (see one player, all attributes in form)

4. **Validation & Safety**
   - Current: Can corrupt files easily
   - Needed: Pre-save validation, undo/redo, automatic backups

---

## UI Design Recommendations

### Three-Tier Approach

**Tier 1: Guided Entity Editors (80% of users)**
- High-level interfaces: Player Editor, Team Editor
- Hide complexity, focus on tasks
- Example: "Edit Player 42" opens form view with tabs

**Tier 2: Categorized Table Browser (15% of users)**
- Organized table tree (16 categories)
- Handsontable grid editing
- Power user features with safety rails
- Example: Navigate to Player table, edit in grid

**Tier 3: Raw Table Access (5% of users)**
- Full schema visibility
- All 3,324 tables available
- For developers and advanced modders
- Example: Edit internal tuning tables

### Recommended Navigation

```
[Home] [Players] [Teams] [Season] [Draft] [Tables] [Tools]
```

**Home Tab**:
- File management
- Recent files
- Quick actions
- File info

**Players Tab**:
- Roster (grid view)
- Player Details (form view)
- Abilities
- Stats
- Contracts

**Teams Tab**:
- Team Overview (all 32 teams)
- Team Details (single team)
- Depth Chart Editor
- Team Stats

**Season Tab**:
- Schedule (visual calendar)
- Standings
- Games & Results
- History

**Draft Tab**:
- Draft Class
- Scouting
- Draft Boards
- Picks

**Tables Tab**:
- Left sidebar: Categorized tree
- Main area: Handsontable grid
- Right sidebar: Field info
- Search, filter, pin favorites

**Tools Tab**:
- Batch Edit
- Import/Export
- Schema Viewer
- Validation
- Backups

---

## Phase 1 MVP Recommendations

### Timeline: 3-4 Weeks

### Scope

**Must Have**:
1. File management (open/save M26 files)
2. Tables tab with categorized browser
3. Handsontable grid editor
4. Support for basic field types (int, string, bool)
5. Player roster view (grid with key fields)
6. Safety features (backup, validation, error handling)

**Key Tables to Support**:
1. Player (full editing)
2. Team (full editing)
3. Coach (full editing)
4. Owner (full editing)
5. SeasonInfo (full editing)
6. Stats tables (read-only OK)

**Defer to Phase 2**:
- Entity-centric views (Player Details form)
- Season management tools
- Draft editor
- Reference editing modal
- Abilities editor
- Batch operations

### Technical Approach

**Already Have**:
- Electron app structure ✓
- Handsontable installed ✓
- madden-franchise@3.8.0 library ✓
- Vite build system ✓

**Need to Build**:
1. **Table Browser Component**
   - Left sidebar with category tree
   - Search/filter functionality
   - Pin favorites
   - Recently used list

2. **Grid Editor Component**
   - Handsontable wrapper
   - Field type rendering (int, string, bool, enum, reference)
   - Sort/filter controls
   - Save handling

3. **Player Roster View**
   - Pre-configured Player table view
   - Key columns only (Name, Pos, Overall, Team, Age)
   - Quick access from main nav

4. **Safety Layer**
   - Auto-backup before save
   - File validation
   - Error handling with user messages
   - "Are you sure?" prompts

---

## Key Takeaways

### Data Complexity

- **3,324 tables** is overwhelming - must categorize
- **1,189 tables with data** - still too many to show all at once
- **Player table has 334 attributes** - need grouped/tabbed display
- Most users only need 10-20 core tables

### User Needs

- **Beginners** need guided workflows (edit player, manage roster)
- **Intermediate users** need categorized table access with safety
- **Advanced users** need raw table access with no restrictions
- All users need backups and validation

### Development Strategy

- **Phase 1**: Foundation with table browser and basic editing (MVP)
- **Phase 2**: Add entity views and workflows (convenience)
- **Phase 3**: Advanced features (batch ops, visualizations, automation)

### Success Factors

1. **Don't overwhelm users** - progressive disclosure
2. **Make it safe** - backups, validation, undo
3. **Make it fast** - lazy loading, virtual scrolling
4. **Make it flexible** - support beginner to expert workflows
5. **Make it maintainable** - service-based architecture, reusable components

---

## Files Generated

### Analysis Scripts

1. **analyze-franchise-structure.js**
   - Analyzes all 3,324 tables in schema
   - Categorizes by domain
   - Extracts field definitions
   - Generates JSON + Markdown outputs

2. **analyze-key-tables.js**
   - Focused analysis on 23 key tables
   - Full attribute definitions
   - Lists all tables with actual data
   - Identifies top 30 tables by record count

### Output Files

1. **M26_FRANCHISE_STRUCTURE.json** (380KB)
   - Complete structure of all tables
   - Field definitions where available
   - Categorized by domain

2. **M26_FRANCHISE_STRUCTURE.md** (303KB)
   - Human-readable version
   - Tables by category
   - Summary statistics
   - Top tables by field count and record count

3. **M26_KEY_TABLES.json**
   - Detailed structure of 23 key tables
   - Full attribute definitions with types, ranges, references
   - List of 1,189 tables with data

4. **M26_KEY_TABLES.md**
   - Reference guide for key tables
   - Player, Team, Coach, Season, Draft tables
   - Complete attribute listings

### Design Documents

5. **MYFRANCHISE_UI_ANALYSIS.md**
   - UI pattern study
   - Navigation structure
   - What works well
   - What could be improved
   - UI component breakdown

6. **M26_UI_DESIGN_RECOMMENDATIONS.md**
   - Comprehensive UI design guide
   - Three-tier approach
   - Phase-by-phase development plan
   - Table categorization (16 categories)
   - Feature prioritization
   - UI mockups and layouts

7. **M26_ANALYSIS_SUMMARY.md** (This File)
   - Executive summary
   - Quick reference guide
   - Key findings
   - Action items

---

## Next Steps

### For Developer

1. **Review Documents**
   - Read M26_UI_DESIGN_RECOMMENDATIONS.md (main guide)
   - Review M26_KEY_TABLES.md (data reference)
   - Check MYFRANCHISE_UI_ANALYSIS.md (UI patterns)

2. **Plan Phase 1**
   - Create UI mockups for Tables tab
   - Design table browser component
   - Plan Handsontable integration approach

3. **Start Development**
   - Build table browser component (left sidebar)
   - Integrate Handsontable for Player table
   - Add safety layer (backups, validation)
   - Test with M26 franchise file

4. **User Testing**
   - Test with real franchise files
   - Gather feedback on table categorization
   - Validate that key tables are accessible
   - Refine based on user needs

### For Users

1. **Explore Data**
   - Check M26_KEY_TABLES.md for available data
   - See M26_FRANCHISE_STRUCTURE.md for complete table list
   - Review UI_DESIGN_RECOMMENDATIONS.md for planned features

2. **Provide Feedback**
   - Which tables do you use most?
   - What workflows are most important?
   - What features from MyFranchise do you want?
   - What new features would be valuable?

---

## Summary

**What We Learned**:
- M26 franchise files are complex (3,324 tables)
- Most users only need access to core tables (Player, Team, Coach, Season, Draft)
- MyFranchise has good foundation but lacks organization and guidance
- Three-tier UI approach can serve all user levels

**What We're Building**:
- Phase 1: Categorized table browser + basic editing (MVP)
- Phase 2: Entity-centric views + workflows (convenience)
- Phase 3: Advanced tools + automation (power features)

**How to Use This Analysis**:
- Reference M26_KEY_TABLES.md when implementing table editing
- Follow M26_UI_DESIGN_RECOMMENDATIONS.md for UI development
- Use MYFRANCHISE_UI_ANALYSIS.md to understand proven patterns
- Check M26_FRANCHISE_STRUCTURE.json for complete data structure

**Bottom Line**:
We now have a complete understanding of M26 franchise file structure and a clear roadmap for building a user-friendly, powerful editor that serves beginners through experts.

---

**Analysis Complete**: October 16, 2025
**Total Time**: ~2 hours
**Output**: 7 comprehensive documents
**Next**: Begin Phase 1 MVP development
