# Madden Editor Suite - Complete UI Design
**Three-Tier User-Friendly System**

---

## Design Philosophy

1. **User-Friendly First** - Everything has friendly labels and tooltips, no raw Madden field names
2. **Progressive Depth** - Floor 1 → Floor 2 → Floor 3, users can learn and grow
3. **Import Existing Tools** - Roster Editor and Draft Class Editor integrate seamlessly
4. **Maintain Theme System** - Current theme + team-specific themes on team pages
5. **Tooltips Everywhere** - Hover over anything to understand what it does

---

## Main Navigation

```
┌────────────────────────────────────────────────────────────────┐
│ [Home] [Roster] [Draft Class] [Franchise] [League] [Advanced] │
└────────────────────────────────────────────────────────────────┘
```

---

## Tab 1: Home

**Quick start and file management**

```
┌─────────────────────────────────────────────────────────────┐
│                    Madden Editor Suite                       │
│                                                              │
│  📂 Open Franchise File                                     │
│  💾 Recent Files:                                           │
│     - CAREER-AUG07-02h00m07p-AUTOSAVE (Madden 26)          │
│     - MyFranchise-Week12 (Madden 25)                       │
│                                                              │
│  ℹ️ Current File: CAREER-AUG07-02h00m07p-AUTOSAVE          │
│     Game: Madden 26                                         │
│     Season: 2025, Week 7                                    │
│     Teams: 32                                               │
│     Players: 459                                            │
│                                                              │
│  🎯 Quick Actions:                                          │
│     [Edit Rosters]  [Manage Draft Class]  [Trade Players]  │
│                                                              │
│  ⚙️ Settings:                                               │
│     Theme: [Dark ▼]                                         │
│     Auto-Backup: [✓] Enabled                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tab 2: Roster (Floor 1 - Import Existing Tool)

**Full integration of current roster editor**

### Layout:
```
┌─────────────┬──────────────────────────────┬──────────────┐
│ Team        │ Roster View                  │ Player Card  │
│ Selector    │                              │              │
│             │ [Search: Patrick Mahomes]    │ 📷 Portrait  │
│ 🏈 Chiefs   │                              │              │
│   Bills     │ ┌────────────────────────┐  │ Patrick      │
│   Bengals   │ │ QB - Patrick Mahomes   │  │ Mahomes      │
│   ...       │ │ OVR: 99  Age: 29       │  │              │
│             │ ├────────────────────────┤  │ #15 - QB     │
│ Filter:     │ │ HB - Isiah Pacheco     │  │ Kansas City  │
│ [x] Offense │ │ OVR: 82  Age: 24       │  │              │
│ [x] Defense │ ├────────────────────────┤  │ OVR: 99      │
│ [x] ST      │ │ WR - Travis Kelce      │  │              │
│             │ │ OVR: 94  Age: 34       │  │ [Edit Traits]│
│ Sort By:    │ └────────────────────────┘  │ [Edit Attrs] │
│ OVR ▼       │                              │ [Edit Visuals]│
│             │ [Export Roster] [Import]     │              │
└─────────────┴──────────────────────────────┴──────────────┘
```

### Features (All from existing editor):
- ✅ Player search and filters
- ✅ Position filters (Offense, Defense, ST)
- ✅ Sort by OVR, Age, Position
- ✅ Player card with portrait
- ✅ Edit player attributes (friendly names: "Speed" not "PSPD")
- ✅ Edit player traits (friendly names: "Clutch" not "PT_CLUTCH")
- ✅ Edit player visuals (equipment, appearance)
- ✅ Team theme on team pages
- ✅ Import/Export roster CSV
- ✅ Tooltips on every field

**New additions**:
- 🆕 View player contract (salary, years)
- 🆕 View player stats (career, season)
- 🆕 Quick actions: Trade, Release, Injury

---

## Tab 3: Draft Class (Floor 1 - Import Existing Tool)

**Full integration of current draft class editor**

### Layout:
```
┌─────────────┬──────────────────────────────┬──────────────┐
│ Filters     │ Draft Class View             │ Prospect     │
│             │                              │              │
│ Position:   │ [Search: Caleb Williams]     │ 📷 Portrait  │
│ [ ] All     │                              │              │
│ [x] QB      │ ┌────────────────────────┐  │ Caleb        │
│ [x] RB      │ │ QB - Caleb Williams    │  │ Williams     │
│ [x] WR      │ │ OVR: 76  Pick: 1.1     │  │              │
│             │ ├────────────────────────┤  │ #13 - QB     │
│ College:    │ │ WR - Marvin Harrison   │  │ USC          │
│ [All ▼]     │ │ OVR: 78  Pick: 1.4     │  │              │
│             │ ├────────────────────────┤  │ OVR: 76      │
│ OVR Range:  │ │ T - Joe Alt            │  │ Dev: Star    │
│ [70 - 85]   │ │ OVR: 75  Pick: 1.5     │  │              │
│             │ └────────────────────────┘  │ [Edit Attrs] │
│ Sort By:    │                              │ [Edit Dev]   │
│ Pick ▼      │ [Generate Class] [Import]    │ [Set Pick]   │
│             │ [Export] [Randomize Ages]    │              │
└─────────────┴──────────────────────────────┴──────────────┘
```

### Features (All from existing editor):
- ✅ View all draft prospects
- ✅ Search and filter by position, college, OVR
- ✅ Edit prospect attributes
- ✅ Edit development traits
- ✅ Generate draft class from historical data
- ✅ Import/Export draft class
- ✅ Randomize ages, names, colleges
- ✅ Set draft picks
- ✅ Portrait integration
- ✅ Tooltips on every field

**New additions**:
- 🆕 Set scouting grades (per team)
- 🆕 Mock draft simulator
- 🆕 View team draft boards

---

## Tab 4: Franchise (Floor 2 - New)

**Franchise management tools - control the league**

### Subtabs:

#### 4.1 Teams
```
┌─────────────────────────────────────────────────────────────┐
│ Teams Overview                                               │
│                                                              │
│ ┌─────────┬─────────┬─────────┬─────────┐                 │
│ │ 🏈 Chiefs│ 📊 Bills │ 🐅 Bengals│ 🦅 Eagles │              │
│ │ 13-3    │ 12-4    │ 11-5    │ 14-2    │              │
│ │ $15M cap│ $22M cap│ $8M cap │ $30M cap│              │
│ │ [Manage]│ [Manage]│ [Manage]│ [Manage]│              │
│ └─────────┴─────────┴─────────┴─────────┘                 │
│                                                              │
│ Click any team to:                                          │
│ • View/Edit roster                                          │
│ • Manage depth chart                                        │
│ • View team stats                                           │
│ • Set coaching staff                                        │
│ • Adjust cap space                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2 Trades
```
┌─────────────────────────────────────────────────────────────┐
│ Trade Editor                                                 │
│                                                              │
│ From: [Chiefs ▼]              To: [Bills ▼]                │
│                                                              │
│ ┌──────────────────┐         ┌──────────────────┐          │
│ │ Patrick Mahomes  │  ←→    │ Josh Allen       │          │
│ │ QB - OVR 99      │         │ QB - OVR 93      │          │
│ │                  │         │                  │          │
│ │ [Add Player]     │         │ [Add Player]     │          │
│ │ [Add Pick]       │         │ [Add Pick]       │          │
│ └──────────────────┘         └──────────────────┘          │
│                                                              │
│ Trade Value: Chiefs +2500  ⚠️ Unbalanced                   │
│                                                              │
│ [Force Trade] [Cancel]                                      │
│                                                              │
│ 💡 Tip: Click "Force Trade" to execute without approval    │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3 Free Agency
```
┌─────────────────────────────────────────────────────────────┐
│ Free Agent Pool                                              │
│                                                              │
│ [Search: _________]  Position: [All ▼]  OVR: [70-99]      │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Tom Brady          QB    OVR: 90   Age: 45   [Sign]   │ │
│ │ Aaron Rodgers      QB    OVR: 88   Age: 40   [Sign]   │ │
│ │ Julio Jones        WR    OVR: 82   Age: 34   [Sign]   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Sign To: [Chiefs ▼]                                        │
│ Contract: [3 years] [$20M/yr] [$10M signing bonus]         │
│                                                              │
│ [Sign Player]                                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.4 Draft
```
┌─────────────────────────────────────────────────────────────┐
│ Draft Management                                             │
│                                                              │
│ Current Pick: Round 1, Pick 1 - Chiefs                     │
│                                                              │
│ Draft Board (Chiefs):                                       │
│ 1. Caleb Williams    QB    OVR: 76    [Select]            │
│ 2. Marvin Harrison   WR    OVR: 78    [Select]            │
│ 3. Joe Alt           T     OVR: 75    [Select]            │
│                                                              │
│ ─────────────────────────────────────────────────────────  │
│                                                              │
│ Simulate: [Next Pick] [Full Round] [Entire Draft]          │
│                                                              │
│ Manage: [Set Draft Order] [Edit Team Boards]               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.5 Season
```
┌─────────────────────────────────────────────────────────────┐
│ Season Management                                            │
│                                                              │
│ Current: Week 7, 2025 Regular Season                       │
│                                                              │
│ Schedule:                                                   │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Thu 10/19: Chiefs @ Bills      Final: 31-24          │   │
│ │ Sun 10/22: Eagles @ Cowboys    Final: 28-23          │   │
│ │ Sun 10/22: Bengals @ Steelers  [Sim] [Edit Score]   │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│ Standings (AFC West):                                       │
│ 1. Chiefs     6-0                                           │
│ 2. Raiders    4-2                                           │
│ 3. Chargers   3-3                                           │
│ 4. Broncos    2-4                                           │
│                                                              │
│ [Advance Week] [Edit Schedule] [View Playoffs]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.6 Injuries
```
┌─────────────────────────────────────────────────────────────┐
│ Injury Management                                            │
│                                                              │
│ Active Injuries:                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Patrick Mahomes  Chiefs  QB   Ankle    Out 2 weeks    │ │
│ │   [Heal] [Worsen] [IR]                                 │ │
│ │                                                         │ │
│ │ Josh Allen       Bills   QB   Shoulder  Out 1 week    │ │
│ │   [Heal] [Worsen] [IR]                                 │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Create Injury:                                              │
│ Player: [Select Player ▼]                                  │
│ Type: [Ankle ▼]  Severity: [2 weeks ▼]                   │
│ [Injure Player]                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.7 Coaching
```
┌─────────────────────────────────────────────────────────────┐
│ Coaching Staff Management                                    │
│                                                              │
│ Team: [Chiefs ▼]                                           │
│                                                              │
│ Current Staff:                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Head Coach: Andy Reid                                   │ │
│ │   Chemistry: A+  Contract: 3 years                     │ │
│ │   [Edit] [Fire] [Replace]                              │ │
│ │                                                         │ │
│ │ Offensive Coordinator: Eric Bieniemy                    │ │
│ │   Scheme: West Coast  Rating: 85                       │ │
│ │   [Edit] [Fire] [Replace]                              │ │
│ │                                                         │ │
│ │ Defensive Coordinator: Steve Spagnuolo                  │ │
│ │   Scheme: 4-3  Rating: 88                              │ │
│ │   [Edit] [Fire] [Replace]                              │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Available Coaches: [View Pool]                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tab 5: League (Floor 2 - New)

