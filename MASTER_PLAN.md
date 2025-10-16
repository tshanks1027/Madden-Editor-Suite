# Master Plan: Madden Retro Franchise Manager

**Project Goal:** Create an all-in-one retro franchise manager that automates historical NFL/AFL franchise progression from 1920-2024.

**Replaces:** 7 separate manual tools from 1994 Mod V2 with one integrated wizard-style interface.

**Tech Stack:** Vanilla JavaScript + Handsontable + Electron (LOCKED)

---

## Vision

Users can start a franchise in ANY year (1920-2024) and the tool automatically handles:
- Historical team names, relocations, expansions
- Era-appropriate schedules
- Historical coaching staffs
- Draft pick adjustments for non-existent teams
- Expansion drafts with historical rules
- Post-draft cleanup (body types, commentary, FA pool)
- Period-specific logos and branding

**User Philosophy:** Click-to-proceed workflow. No automatic changes without user approval.

---

## Core Features

### 1. Timeline Support (1920-2024)
- **Complete NFL history** including early teams, defunct teams
- **AFL era (1960-1969)** with separate league support
- **AFL-NFL Merger (1970)** with conference realignment
- **All expansion events**: Jaguars (1995), Panthers (1995), Ravens (1996), Texans (2002)
- **All relocations**: Browns→Ravens (1996), Oilers→Titans (1999), etc.
- **Inactive team handling**: Browns (1996-1998), then reactivation (1999)
- **Custom timelines**: User can modify expansion/merger years for "what if" scenarios

### 2. Pre-Season Automation
**Replaces:** handleTeamNames, seasonYearSetup, HandleRetroPicks, transferRetroSchedule tools

```
Pre-Season Checklist:
☐ Update team names for current year
☐ Set season year in franchise
☐ Adjust draft picks (inactive teams to end)
☐ Load historical schedule
☐ Add historical FA coaches

[Run All] or run individually
```

**Draft Pick Adjustment Logic:**
- Move ALL inactive team picks to **END OF ENTIRE DRAFT** (not end of each round)
- Shift active team picks up to fill gaps
- Post-draft: Replace any good players (OVR > 65) drafted by inactive teams with worst FAs (OVR < 55)
- Ensures non-existent teams stay non-competitive

### 3. Expansion Draft System
**Handles historical expansions with accurate rules**

- 1995: Jaguars, Panthers
- 1999: Browns (reactivation as expansion team)
- 2002: Texans

**Features:**
- Protection list manager (teams protect X players)
- Draft simulator (alternating picks between expansion teams)
- Roster application to franchise file
- Historical expansion draft rules by year

**Special case:** 1996 Browns→Ravens
- Transfer entire Browns roster to Ravens
- Deactivate Browns team
- 1999: Reactivate Browns, run expansion draft

### 4. Post-Draft Automation
**Replaces:** bodyTypeFixV1.0, commentaryIdFixV1.2, trimFreeAgents tools

```
Post-Draft Checklist:
☐ Fix body types (300+ lb players)
☐ Fix commentary IDs
☐ Replace inactive team drafted players with worst FAs
☐ Trim FA pool if too large

[Run All] or run individually
```

### 5. Historical Data
**All data scraped from Pro Football Reference (1920-2024)**

- **Coaches**: Names, teams, years, positions, win/loss records
- **Schedules**: Week-by-week games including AFL schedules
- **Team timeline**: Expansion years, relocations, name changes, inactive periods
- **Logo assets**: Period-specific team logos organized by year

**Coach Management:**
- NO automatic coaching changes (organic in-game)
- Tool adds historical FA coaches to replace generic computer coaches
- Optional manual coach editor if user wants to make changes

### 6. Period-Specific Branding
- Team logos change based on current franchise year
- Editor UI shows period-correct logos
- Examples:
  - Redskins (1960-2019) → Commanders (2020+)
  - Browns → Ravens (1996+), Browns reactivated (1999+)
  - Oilers → Titans (1999+)

### 7. Optional Future Features (Research Phase)
- **Historical stats editor** (if M26 supports career stats in franchise)
- **Uniform/gear editor** (period-appropriate uniforms, helmets, facemasks)
- **Field editor** (retro field logos, era-specific designs)

---

## Implementation Phases

