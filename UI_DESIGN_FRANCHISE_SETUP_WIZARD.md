# Franchise Setup Wizard

**First-time franchise file opening experience**

---

## Concept

When a user opens a franchise file for the first time (not in recent files list), show a setup wizard to configure:
1. Is this a retro franchise?
2. What year does it represent?
3. Auto-configure settings based on choices

---

## Wizard Flow

### Step 1: File Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                  Opening Franchise File...                   │
│                                                              │
│  📂 File: CAREER-AUG07-02h00m07p-AUTOSAVE                   │
│                                                              │
│  ⏳ Analyzing file...                                       │
│     ✓ Detected: Madden 26                                  │
│     ✓ Schema Version: 660.1                                │
│     ✓ Season Year: 2025                                    │
│     ✓ Current Week: 7                                      │
│     ✓ Teams: 32                                            │
│     ✓ Players: 459                                         │
│                                                              │
│  [Continue to Setup]                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Franchise Mode Selection

```
┌─────────────────────────────────────────────────────────────┐
│              Franchise Setup - Mode Selection                │
│                                                              │
│  What type of franchise is this?                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  (•) Modern Franchise                                │  │
│  │      Standard Madden 25/26 franchise                 │  │
│  │      • All 32 NFL teams                              │  │
│  │      • Current rosters and settings                  │  │
│  │      • No historical features needed                 │  │
│  │                                                       │  │
│  │  ( ) Retro Franchise                                 │  │
│  │      Historical NFL franchise (1920-2024)            │  │
│  │      • Manage teams by historical year               │  │
│  │      • Enable retro tools and automation             │  │
│  │      • Historical coaches, schedules, logos          │  │
│  │                                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  💡 You can change this later in Settings                   │
│                                                              │
│  [Back]                                 [Next]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 3A: Modern Franchise (if Modern selected)

```
┌─────────────────────────────────────────────────────────────┐
│          Franchise Setup - Modern Franchise                  │
│                                                              │
│  Your franchise is ready to edit!                           │
│                                                              │
│  File Information:                                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Game: Madden 26                                     │  │
│  │  Season: 2025, Week 7                                │  │
│  │  Teams: 32 (All Active)                              │  │
│  │  Players: 459                                        │  │
│  │  Mode: Modern Franchise                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  Quick Start:                                               │
│  • Go to Roster tab to edit players                        │
│  • Go to Draft Class tab to manage prospects               │
│  • Go to Franchise tab to manage teams and trades          │
│                                                              │
│  [Back]                                 [Start Editing]     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 3B: Retro Franchise Year Selection (if Retro selected)

```
┌─────────────────────────────────────────────────────────────┐
│          Franchise Setup - Retro Franchise Year              │
│                                                              │
│  What year does this franchise represent?                   │
│                                                              │
│  Auto-Detected Year: 2025                                   │
│  💡 Based on franchise file season year                     │
│                                                              │
│  Is this correct?                                           │
│  (•) Yes - Use 2025                                         │
│  ( ) No - Let me specify                                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Manual Year Entry:                                  │  │
│  │  Target Year: [1994]                                 │  │
│  │                                                       │  │
│  │  Range: 1920 - 2024                                  │  │
│  │                                                       │  │
│  │  💡 Tip: Set to the first year you want to play     │  │
│  │  (e.g., 1994 for a 1994 season start)               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  [Back]                                 [Next]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Retro Configuration

```
┌─────────────────────────────────────────────────────────────┐
│          Franchise Setup - Retro Configuration               │
│                                                              │
│  Target Year: 1994                                          │
│                                                              │
│  Historical Timeline:                                       │
│  (•) Use Historical Timeline (Recommended)                  │
│      Follow actual NFL history                              │
│      • Expansions happen in real years                      │
│      • Relocations happen in real years                     │
│      • Teams become active/inactive historically            │
│                                                              │
│  ( ) Custom Timeline                                        │
│      Modify timeline events (advanced)                      │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Active Teams in 1994:                                      │
│  ✓ 28 NFL teams active                                     │
│                                                              │
│  Inactive Teams:                                            │
│  • Jacksonville Jaguars (founded 1995)                      │
│  • Carolina Panthers (founded 1995)                         │
│  • Baltimore Ravens (founded 1996)                          │
│  • Houston Texans (founded 2002)                            │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Initial Setup:                                             │
│  [✓] Run pre-season setup now                              │
│      (Update team names, adjust draft picks, etc.)         │
│                                                              │
│  [✓] Load historical coaches                               │
│      (Replace generic coaches with 1994 coaching staffs)   │
│                                                              │
│  [✓] Load historical schedule                              │
│      (Use actual 1994 NFL schedule)                        │
│                                                              │
│  [Back]                                 [Setup Franchise]   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 5: Setup Progress