**League-wide controls and history**

### Subtabs:

#### 5.1 Standings
```
┌─────────────────────────────────────────────────────────────┐
│ League Standings                                             │
│                                                              │
│ AFC                              NFC                         │
│ ┌─────────────────┐             ┌─────────────────┐        │
│ │ East:           │             │ East:           │        │
│ │ 1. Bills   12-4 │             │ 1. Eagles  14-2 │        │
│ │ 2. Dolphins 10-6│             │ 2. Cowboys 11-5 │        │
│ │ ...             │             │ ...             │        │
│ │                 │             │                 │        │
│ │ West:           │             │ West:           │        │
│ │ 1. Chiefs  13-3 │             │ 1. 49ers   13-3 │        │
│ │ 2. Raiders 10-6 │             │ 2. Seahawks 9-7│        │
│ └─────────────────┘             └─────────────────┘        │
│                                                              │
│ [Export Standings] [View Playoff Picture]                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2 League Stats
```
┌─────────────────────────────────────────────────────────────┐
│ League Leaders                                               │
│                                                              │
│ Passing Yards:                                              │
│ 1. Patrick Mahomes    Chiefs     4,892 yards               │
│ 2. Josh Allen         Bills      4,756 yards               │
│ 3. Joe Burrow         Bengals    4,521 yards               │
│                                                              │
│ Rushing Yards:                                              │
│ 1. Derrick Henry      Titans     1,823 yards               │
│ 2. Nick Chubb         Browns     1,702 yards               │
│                                                              │
│ [View More Stats] [Export Stats]                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3 History
```
┌─────────────────────────────────────────────────────────────┐
│ Franchise History                                            │
│                                                              │
│ Past Champions:                                             │
│ 2024: Chiefs (15-2) defeated Bills (13-4) in Super Bowl    │
│ 2023: Eagles (14-3) defeated Chiefs (13-4) in Super Bowl   │
│ 2022: Chiefs (14-3) defeated 49ers (13-4) in Super Bowl    │
│                                                              │
│ Awards:                                                     │
│ 2024 MVP: Patrick Mahomes (Chiefs)                         │
│ 2024 OPOY: Christian McCaffrey (49ers)                     │
│ 2024 DPOY: Micah Parsons (Cowboys)                         │
│                                                              │
│ [View Full History] [Export History]                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tab 6: Advanced (Floor 3 - New)

**Advanced controls for developers and modders**

### Subtabs:

#### 6.1 Stats Editor
```
┌─────────────────────────────────────────────────────────────┐
│ Player Stats Editor                                          │
│                                                              │
│ Player: [Patrick Mahomes ▼]    Season: [2025 ▼]           │
│                                                              │
│ Passing Stats:                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Completions:  [425]  💡 Pass attempts completed         │ │
│ │ Attempts:     [612]  💡 Total pass attempts             │ │
│ │ Yards:        [4892] 💡 Total passing yards             │ │
│ │ Touchdowns:   [38]   💡 Passing TDs                     │ │
│ │ Interceptions:[8]    💡 Passes intercepted              │ │
│ │ Sacks:        [25]   💡 Times sacked                    │ │
│ │ Rating:       [108.2] 💡 QB rating (auto-calculated)    │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Rushing Stats:                                              │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Carries:      [52]   💡 Rush attempts                   │ │
│ │ Yards:        [308]  💡 Total rushing yards             │ │
│ │ Touchdowns:   [4]    💡 Rushing TDs                     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Save Stats] [Recalculate Rating] [Export CSV]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 6.2 Sliders & Tuning
```
┌─────────────────────────────────────────────────────────────┐
│ Gameplay Sliders                                             │
│                                                              │
│ Offense:                                                    │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Pass Accuracy:    [50] ━━━━━●━━━━━ [100]              │ │
│ │   💡 How accurate QB passes are                         │ │
│ │                                                         │ │
│ │ Pass Blocking:    [50] ━━━━━●━━━━━ [100]              │ │
│ │   💡 How well O-line blocks on passes                   │ │
│ │                                                         │ │
│ │ Run Blocking:     [50] ━━━━━●━━━━━ [100]              │ │
│ │   💡 How well O-line blocks on runs                     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Defense:                                                    │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Pass Coverage:    [50] ━━━━━●━━━━━ [100]              │ │
│ │   💡 How well DBs cover receivers                       │ │
│ │                                                         │ │
│ │ Pass Rush:        [50] ━━━━━●━━━━━ [100]              │ │
│ │   💡 How well D-line gets to QB                         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Reset to Default] [Save Sliders] [Import Slider Set]      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 6.3 Tables (Power User Mode)
```
┌─────────────┬──────────────────────────────┬──────────────┐
│ Categories  │ Table View                   │ Field Info   │
│             │                              │              │
│ [Search]    │ Player Table                 │💡 Selected:  │
│             │                              │              │
│ ⭐ Pinned   │ ┌─────────────────────────┐ │ First Name   │
│   Player    │ │ FirstName │ LastName    │ │              │
│   Team      │ ├───────────┼─────────────│ │ Type: String │
│             │ │ Patrick   │ Mahomes     │ │ Max: 15 char │
│ 📁 Core     │ │ Josh      │ Allen       │ │              │
│   ► Player  │ │ Joe       │ Burrow      │ │ This is the  │
│   ► Team    │ └─────────────────────────┘ │ player's     │
│   ► Coach   │                              │ first name   │
│   ► Season  │ 459 records                 │ as shown in  │
│             │                              │ game menus.  │
│ 📁 Stats    │ [Sort] [Filter] [Export]    │              │
│ 📁 Draft    │                              │ [Edit Field] │
│             │                              │              │
└─────────────┴──────────────────────────────┴──────────────┘
```

**Key Features**:
- ✅ Friendly field names ("First Name" not "PFNA")
- ✅ Tooltips on hover explain what each field does
- ✅ Categorized tables (Player, Team, Stats, etc.)
- ✅ Recently used and pinned tables
- ✅ Field info sidebar shows type, limits, explanation
- ✅ Handsontable grid for fast editing
- ✅ Can still access raw data if needed

#### 6.4 Schema Explorer
```
┌─────────────────────────────────────────────────────────────┐
│ Schema Explorer                                              │
│                                                              │
│ Table: [Player ▼]                                           │
│                                                              │
│ Fields (334 total):                                         │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ FirstName             String(15)    Player's first name│ │
│ │ LastName              String(25)    Player's last name │ │
│ │ Position              Enum(QB,RB..) Primary position   │ │
│ │ OverallRating         int(0-99)     Overall rating     │ │
│ │ SpeedRating           int(0-99)     Speed attribute    │ │
│ │ AccelerationRating    int(0-99)     Acceleration       │ │
│ │ ...                                                     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Export Schema] [View Relationships] [Compare M25 vs M26]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 6.5 Batch Operations
```
┌─────────────────────────────────────────────────────────────┐
│ Batch Edit Tools                                             │
│                                                              │
│ Operation Type:                                             │
│ ( ) Update Field   ( ) Add Value   (•) Multiply by Factor  │
│                                                              │
│ Target:                                                     │
│ Table: [Player ▼]                                           │
│ Filter: Position = QB                                       │
│ Field: ThrowPower                                           │
│                                                              │
│ Operation:                                                  │
│ Multiply by: [1.1]  💡 Increase all QB throw power by 10%  │
│                                                              │
│ Preview (5 players shown):                                  │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Patrick Mahomes: 95 → 105 (capped at 99)              │ │
│ │ Josh Allen:      93 → 102 (capped at 99)              │ │
│ │ Joe Burrow:      88 → 97                               │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ [Apply to All] [Cancel]                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 6.6 Import/Export
```
┌─────────────────────────────────────────────────────────────┐
│ Data Import/Export                                           │
│                                                              │
│ Export:                                                     │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Table: [Player ▼]                                       │ │
│ │ Format: [CSV ▼]                                         │ │
│ │ Fields: [All ▼] or [Select specific fields]            │ │
│ │                                                         │ │
│ │ [Export Table]                                          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ Import:                                                     │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Table: [Player ▼]                                       │ │
│ │ File: [Choose CSV file...]                              │ │
│ │                                                         │ │
│ │ Mode:                                                   │ │
│ │ ( ) Update existing  ( ) Replace all  (•) Add new      │ │
│ │                                                         │ │
│ │ [Import Data]                                           │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Theme System