### Phase 1: Data Foundation (1-2 weeks)
**Goal:** Scrape all historical data needed for retro features

**Tasks:**
1. **Complete NFL Timeline Research**
   - All teams 1920-2024 (including defunct teams)
   - Expansion events, relocations, inactive periods
   - Output: `data/lookups/nfl_timeline_complete.csv`

2. **Coach Scraper** (1960-2024)
   - Historical coaches with stats through starting year only
   - Output: `data/lookups/coach_lookup.csv`
   - **START HERE** - Build `scripts/build-coach-lookup.js`

3. **Schedule Scraper** (1920-2024)
   - Historical schedules including AFL years
   - Output: `data/lookups/schedule_lookup.csv`

4. **Logo Asset Collection**
   - Period-specific team logos
   - Organize by team and year range

5. **M25 vs M26 Compatibility Research**
   - Compare franchise file formats
   - Document differences
   - Plan version handling

**Deliverables:**
- Complete historical database (coaches, schedules, timeline)
- M25/M26 compatibility document

---

### Phase 2: Core Franchise Modifications (1-2 weeks)
**Goal:** Build pre-season automation tools

**Features:**
1. **Team Manager**
   - Activate/deactivate teams by year
   - Handle relocations (Browns→Ravens 1996, Browns reactivation 1999)
   - Update team names for current year
   - Apply period-specific logos

2. **Season Year Setter**
   - Update franchise season year field

3. **Draft Pick Adjuster**
   - Move ALL inactive team picks to end of entire draft
   - Shift active team picks up
   - Post-draft FA replacement logic

4. **Schedule Loader**
   - Apply historical schedule for target year
   - Support AFL schedules (1960-1969)
   - Handle inactive teams (remove from schedule)

5. **Historical Coach Manager**
   - Load period-accurate FA coaches
   - Replace generic computer coaches
   - Optional manual coach editor

**Deliverables:**
- Working pre-season tools
- Franchise file modification library

---

### Phase 3: Post-Draft Tools (1 week)
**Goal:** Automate post-draft cleanup

**Features:**
1. **Body Type Fixer**
   - Scan for 300+ lb players
   - Apply correct body types

2. **Commentary ID Fixer**
   - Match players to commentary IDs
   - Updated for M26 (if format changed)

3. **FA Pool Manager**
   - Replace inactive team drafted players with worst FAs
   - Trim FA pool if exceeds threshold (prevent draft class load issues)

**Deliverables:**
- Working post-draft automation

---

### Phase 4: Expansion Draft System (1-2 weeks)
**Goal:** Simulate historical expansion drafts

**Features:**
1. **Expansion Rules Engine**
   - Historical rules by year (1976, 1995, 1999, 2002)
   - User-customizable rules