```
┌─────────────────────────────────────────────────────────────┐
│              Setting Up Retro Franchise...                   │
│                                                              │
│  Configuring franchise for 1994 season...                   │
│                                                              │
│  Progress:                                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ✓ Enabling retro mode                                │  │
│  │ ✓ Setting target year to 1994                        │  │
│  │ ⏳ Updating team names...                            │  │
│  │   • 28 teams configured                              │  │
│  │ ⏳ Adjusting draft picks...                          │  │
│  │   • Moving inactive team picks to end of draft       │  │
│  │ ⏳ Loading historical coaches...                     │  │
│  │   • 84 coaches loaded from database                  │  │
│  │ ⏳ Loading 1994 NFL schedule...                      │  │
│  │   • 224 games scheduled                              │  │
│  │ ⏳ Applying period-specific logos...                 │  │
│  │   • 28 team logos configured                         │  │
│  │                                                       │  │
│  │ Setup Progress: ████████░░ 80%                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  Please wait...                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step 6: Setup Complete

```
┌─────────────────────────────────────────────────────────────┐
│              Retro Franchise Setup Complete!                 │
│                                                              │
│  ✓ Your 1994 franchise is ready!                           │
│                                                              │
│  Configuration Summary:                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Mode: Retro Franchise                               │  │
│  │  Target Year: 1994                                   │  │
│  │  Timeline: Historical                                │  │
│  │  Active Teams: 28                                    │  │
│  │  Coaches: 84 historical coaches loaded              │  │
│  │  Schedule: 1994 NFL schedule (224 games)            │  │
│  │  Next Expansion: 1995 (Jaguars, Panthers)           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  What's Next?                                               │
│  • Edit rosters in Roster tab                              │
│  • Manage draft class in Draft Class tab                   │
│  • Use Retro tab for pre/post-season automation            │
│  • After offseason: Run Post-Draft Cleanup in Retro tab   │
│  • 1995 Pre-Season: Run Expansion Draft in Retro tab      │
│                                                              │
│  💡 The Retro tab is now visible with all retro tools      │
│                                                              │
│  [View Retro Guide]                         [Start Editing]│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Wizard Triggers

### Show Wizard When:
1. ✅ File is opened for first time (not in recent files)
2. ✅ No saved configuration exists for this file
3. ✅ User manually selects "Reconfigure Franchise" from File menu

### Skip Wizard When:
1. ❌ File is in recent files list (has saved config)
2. ❌ User checks "Don't show this again" in settings
3. ❌ File has `.madden-config` metadata file

---

## Configuration Storage

### Save franchise configuration to:
`%APPDATA%/madden-editor-suite/franchise-configs/{file-hash}.json`

**Example config:**
```json
{
  "filePath": "C:\\Users\\tshan\\Documents\\Madden Files\\CAREER-2025.file",
  "fileHash": "a3b5c7d9...",
  "mode": "retro",
  "targetYear": 1994,
  "timeline": "historical",
  "settings": {
    "autoRunPreSeason": true,
    "loadHistoricalCoaches": true,
    "loadHistoricalSchedule": true,
    "showInactiveTeams": false
  },
  "lastOpened": "2025-10-16T20:30:00Z",
  "created": "2025-10-16T20:25:00Z"
}
```

---

## Re-Configuration

### Allow users to change settings later:

**File Menu → Reconfigure Franchise**
```
┌─────────────────────────────────────────────────────────────┐
│              Reconfigure Franchise                           │
│                                                              │
│  Current Configuration:                                     │
│  • Mode: Retro Franchise                                    │
│  • Target Year: 1994                                        │
│  • Timeline: Historical                                     │
│                                                              │
│  [Change to Modern Mode]                                    │
│  [Change Target Year]                                       │
│  [Edit Timeline]                                            │
│  [Reset to Defaults]                                        │
│                                                              │
│  ⚠️ Warning: Changing mode may require re-setup             │
│                                                              │
│  [Cancel]                                  [Save Changes]   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Smart Detection

### Auto-Detect Retro Franchise

When file is opened, check:

```javascript
// Detect if franchise might be retro
function detectRetroFranchise(seasonInfo) {
  const currentYear = seasonInfo.CurrentSeasonYear;

  // If season year is old, likely retro
  if (currentYear < 2020) {
    return {
      isRetro: true,
      detectedYear: currentYear,
      confidence: 'high'
    };
  }

  // Check for inactive teams
  const inactiveTeams = getInactiveTeams();
  if (inactiveTeams.length > 0) {
    return {
      isRetro: true,
      detectedYear: calculateYearFromActiveTeams(),
      confidence: 'medium'
    };
  }

  return {
    isRetro: false,
    detectedYear: currentYear,
    confidence: 'high'
  };
}
```

**In wizard Step 2, suggest mode based on detection:**
```
┌─────────────────────────────────────────────────────────────┐
│              Franchise Setup - Mode Selection                │
│                                                              │
│  💡 We detected this might be a retro franchise              │
│     Season Year: 1994 (before modern era)                   │
│                                                              │
│  What type of franchise is this?                            │
│                                                              │
│  ( ) Modern Franchise                                       │
│  (•) Retro Franchise  ← Recommended based on detection     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Setup Option

### For experienced users, offer quick setup:

**Step 1 Alternative:**
```
┌─────────────────────────────────────────────────────────────┐
│              Opening Franchise File...                       │
│                                                              │
│  📂 File: CAREER-1994-RETRO                                 │
│                                                              │
│  Detected: Season Year 1994                                 │
│  Suggestion: Retro Franchise Mode                           │
│                                                              │
│  Quick Setup:                                               │
│  [Setup as Retro Franchise (1994)]  ← One-click setup      │
│                                                              │
│  or                                                         │
│                                                              │
│  [Custom Setup Wizard]              ← Full wizard           │
│  [Open as Modern Franchise]         ← Skip retro features   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Quick Setup auto-configures:**
- ✓ Enable retro mode
- ✓ Set target year from file
- ✓ Use historical timeline
- ✓ Run pre-season setup
- ✓ Load coaches and schedule
- ✓ Done in < 5 seconds

---

## Settings Toggle

### Allow disabling wizard in settings:

**Settings → General → Franchise Opening**
```
┌─────────────────────────────────────────────────────────────┐
│  Franchise File Opening                                      │
│                                                              │
│  First-Time Setup:                                          │
│  [✓] Show setup wizard for new franchise files             │
│  [ ] Auto-detect mode and skip wizard                      │
│  [ ] Always open as modern franchise                        │
│                                                              │
│  Retro Mode:                                                │
│  [✓] Auto-detect retro franchises by year                  │
│  Threshold: [< 2020] is considered retro                   │
│                                                              │
│  Recent Files:                                              │
│  [✓] Remember configuration for recent files               │
│  Keep: [10] recent files                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Wizard State Management

### Track wizard progress:

```javascript
const wizardState = {
  currentStep: 1,
  totalSteps: 6,
  selections: {
    mode: null,        // 'modern' or 'retro'
    targetYear: null,  // number
    timeline: null,    // 'historical' or 'custom'
    initialSetup: {
      runPreSeason: true,
      loadCoaches: true,
      loadSchedule: true
    }
  },
  detection: {
    gameVersion: 'M26',
    schemaVersion: '660.1',
    seasonYear: 1994,
    suggestedMode: 'retro'
  }
};
```

### Allow back button:
- Can go back to previous steps
- Selections are preserved
- Can change mind at any point

### Allow skip/cancel:
- "Skip Setup" button on first screen
- Opens in modern mode with defaults
- Can reconfigure later

---

## Summary

**User Experience:**
1. Open franchise file → Wizard appears
2. Detects year, suggests mode (modern or retro)
3. If retro: Set year, configure settings
4. Run initial setup automatically
5. Done! Start editing with proper mode enabled

**Key Features:**
- ✅ Smart detection (suggests retro if year < 2020)
- ✅ One-click quick setup for common scenarios
- ✅ Full wizard for custom configuration
- ✅ Can reconfigure anytime
- ✅ Remembers settings per file
- ✅ Can be disabled in settings

**Result:**
Users never have to manually enable retro mode or guess settings. The editor is smart enough to configure itself correctly.
