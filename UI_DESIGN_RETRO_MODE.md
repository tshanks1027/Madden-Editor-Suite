# Retro Franchise Mode Integration

**Making the franchise editor double as the retro tools suite**

---

## Concept

The same UI works for both:
- **Modern Mode** - Editing current Madden 25/26 franchise files
- **Retro Mode** - Historical franchise management (1920-2024)

When user opens a retro franchise (e.g., starting in 1994), the editor detects the year and enables retro-specific features.

---

## Retro Mode Detection

### Automatic Detection
```javascript
// On file open, check franchise year
const franchiseYear = seasonInfo.CurrentSeasonYear;

if (franchiseYear < 2020) {
  enableRetroMode(franchiseYear);
  showRetroWelcome();
}
```

### Manual Toggle
```
Settings → [✓] Enable Retro Mode
Target Year: [1994 ▼]
```

---

## Retro Mode UI Changes

### Home Tab - Retro Status
```
┌─────────────────────────────────────────────────────────────┐
│                    Madden Editor Suite                       │
│                     🕰️ RETRO MODE: 1994                     │
│                                                              │
│  📂 Current Franchise: 1994 Season - Week 1                │
│     Teams Active: 28 (Jaguars, Panthers not yet founded)   │
│     Next Expansion: 1995 (Jaguars, Panthers)               │
│                                                              │
│  🎯 Retro Tools:                                            │
│     [Pre-Season Setup]  [Post-Draft Cleanup]               │
│     [Expansion Draft]   [Historical Coaches]               │
│                                                              │
│  ⚙️ Timeline Settings:                                      │
│     Current Year: 1994                                      │
│     Auto-Progress: [✓] Enabled                             │
│     Historical Accuracy: [✓] Strict                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## New Tab: Retro Tools

### Tab 7: Retro (Only visible in Retro Mode)

#### 7.1 Pre-Season Setup
**Replaces 3 manual tools from 1994 Mod V2**

```
┌─────────────────────────────────────────────────────────────┐
│ Pre-Season Checklist - 1994 → 1995                         │
│                                                              │
│ ☑ Update team names                                        │
│   ✓ Washington Redskins → Washington Commanders (2020)    │
│   ✓ Houston Oilers → Tennessee Titans (1999)              │
│   💡 Updates team names based on year                       │
│                                                              │
│ ☑ Set season year                                          │
│   Current: 1994 → New: 1995                                │
│   💡 Updates franchise file to next season                  │
│                                                              │
│ ☑ Adjust draft picks for non-existent teams               │
│   Jaguars (founded 1995): Move picks to end of draft      │
│   Panthers (founded 1995): Move picks to end of draft     │
│   💡 Prevents non-existent teams from drafting talent      │
│                                                              │
│ ☑ Load historical schedule                                │
│   Loading 1995 NFL schedule from database...              │
│   ✓ 16 games per team, bye weeks configured               │
│   💡 Uses actual historical schedule                        │
│                                                              │
│ ☑ Add historical coaches                                  │
│   Loading 1995 coaching staffs...                         │
│   ✓ 28 teams, 84 coaches added                            │
│   💡 Replaces generic coaches with real ones               │
│                                                              │
│ [Run All Pre-Season] or [Run Step-by-Step]                │
│                                                              │
│ Status: Ready for offseason                                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 7.2 Post-Draft Cleanup
**Replaces 4 manual tools from 1994 Mod V2**