2. **Protection List Manager**
   - Teams configure protected players
   - Validation (can't exceed limits)

3. **Draft Simulator**
   - Alternate picks between expansion teams
   - Apply results to franchise file

**Special Cases:**
- 1996: Browns→Ravens full roster transfer
- 1999: Browns reactivation with expansion draft

**Deliverables:**
- Functioning expansion draft tool
- Tested on all historical expansion events

---

### Phase 5: Optional Manual Editors (1 week)
**Goal:** Provide user-controlled editing tools

**Features:**
1. **Manual Coach Editor**
   - Hire/fire coaches manually
   - Adjust coach ratings
   - User-driven, not automatic

2. **Historical FA Coach Pool**
   - Load period-accurate FA coaches
   - Replace generic coaches

**Deliverables:**
- Optional coach management tools

---

### Phase 6: UI Integration (2 weeks)
**Goal:** Combine all tools into one wizard interface

**Features:**
1. **Timeline Configuration**
   - Select starting year (1920-2024)
   - Choose historical vs custom timeline
   - Edit timeline events (expansion years, etc.)

2. **Season Progression Wizard**
   ```
   ┌─────────────────────────────────────┐
   │  Retro Season Progression           │
   ├─────────────────────────────────────┤
   │  Current Year: 1994 → 1995          │
   │                                     │
   │  Pre-Season Checklist:              │
   │  ☐ Update team names → [Run]        │
   │  ☐ Set season year → [Run]          │
   │  ☐ Adjust draft picks → [Run]       │
   │  ☐ Load schedule → [Run]            │
   │                                     │
   │  [Run All Pre-Season]               │
   │                                     │
   │  ─────────────────────               │
   │                                     │
   │  Post-Draft Checklist:              │
   │  ☐ Fix body types → [Run]           │
   │  ☐ Fix commentary → [Run]           │
   │  ☐ Clean FA pool → [Run]            │
   │                                     │
   │  [Run All Post-Draft]               │
   └─────────────────────────────────────┘
   ```

3. **Expansion Draft Interface**
   - Protection list UI
   - Draft simulator
   - Results display

**Deliverables:**
- Complete integrated tool with wizard workflow

---

### Phase 7: Research & Future Features (TBD)
**Goal:** Determine feasibility of advanced editors

**Research:**
1. **Historical Stats Editor**
   - Does M26 franchise file store career stats?
   - Can we edit them?
   - Build editor if supported

2. **Uniform/Field Editor**
   - How does M26 store uniforms? (DDS textures? Database fields?)
   - Can madden-franchise library edit them?
   - Build editors if feasible

**Deliverables:**
- Feasibility reports
- Editors if possible

---

## Reference: 1994 Mod V2 Manual Workflow

**Their painful process (EVERY offseason):**
1. Run handleTeamNames.exe
2. Run seasonYearSetup.exe
3. Run HandleRetroPicks.exe
4. **Manually play through draft in Madden**
5. Run bodyTypeFixV1.0.exe
6. Run transferRetroSchedule.exe
7. Run commentaryIdFixV1.2.exe (optional)
8. Run trimFreeAgents.exe (if needed)

**Our solution:**
- **Pre-Season:** Click "Run All Pre-Season" → Steps 1-3 done
- **Post-Draft:** Click "Run All Post-Draft" → Steps 5-8 done
- **Time saved:** ~30 minutes per offseason

---

## Technical Details

### File Compatibility
- **Target:** Madden 26 (primary)
- **Support:** Madden 25 (if format compatible)
- **Version detection:** Auto-detect file version
- **Fallback:** Clear warnings if M25-only features used

### Data Storage
- **SQLite database** for lookups (coaches, schedules, timeline)
- **CSV files** for scraper output (can be manually edited)
- **JSON** for configuration (timeline customization)

### Franchise File Modifications
**Tables modified:**
- **TEAM** - Team names, abbreviations, active/inactive status
- **COCH** - Coach assignments, FA coach pool
- **SCHD** - Schedule data
- **PLAY** - Body types, commentary IDs
- **DRFT** - Draft pick order

**Safety:**
- Always backup before modifications
- Transaction-based saves (all-or-nothing)
- Validation before saving
- Test that modified file loads in-game

---

## Success Metrics

### Phase 1 Complete When:
- [ ] Coach scraper functional (1960-2024)
- [ ] Schedule scraper functional (1920-2024)
- [ ] Complete NFL timeline database built
- [ ] M25/M26 compatibility documented

### Phase 2 Complete When:
- [ ] Pre-season tools modify franchise correctly
- [ ] Changes load in Madden without errors
- [ ] User can progress through multiple seasons

### Overall Project Complete When:
- [ ] All 7 phases done
- [ ] Wizard interface functional
- [ ] User can run retro franchise from any year (1920-2024)
- [ ] All manual 1994 Mod tools replaced with automation
- [ ] M25 and M26 compatibility confirmed
- [ ] Community adoption (GitHub stars, downloads)

---

## Credits

### Reference Tools
- **1994 Mod V2** - Workflow inspiration, tool functionality reference
- **madden-franchise** by bep713 (MIT) - Franchise file parsing
- **MyFranchise** - UI patterns

### Data Sources
- **Pro Football Reference** - Coaches, schedules, team history
- **NFL.com** - Historical records
- **Community mods** - Logo assets, uniform designs

---

## Next Steps

**Immediate:**
1. ✅ Save this plan to MASTER_PLAN.md
2. ⏭️ Commit to git with message: "Add Retro Franchise Manager master plan"
3. ⏭️ Start Phase 1: Build coach scraper (`scripts/build-coach-lookup.js`)
4. ⏭️ Check draft scraper status and fix timeout issues

---

*Last Updated: 2025-10-16*
*Version: 2.0 (Retro Franchise Manager)*