### Current Theme (Dark Mode)
```css
--primary-color: #1e40af;
--secondary-color: #3b82f6;
--background: #0f172a;
--surface: #1e293b;
--text: #f1f5f9;
```

### Team Themes (Example: Chiefs)
```css
--team-primary: #E31837;    /* Chiefs red */
--team-secondary: #FFB81C;  /* Chiefs gold */
--team-accent: #FFFFFF;     /* White */
```

**Applied on**:
- Team pages background
- Team roster headers
- Player cards when viewing team roster
- Trade screens (team colors on each side)

---

## Tooltips System

**Every field, button, and control has a tooltip**:

```javascript
// Example tooltip implementation
<input
  type="number"
  value="99"
  data-tooltip="Overall Rating: Player's overall skill level from 0-99. Affects gameplay performance."
/>
```

**Tooltip Levels**:
1. **Basic** - Short description (e.g., "Player's first name")
2. **Detailed** - Longer explanation with context (e.g., "Player's first name as shown in game menus and commentary. Max 15 characters.")
3. **Expert** - Technical details (e.g., "Field: FirstName | Type: String | Max: 15 | Table: Player | Schema: 660.1")

User can toggle tooltip level in settings: Basic → Detailed → Expert

---

## Implementation Priority

### Phase 1 (4 weeks):
1. ✅ Home tab (file management)
2. ✅ Roster tab (import existing editor)
3. ✅ Draft Class tab (import existing editor)
4. ✅ Theme system
5. ✅ Tooltip system
6. ✅ Basic franchise features (Teams overview, Trades, Free Agency)

