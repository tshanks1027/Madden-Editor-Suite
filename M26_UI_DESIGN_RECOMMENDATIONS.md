# Madden 26 Editor Suite - UI Design Recommendations

**Based on**:
- M26 franchise file structure analysis (3,324 total tables, 1,189 with data)
- MyFranchise UI patterns and best practices
- Modern desktop application UX principles

**Date**: October 16, 2025
**Target**: Madden 26 (Schema 660.1)

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Navigation Hierarchy](#navigation-hierarchy)
- [Phase 1: Foundation (MVP)](#phase-1-foundation-mvp)
- [Phase 2: Enhanced Features](#phase-2-enhanced-features)
- [Phase 3: Advanced Tools](#phase-3-advanced-tools)
- [Table Categorization](#table-categorization)
- [UI Layout Recommendations](#ui-layout-recommendations)
- [Feature Prioritization](#feature-prioritization)

---

## Executive Summary

### The Challenge
- **3,324 total tables** in M26 schema
- **1,189 tables** contain actual data in a typical franchise file
- **334 attributes** in Player table alone
- Complex relationships between tables
- Users range from casual editors to power users

### The Solution
**Three-Tier UI Approach**:

1. **Tier 1: Guided Entity Editors** (80% of users)
   - High-level interfaces for common tasks
   - Player editor, Team editor, Season management
   - Hide complexity, focus on outcomes

2. **Tier 2: Categorized Table Browser** (15% of users)
   - Organized access to all tables
   - Grouped by domain (Player, Team, Draft, etc.)
   - Power user features with safety rails

3. **Tier 3: Raw Table Access** (5% of users)
   - Direct table editing with Handsontable
   - Full schema visibility
   - For developers and advanced modders

---

## Navigation Hierarchy

### Top-Level Navigation (Tabs)

```
┌──────────────────────────────────────────────────────────────┐
│ [Home] [Players] [Teams] [Season] [Draft] [Tables] [Tools]  │
└──────────────────────────────────────────────────────────────┘
```

#### 1. Home Tab
**Purpose**: Welcome screen and file management

**Content**:
- Open/Save file
- Recent files list
- File info (game year, schema version, save date)
- Quick actions
- Backup management

#### 2. Players Tab
**Purpose**: Entity-centric player management

**Subtabs**:
- **Roster** - All players in grid view (Handsontable)
- **Player Details** - Single player, all attributes in form view
- **Abilities** - X-Factors and abilities management
- **Stats** - Career/season/game stats
- **Contracts** - Salary, years, bonuses

**Key Tables**:
- Player (459 records) - Primary
- GamedayTalent (989 records)
- TalentLoadoutSlot (384 records)
- CareerOffensiveStats (398 records)
- CareerDefensiveStats (536 records)
- SeasonOffensiveStats (389 records)

#### 3. Teams Tab
**Purpose**: Team-centric management

**Subtabs**:
- **Overview** - All 32 teams
- **Team Details** - Single team view with roster
- **Depth Chart** - Visual depth chart editor
- **Team Stats** - Season/career statistics
- **Franchise Settings** - Cap, prestige, revenue

**Key Tables**:
- Team (1 record per franchise - needs expansion)
- TeamStats (320 records)
- TeamNeedEvaluation (905 records)
- TeamRevenueCategoryInfo (576 records)

#### 4. Season Tab
**Purpose**: Season progression and game management

**Subtabs**:
- **Schedule** - Visual calendar with games
- **Standings** - Division/conference standings
- **Games** - Game results and stats
- **Playoffs** - Bracket visualization
- **History** - Past season records

**Key Tables**:
- SeasonInfo (1 record)
- SeasonGame (336 records)
- GameOffensiveStats (428 records)
- GameDefensiveStats (1,444 records)

#### 5. Draft Tab
**Purpose**: Draft class and scouting management

**Subtabs**:
- **Draft Board** - Team draft boards
- **Draft Class** - Incoming players
- **Scouting** - Evaluation and grades
- **Picks** - Draft pick trading
- **History** - Past draft results

**Key Tables**:
- DraftPlayer (670 records)
- DraftBoardPlayerEvaluation (12,864 records)
- DraftPick (1 record - needs expansion)
- Scout (261 records)
- PlayerAcquisitionEvaluation (7,439 records)

#### 6. Tables Tab
**Purpose**: Direct table access for power users

**Layout**:
- **Left Sidebar**: Categorized table tree
  - Expand/collapse categories
  - Search filter
  - "Recently Used" quick list
  - Pin favorite tables
- **Main Area**: Handsontable grid editor
- **Right Sidebar** (optional): Field info and validation

**Categories**: See "Table Categorization" section below

#### 7. Tools Tab
**Purpose**: Utilities and batch operations

**Subtabs**:
- **Batch Edit** - Multi-record updates
- **Import/Export** - CSV, JSON data exchange
- **Schema Viewer** - Inspect table structures
- **Validation** - Check file integrity
- **Backups** - Manage file versions

---

## Phase 1: Foundation (MVP)

**Goal**: Working editor with core functionality
**Timeline**: 3-4 weeks

### Must-Have Features

1. **File Management**
   - Open M26 franchise files
   - Save with validation
   - Auto-backup before save
   - Recent files list

2. **Tables Tab (Power User Mode)**
   - Categorized table browser (left sidebar)
   - Handsontable grid editor
   - Basic field types supported:
     - int, uint, bool, string
     - Basic reference display (table:row)
   - Search within table
   - Sort by column

3. **Player Roster View**
   - Grid view of all players (Player table)
   - Display key fields:
     - Name (FirstName + LastName)
     - Position
     - Overall rating
     - Team
     - Age
     - Contract info
   - Sort and filter
   - Edit inline (basic fields only)

4. **Navigation**
   - Tab system (Home, Players, Tables)
   - Multiple table tabs in Tables view
   - Tab state persistence

5. **Safety Features**
   - File validation before save
   - "Are you sure?" prompts
   - Error handling with user-friendly messages

### Deferred for Phase 2
- Team view
- Season management
- Draft tools
- Advanced reference editing
- Blob editing
- Abilities editor
- Batch operations

### Phase 1 Table Priority

**Must Support (with full editing)**:
1. Player (459 records, 334 attributes)
2. Team (expand to 32 records)
3. SeasonInfo (1 record)
4. Coach (117 records)
5. Owner (10 records)

**Read-Only OK**:
- All stats tables
- Game tables
- Draft tables

### Phase 1 UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│ [Home] [Players] [Tables]                    [Save] [Help] │
├─────────────────────────────────────────────────────────────┤
│ Tables │                                                     │
│        │ Players Roster                                      │
│ ► Core │                                                     │
│   Players [455 records]          ┌──────┬──────────────────┐│
│   Teams   Search: [________]     │ Name │ Pos │ Ovr │ Team ││
│   Coaches                         ├──────┼──────────────────┤│
│   Owners                          │ ... (Handsontable)    ││
│                                   │                        ││
│ ► Stats                           │                        ││
│   CareerOffensiveStats           └────────────────────────┘│
│   CareerDefensiveStats                                      │
│   SeasonOffensiveStats            [Sort] [Filter] [Export] │
│   ...                                                       │
│                                                             │
│ ► Draft                                                     │
│   DraftPlayer                                               │
│   ...                                                       │
│                                                             │
│ ► Recently Used                                             │
│   ⭐ Player                                                 │
│   ⭐ Team                                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 2: Enhanced Features

**Goal**: Guided entity editors and workflows
**Timeline**: 4-6 weeks after Phase 1

### New Features

1. **Player Details View** (Entity-centric)
   - Single-player form view
   - Tabs for different attribute groups:
     - Basic Info (name, age, position, team)
     - Ratings (all skill ratings)
     - Physical (height, weight, speed, etc.)
     - Traits (personality traits, play style)
     - Contract (salary, years, bonuses)
     - Stats (career/season stats)
     - History (transactions, awards)
   - Navigation: Next/Previous player buttons
   - Quick search to jump to player

2. **Team Management**
   - Team overview (all 32 teams)
   - Team details view:
     - Roster with sort/filter
     - Depth chart editor (visual drag-drop)
     - Team stats
     - Cap space management
   - Bulk operations (move players, adjust cap)

3. **Season Management**
   - Schedule editor (visual calendar)
   - Standings view
   - Game results
   - Week advancement tools

4. **Enhanced Table Editor**
   - Reference editing modal (like MyFranchise)
   - Enum dropdowns
   - Validation warnings
   - Undo/redo (per table)
   - Column visibility toggle
   - Freeze columns

5. **Import/Export**
   - Export table to CSV
   - Import CSV with validation
   - Export player/team as JSON
   - Batch import from external sources

### Phase 2 Table Priority

**Add Full Support**:
6. SeasonGame (336 records)
7. DraftPlayer (670 records)
8. Injury (11 records)
9. Scout (261 records)
10. GamedayTalent (989 records)

---

## Phase 3: Advanced Tools

**Goal**: Professional-grade features
**Timeline**: Ongoing after Phase 2

### New Features

1. **Draft Tools**
   - Draft class editor
   - Scouting interface
   - Draft board management
   - Mock draft simulator

2. **Batch Operations**
   - Multi-select players
   - Bulk attribute updates
   - Formula editor (e.g., "Add 5 to all QB Throw Power")
   - Copy/paste between files

3. **Data Visualization**
   - Player rating charts
   - Team stats graphs
   - Season progression timelines
   - Draft pick value charts

4. **Advanced Schema Tools**
   - Schema version switcher
   - Schema comparison (M25 vs M26)
   - Schema documentation generator
   - Custom schema overlays

5. **Modding Tools**
   - Texture/portrait editor
   - Audio file replacement
   - Playbook editor integration
   - Uniform/stadium editor

6. **Automation**
   - Script editor (JavaScript/Python)
   - Macro recording
   - Scheduled tasks
   - API for external tools

---

## Table Categorization

**Based on M26 franchise file analysis**

### Core Entities (7 categories, ~200 tables)

#### 1. Player (73 tables)
**Primary Table**: Player (459 records, 334 attributes)

**Key Supporting Tables**:
- GamedayTalent (989 records) - Active abilities
- TalentTier (7,348 records) - Ability progression
- TalentLoadoutSlot (384 records) - Equipped abilities
- CareerOffensiveStats (398 records)
- CareerDefensiveStats (536 records)
- SeasonOffensiveStats (389 records)
- PlayerAward (52 records)
- PlayerTransactionHistoryEntry (228 records)
- PlayerStatRecord (297 records)

**Attributes to Highlight**:
- Ratings (50+ attributes): AccelerationRating, SpeedRating, AwarenessRating, etc.
- Physical: Age, Height, Weight, CharacterBodyType
- Contract: ContractSalary0-7, ContractBonus0-7, ContractLength, ContractStatus
- Traits: PT_AGGRESSIVE, PT_CANNON, PT_SCRAMBLER, etc. (60+ boolean traits)
- Wear & Tear: WearAndTear_LKnee, WearAndTear_Back, etc. (injury system)
- Position: Position, IronManPosition
- Development: DevelopmentTrait, ConfidenceRating

#### 2. Team (63 tables)
**Primary Table**: Team (1 record currently - should be 32)

**Key Supporting Tables**:
- TeamStats (320 records)
- TeamNeedEvaluation (905 records) - Draft needs
- TeamRevenueCategoryInfo (576 records) - Finances
- DepthChart-related tables
- TeamHistory, TeamStanding

#### 3. Staff (50 tables)
**Primary Tables**:
- Coach (117 records, 121 attributes)
- Owner (10 records, 85 attributes)
- Scout (261 records)

**Key Fields (Coach)**:
- Ratings: Chemistry, OffensiveSchemeRating, DefensiveSchemeRating
- Contract: ContractSalary, ContractYearsLeft
- Personality: CoachMotivation, CoachMorale

#### 4. Season (77 tables)
**Primary Tables**:
- SeasonInfo (1 record, 46 attributes) - Current season state
- SeasonGame (336 records, 68 attributes) - All games
- WeekExperience - weekly tracking

**Key Supporting Tables**:
- GameOffensiveStats (428 records)
- GameDefensiveStats (1,444 records)
- GameOLineStats (401 records)
- UnpublishedGameStats (1,535 records)
- TrackedPlay (226 records)

**SeasonInfo Key Fields**:
- CurrentWeekType (preseason, regular, playoffs)
- CurrentSeasonYear
- CurrentStage (week number, etc.)

#### 5. Draft (74 tables)
**Primary Tables**:
- DraftPlayer (670 records, 28 attributes) - Incoming draft class
- DraftPick (1 record - needs expansion to 256 picks)
- Scout (261 records)

**Key Supporting Tables**:
- DraftBoardPlayerEvaluation (12,864 records) - Scouting reports
- PlayerAcquisitionEvaluation (7,439 records) - Team interest
- DraftClassScouting tables

**DraftPlayer Key Fields**:
- PlayerName, CollegeName, Position
- OverallRating, ProjectedRound
- DraftPickScenario (when selected)

#### 6. Contract & Salary (15 tables)
**Primary Tables**:
- PlayerContract (0 records - integrated into Player table)
- SalaryInfo
- ContractOffer (1,050 capacity)

**Key Functions**:
- Salary cap management
- Contract negotiations
- Free agency

#### 7. Injury & Health (15 tables)
**Primary Table**: Injury (11 records, 6 attributes)

**Key Supporting Tables**:
- Injury_AttributeModifier (364 records) - How injuries affect ratings
- WearAndTear tables
- HealthStatus tracking

### Supporting Systems (9 categories, ~400 tables)

#### 8. Statistics (2 tables + many related)
- Career stats (offensive, defensive, O-line, special teams)
- Season stats
- Game stats
- Snapshots and records

#### 9. Media & Storylines (88 tables)
- News articles
- Social media
- Career moments
- Story progression

#### 10. Awards (6 tables)
- MVP, OPOY, DPOY
- Pro Bowl
- All-Pro teams
- Hall of Fame

#### 11. League Settings (11 tables)
- Conference/Division structure
- League rules
- Difficulty settings
- Franchise settings

#### 12. Stadium (9 tables)
- Stadium properties
- Weather
- Attendance
- Home field advantage

#### 13. Trade (29 tables)
- Trade proposals
- Trade logic
- Trade history
- Trade blocks

#### 14. Presentation (14 tables)
- UI settings
- Commentary
- Broadcast settings
- Visual presentation

#### 15. System/Meta (8 tables)
- Schema information
- Version tracking
- Metadata
- Internal references

#### 16. Other (766 tables)
- Event systems
- Tuning data
- AI logic
- Gameplay modifiers
- Formulas and calculations
- Internal state machines

### Tables with Most Data (Top 30)

Based on actual M26 save file analysis:

| Rank | Table Name | Records | Category |
|------|------------|---------|----------|
| 1 | PlaycallHistoryConceptDetails | 19,752 | Gameplay |
| 2 | DraftBoardPlayerEvaluation | 12,864 | Draft |
| 3 | PlayerAcquisitionEvaluation | 7,439 | Draft |
| 4 | TalentTier | 7,348 | Player |
| 5 | CharacterVisuals | 3,026 | Player |
| 6 | ReceiveRushStatSnapShot | 1,728 | Stats |
| 7 | UnpublishedGameStats | 1,535 | Stats |
| 8 | GameDefensiveStats | 1,444 | Stats |
| 9 | GamedayTalent | 989 | Player |
| 10 | TeamNeedEvaluation | 905 | Team |
| 11 | DraftPlayer | 670 | Draft |
| 12 | TeamRevenueCategoryInfo | 576 | Team |
| 13 | PlaycallHistoryAiGroupDetails | 564 | Gameplay |
| 14 | CareerDefensiveStats | 536 | Stats |
| 15 | Player | 459 | Player |
| 16 | GameOffensiveStats | 428 | Stats |
| 17 | GameOLineStats | 401 | Stats |
| 18 | CareerOffensiveStats | 398 | Stats |
| 19 | SeasonOffensiveStats | 389 | Stats |
| 20 | TalentLoadoutSlot | 384 | Player |

---

## UI Layout Recommendations

### Left Sidebar: Table Browser

```
┌──────────────────┐
│ Tables           │
├──────────────────┤
│ [Search...]      │
├──────────────────┤
│ ⭐ Pinned        │
│   Player         │
│   Team           │
│   Coach          │
├──────────────────┤
│ 🕐 Recent        │
│   DraftPlayer    │
│   SeasonInfo     │
├──────────────────┤
│ ► Core (180)     │
│   ► Player (73)  │
│   ► Team (63)    │
│   ► Staff (50)   │
│   ► Season (77)  │
│   ► Draft (74)   │
│   ► Contract (15)│
│   ► Injury (15)  │
│ ► Stats (200)    │
│ ► Draft (74)     │
│ ► Media (88)     │
│ ► System (800+)  │
└──────────────────┘
```

**Features**:
- Collapsible categories
- Badge with record count
- Search filters by: name, category, record count
- Drag tables to "Pinned" section
- Right-click context menu: Pin, Export, View Schema

### Main Area: Adaptive Content

**Grid View** (for tables):
- Handsontable with all features
- Frozen header row
- Freeze first column (usually name/ID)
- Column groups for related fields
- Column visibility toggle
- Search/filter bar above grid

**Form View** (for entities):
- Organized into sections/tabs
- Labels + values
- Edit in place
- Related entities linked

**Workflow View** (for tasks):
- Step-by-step wizards
- Progress indicators
- Validation at each step

### Right Sidebar: Context Panel

**Contextual information based on selection**:

- **Field Selected**:
  - Field name
  - Data type
  - Min/max values
  - Enum options
  - Reference target table
  - Description/help text

- **Row Selected**:
  - Record summary
  - Related records in other tables
  - History/changes
  - Quick actions

- **Table Selected**:
  - Table metadata
  - Record count
  - Field count
  - Last modified
  - Quick export button

### Bottom Bar: Status & Actions

```
┌──────────────────────────────────────────────────────────────┐
│ ✓ File saved  │  Player: 459/3960 records  │  [Save] [Undo] │
└──────────────────────────────────────────────────────────────┘
```

---

## Feature Prioritization

### High Priority (MVP)

1. **File I/O**
   - Open/Save M26 files ✓
   - Backup management ✓
   - Recent files ✓

2. **Table Editing**
   - Handsontable integration ✓
   - Basic field types (int, string, bool) ✓
   - Sort/filter ✓

3. **Player Roster View**
   - Grid with key fields ✓
   - Inline editing ✓

4. **Navigation**
   - Tab system ✓
   - Table categories ✓

### Medium Priority (Phase 2)

5. **Entity Editors**
   - Player details form
   - Team management
   - Coach/Owner editors

6. **Season Management**
   - Schedule editor
   - Standings
   - Game results

7. **Enhanced Table Features**
   - Reference editing
   - Enum dropdowns
   - Validation
   - Undo/redo

8. **Import/Export**
   - CSV support
   - JSON support

### Low Priority (Phase 3)

9. **Draft Tools**
   - Draft class editor
   - Scouting interface

10. **Batch Operations**
    - Multi-select
    - Formula editor

11. **Visualizations**
    - Charts
    - Graphs

12. **Automation**
    - Scripting
    - Macros

---

## Summary

### Recommended Approach

**Phase 1: Foundation (NOW)**
- Focus on Tables tab with categorized browser
- Support top 10 most important tables (Player, Team, Coach, Season, Draft, Stats)
- Use Handsontable for proven grid editing
- Implement safety features (backup, validation)

**Phase 2: Convenience (NEXT)**
- Add entity-centric views (Player Details, Team Management)
- Season/Schedule management
- Enhanced table editing (references, enums, undo)

**Phase 3: Advanced (FUTURE)**
- Draft tools and scouting
- Batch operations and automation
- Data visualization
- Modding tools

### Key Success Factors

1. **Progressive Disclosure**
   - Simple for beginners, powerful for experts
   - Don't overwhelm users with all 3,324 tables at once

2. **Safety First**
   - Always backup before save
   - Validate changes
   - Clear error messages
   - Undo/redo

3. **Performance**
   - Lazy-load tables (don't load all 1,189 into memory)
   - Virtual scrolling for large grids
   - Debounced search

4. **Maintainability**
   - Service-based architecture
   - Reusable components
   - Clear separation of concerns

5. **Extensibility**
   - Plugin system for future features
   - API for external tools
   - Schema-driven UI (adapt to M27, M28 automatically)

---

## Next Steps

1. **Review this document** with stakeholders
2. **Create UI mockups** for Phase 1 screens
3. **Set up development environment** (already done)
4. **Implement Phase 1 MVP** (3-4 weeks)
5. **User testing** with target users
6. **Iterate and refine** based on feedback
7. **Begin Phase 2** development

---

**Document Version**: 1.0
**Last Updated**: October 16, 2025
**Author**: Claude Code Analysis
**Based On**: M26 CAREER-AUG07-02h00m07p-AUTOSAVE franchise file