```
┌─────────────────────────────────────────────────────────────┐
│ Post-Draft Checklist                                         │
│                                                              │
│ ☑ Fix body types                                           │
│   Found 47 players over 300 lbs with incorrect body type  │
│   [Preview Changes] [Apply Fix]                            │
│   💡 Ensures heavy players display correctly                │
│                                                              │
│ ☑ Fix commentary IDs                                       │
│   1,234 players need commentary assignment                 │
│   [Auto-Match] [Manual Review]                             │
│   💡 Matches player names to commentary audio               │
│                                                              │
│ ☑ Replace inactive team draft picks                       │
│   Jaguars drafted 5 players (team doesn't exist yet)      │
│   → Replacing with worst 5 FAs (OVR < 55)                  │
│   💡 Prevents non-existent teams from getting talent       │
│                                                              │
│ ☑ Trim free agent pool                                    │
│   Current FAs: 2,145 (exceeds safe limit of 1,500)        │
│   [Auto-Trim to 1,200] [Manual Selection]                 │
│   💡 Prevents draft class loading issues                    │
│                                                              │
│ [Run All Post-Draft] or [Run Step-by-Step]                │
│                                                              │
│ Status: Ready for season                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 7.3 Expansion Draft
**New feature - not in 1994 Mod V2**

```
┌─────────────────────────────────────────────────────────────┐
│ Expansion Draft Manager - 1995                              │
│                                                              │
│ Expansion Teams:                                            │
│ 🏈 Jacksonville Jaguars                                     │
│ 🏈 Carolina Panthers                                        │
│                                                              │
│ Expansion Rules (1995):                                     │
│ • Existing teams protect 5 players                         │
│ • Expansion teams alternate picks                          │
│ • Must select 1 player from each existing team            │
│ • Total: 30 picks per expansion team                      │
│                                                              │
│ Step 1: Set Protection Lists                               │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Team: [Chiefs ▼]                                        │ │
│ │                                                         │ │
│ │ Protected (5/5):                                        │ │
│ │ ✓ Patrick Mahomes      QB   OVR: 99                   │ │
│ │ ✓ Derrick Thomas       LB   OVR: 95                   │ │
│ │ ✓ Marcus Allen         RB   OVR: 92                   │ │
│ │ ✓ Neil Smith           DE   OVR: 90                   │ │
│ │ ✓ Dale Carter          CB   OVR: 88                   │ │
│ │                                                         │ │
│ │ [Auto-Protect Top 5] [Reset]                           │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Step 2: Run Draft Simulation                               │
│ [ ] Auto-select (AI picks)                                 │
│ [✓] Manual selection (you pick for each team)             │
│                                                              │
│ Step 3: Apply Results                                      │
│ [Preview Rosters] [Finalize Draft]                         │
│                                                              │
│ 💡 Historical Note: Jaguars selected Tony Boselli #1 overall│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 7.4 Timeline Manager
**New feature - control historical timeline**

```
┌─────────────────────────────────────────────────────────────┐
│ Historical Timeline Manager                                  │
│                                                              │
│ Current Year: 1994                                          │
│                                                              │
│ Timeline: [Historical ▼] or [Custom]                       │
│                                                              │
│ Upcoming Events:                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 1995: Expansion                                         │ │
│ │   • Jacksonville Jaguars join NFL                       │ │
│ │   • Carolina Panthers join NFL                          │ │
│ │   Status: [✓] Enabled  [Configure]                     │ │
│ │                                                         │ │
│ │ 1996: Relocation                                        │ │
│ │   • Cleveland Browns → Baltimore Ravens                 │ │
│ │   • Browns go inactive until 1999                      │ │
│ │   Status: [✓] Enabled  [Configure]                     │ │
│ │                                                         │ │
│ │ 1999: Reactivation & Expansion                         │ │
│ │   • Cleveland Browns reactivated (expansion draft)     │ │
│ │   • Houston Oilers → Tennessee Titans                   │ │
│ │   Status: [✓] Enabled  [Configure]                     │ │
│ │                                                         │ │
│ │ 2002: Expansion                                         │ │
│ │   • Houston Texans join NFL                            │ │
│ │   Status: [✓] Enabled  [Configure]                     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Custom Timeline: [Edit Timeline Events]                    │
│ 💡 Create "what if" scenarios by modifying timeline        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 7.5 Historical Coaches
**New feature - manage historical coaching staffs**

```
┌─────────────────────────────────────────────────────────────┐
│ Historical Coaching Database                                 │
│                                                              │
│ Year: [1994 ▼]    Team: [All Teams ▼]                      │
│                                                              │
│ Available Historical Coaches (1994):                        │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Name            Team      Position    Record           │ │
│ │ ────────────────────────────────────────────────────── │ │
│ │ Bill Parcells   Patriots  HC          10-6             │ │
│ │ Marty Schottenheimer Chiefs HC         9-7             │ │
│ │ Bill Belichick  Browns    HC          11-5             │ │
│ │ Don Shula       Dolphins  HC           9-8             │ │
│ │ George Seifert  49ers     HC          13-3             │ │
│ │ ...                                                     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Actions:                                                    │
│ [Load All Historical Coaches]  → Replaces all coaches      │
│ [Load Team Coaches]            → Replace specific team     │
│ [Add to FA Pool]               → Add as available coaches  │
│                                                              │
│ 💡 Data Source: Pro Football Reference (1960-2024)         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 7.6 Historical Schedules
**New feature - load real NFL schedules**