### Phase 2 (4 weeks):
7. ✅ Season management (Schedule, Standings, Sim)
8. ✅ Draft management
9. ✅ Injuries
10. ✅ Coaching staff
11. ✅ League stats and history

### Phase 3 (Ongoing):
12. ✅ Stats editor
13. ✅ Sliders & tuning
14. ✅ Tables (power user mode)
15. ✅ Schema explorer
16. ✅ Batch operations
17. ✅ Import/Export

---

## Key Differences from MyFranchise

✅ **We're Better At**:
- User-friendly labels everywhere (no raw Madden headers)
- Tooltips on everything
- Integrated existing roster/draft class tools
- Floor 1 → Floor 2 → Floor 3 progression
- Team themes
- Better franchise management tools (trades, FA, etc.)
- Still expose tables for power users

✅ **We Keep from MyFranchise**:
- Handsontable (proven for large grids)
- Tab system for multiple views
- Reference editing modal
- Table-based editing for advanced users

---

## Summary

**Floor 1: Roster Editors** → Import existing tools, make them better
**Floor 2: Franchise Managers** → New tools for league control without playing every team
**Floor 3: Advanced Control** → Power users get stats, sliders, tables - all user-friendly

Everything has:
- Friendly labels
- Tooltips
- Team themes
- Progressive disclosure (learn as you go)

Users start on Floor 1, learn the tools, then naturally progress to Floor 2 and 3 as they need more control.