```
┌─────────────────────────────────────────────────────────────┐
│ Historical Schedule Manager                                  │
│                                                              │
│ Season: [1994 ▼]                                            │
│                                                              │
│ Schedule Preview:                                           │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Week 1:                                                 │ │
│ │   Chiefs @ Saints        (Thu 9/1)                     │ │
│ │   Cowboys @ Steelers     (Sun 9/4)                     │ │
│ │   49ers @ Raiders        (Sun 9/4)                     │ │
│ │   ... (14 more games)                                  │ │
│ │                                                         │ │
│ │ Week 2:                                                 │ │
│ │   Patriots @ Bills       (Sun 9/11)                    │ │
│ │   ... (15 more games)                                  │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Load Historical Schedule]                                  │
│ [Customize Schedule]                                        │
│ [Reset to Default]                                          │
│                                                              │
│ 💡 Uses actual 1994 NFL schedule                            │
│ 💡 Automatically adjusts for inactive teams                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 7.7 Data Sources
**View and manage historical data**

```
┌─────────────────────────────────────────────────────────────┐
│ Historical Data Management                                   │
│                                                              │
│ Coach Database:                                             │
│ ✓ 1960-2024 coaching data (5,432 coaches)                 │
│ Source: Pro Football Reference                             │
│ Last Updated: 2025-10-16                                   │
│ [Update Database] [View Data]                              │
│                                                              │
│ Schedule Database:                                          │
│ ✓ 1920-2024 schedules (100+ seasons)                      │
│ Source: Pro Football Reference                             │
│ Last Updated: 2025-10-16                                   │
│ [Update Database] [View Data]                              │
│                                                              │
│ Draft Database:                                             │
│ ✓ 1960-2025 draft data (11,397 players)                   │
│ Source: Pro Football Reference                             │
│ Status: Building... (1,500/9,307 physicals)               │
│ [View Progress] [Pause] [Resume]                           │
│                                                              │
│ NFL Timeline:                                               │
│ ✓ Complete team history (1920-2024)                       │
│ - Expansions, relocations, mergers                         │
│ [View Timeline] [Edit Timeline]                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Retro Mode Features Integrated into Existing Tabs

### Roster Tab (with Retro Enhancements)

**Active Team Filtering**:
```
┌─────────────────────────────────────────────────────────────┐
│ Team Filter:                                                │
│ [ ] Show All Teams (32)                                     │
│ [✓] Active Teams Only (28) ← 1994 mode                     │
│                                                              │
│ Inactive Teams (will not show):                            │
│ • Jacksonville Jaguars (founded 1995)                      │
│ • Carolina Panthers (founded 1995)                         │
│ • Baltimore Ravens (founded 1996)                          │
│ • Houston Texans (founded 2002)                            │
└─────────────────────────────────────────────────────────────┘
```

**Historical Draft Classes**:
```
Draft Class tab now shows:
• 1994 Draft Class (if viewing 1994 franchise)
• Can generate historical draft classes for any year
• Uses enhanced lookup database with real draft data
```

### Draft Class Tab (with Retro Mode)

**Historical Draft Generation**:
```
┌─────────────────────────────────────────────────────────────┐
│ Generate Draft Class                                         │
│                                                              │
│ Mode: [Historical ▼] or [Random]                           │
│                                                              │
│ Historical Mode:                                            │
│ Year: [1995 ▼]                                              │
│                                                              │
│ Preview (1995 Draft Class):                                │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ 1.1 - Ki-Jana Carter     RB   Penn State    OVR: 78   │ │
│ │ 1.2 - Tony Boselli       T    USC           OVR: 76   │ │
│ │ 1.3 - Steve McNair       QB   Alcorn State  OVR: 75   │ │
│ │ 1.4 - Michael Westbrook  WR   Colorado      OVR: 74   │ │
│ │ ... (256 more picks)                                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Options:                                                    │
│ [✓] Use actual attributes (from PFR career stats)         │
│ [✓] Randomize development traits                          │
│ [ ] Adjust for game balance                                │
│                                                              │
│ [Generate Class] [Export CSV]                              │
│                                                              │
│ 💡 Uses real 1995 draft data with career performance       │
└─────────────────────────────────────────────────────────────┘
```

### Franchise Tab (with Retro Context)

**Team Management shows inactive teams grayed out**:
```
┌─────────────────────────────────────────────────────────────┐
│ Teams Overview (1994)                                        │
│                                                              │
│ Active Teams (28):                                          │
│ ┌─────────┬─────────┬─────────┬─────────┐                 │
│ │ 🏈 Chiefs│ 📊 Bills │ 🐅 Bengals│ 🦅 Eagles │              │
│ └─────────┴─────────┴─────────┴─────────┘                 │
│                                                              │
│ Inactive Teams (4):                                         │
│ ┌─────────┬─────────┬─────────┬─────────┐                 │
│ │ 🚫 Jaguars│🚫 Panthers│🚫 Ravens│🚫 Texans│              │
│ │ (1995)  │ (1995)  │ (1996)  │ (2002)  │              │
│ └─────────┴─────────┴─────────┴─────────┘                 │
│                                                              │
│ 💡 Inactive teams will be founded in future seasons        │
└─────────────────────────────────────────────────────────────┘
```

### League Tab (with Historical Context)

**Standings show historical divisions**:
```
┌─────────────────────────────────────────────────────────────┐
│ League Standings (1994)                                      │
│                                                              │
│ AFC Central (5 teams):                                      │
│ 1. Steelers    11-5                                         │
│ 2. Browns      11-5                                         │
│ 3. Bengals      3-13                                        │
│ 4. Oilers       2-14                                        │
│ 5. Jaguars      -    (inactive)                            │
│                                                              │
│ 💡 1995: AFC Central will expand to 6 teams                │
│    (Jaguars join from expansion)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Retro Workflow Example

### Scenario: User starts 1994 franchise

**Week 0 (Pre-Season)**:
1. Open franchise → Detects 1994 year → Enables Retro Mode
2. Go to Retro tab → Run Pre-Season Setup
   - ✓ Team names updated
   - ✓ Season year set to 1995
   - ✓ Draft picks adjusted (Jaguars/Panthers to end)
   - ✓ Historical schedule loaded
   - ✓ Historical coaches added
3. User plays offseason in-game

**Post-Draft**:
1. Return to editor
2. Go to Retro tab → Run Post-Draft Cleanup
   - ✓ Body types fixed
   - ✓ Commentary IDs assigned
   - ✓ Jaguars/Panthers draft picks replaced with bad FAs
   - ✓ FA pool trimmed to 1,200
3. Save franchise → Ready for 1995 season

**1995 Pre-Season (Expansion Year)**:
1. Retro tab → Expansion Draft
2. Set protection lists for all 28 teams
3. Run expansion draft (Jaguars/Panthers each select 30 players)
4. Apply results → Jaguars and Panthers now have rosters
5. Run Pre-Season Setup for 1995 → 1996
6. Continue...

---

## Settings for Retro Mode

### Retro Mode Settings Panel
```
┌─────────────────────────────────────────────────────────────┐
│ Retro Mode Settings                                          │
│                                                              │
│ Timeline:                                                   │
│ (•) Historical (accurate to real NFL)                      │
│ ( ) Custom (edit timeline events)                          │
│                                                              │
│ Auto-Progress:                                              │
│ [✓] Automatically advance to next year's timeline          │
│ [✓] Show notifications for upcoming events                 │
│ [✓] Auto-run pre-season setup                              │
│                                                              │
│ Historical Accuracy:                                        │
│ (•) Strict - Follow actual NFL timeline exactly            │
│ ( ) Flexible - Allow modifications                         │
│ ( ) Fantasy - Mix historical and modern elements           │
│                                                              │
│ Draft Classes:                                              │
│ (•) Use historical draft data (with real performance)      │
│ ( ) Generate random draft classes                          │
│                                                              │
│ Coaching:                                                   │
│ [✓] Use historical coaching staffs                         │
│ [ ] Allow user to hire any coach                           │
│                                                              │
│ Warnings:                                                   │
│ [✓] Warn before modifying inactive teams                   │
│ [✓] Warn before timeline changes                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Requirements for Retro Mode

### What We Need (from MASTER_PLAN.md):

✅ **Already Building**:
1. Draft data (1960-2025) - Currently scraping (1,500/9,307)
2. Enhanced lookup with physical data

🆕 **Need to Build** (Phase 1 priorities):
1. **Coach database** (1960-2024)
   - Script: `scripts/build-coach-lookup.js`
   - Output: `data/lookups/coach_lookup.csv`

2. **Schedule database** (1920-2024)
   - Script: `scripts/build-schedule-lookup.js`
   - Output: `data/lookups/schedule_lookup.csv`

3. **NFL Timeline database**
   - All teams, expansions, relocations, inactive periods
   - Output: `data/lookups/nfl_timeline.csv`

4. **Logo assets** (by year and team)
   - Organized: `data/logos/{year}/{team}.png`

---

## Integration Summary

### Single Editor, Dual Purpose

**Modern Mode (Default)**:
- All 6 tabs work as designed
- Full M25/M26 franchise editing
- No retro features visible

**Retro Mode (Auto-detected or manual)**:
- All 6 tabs PLUS new Retro tab
- Retro-aware features in existing tabs:
  - Active/inactive team filtering
  - Historical draft class generation
  - Timeline-based coaching
  - Period-specific logos
- Complete automation of 1994 Mod V2 manual workflow

### Benefits

✅ **For Users**:
- One tool for everything
- No switching between apps
- Learn once, use for modern or retro

✅ **For Development**:
- Shared UI components
- Same franchise file handling
- Retro features build on top of modern features
- No duplicate code

✅ **For Retro Users**:
- Replaces 7 manual tools with automation
- Expansion draft system (new feature!)
- Historical accuracy with timeline manager
- Complete 1920-2024 support

---

## Next Steps

1. Build coach scraper (`scripts/build-coach-lookup.js`)
2. Build schedule scraper (`scripts/build-schedule-lookup.js`)
3. Create NFL timeline database
4. Implement Retro Mode detection
5. Build Retro tab UI
6. Integrate retro features into existing tabs

**This gives you ONE complete editor for both modern and retro franchise management!**
