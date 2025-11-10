# Madden Ratings Import Design

**Date:** 2025-01-08
**Purpose:** Import missing years (2002, 2007, 2008, 2013-2020, 2022) of Madden ratings into ROSTER_lookup.csv with proper team labeling

## Background

Previous import attempts incorrectly labeled all players with wrong team values (e.g., all 2002 players labeled as "2002 roster" instead of their actual teams). This caused issues with the historical roster generators. This design ensures correct team labeling and safe data import.

## Requirements

### Data Sources
- `data/Madden Old Ratings/2002 Rosters.xlsx` - Single file with all teams
- `data/Madden Old Ratings/2007/` - 32 individual team files
- `data/Madden Old Ratings/2008/` - 32 individual team files
- `data/Madden Old Ratings/2013 Roster.xlsx` through `2022 Rosters.xlsx` - Single files

### Target Format
- **File:** `data/lookups/ROSTER_lookup.csv`
- **Team Format:** Short names (e.g., "Cardinals", "Bears", "49ers")
- **Free Agents:** Labeled as "[YEAR] Free Agents" (e.g., "2007 Free Agents")
- **Consistency:** Tampa Bay = "Buccaneers" (not "Bucs")
- **Total Columns:** 83 columns matching existing ROSTER_lookup.csv structure

## Architecture

### Workflow Phases

1. **Pre-flight Checks**
   - Verify all source files exist
   - Check ROSTER_lookup.csv is readable
   - Create timestamped backup: `ROSTER_lookup_BACKUP_YYYYMMDD_HHMMSS.csv`

2. **Validation Phase**
   - Parse all source files and validate structure
   - Check for missing columns, empty data, encoding issues
   - Generate summary report
   - **User approval required to continue**

3. **Dry-Run Phase**
   - Process all files WITHOUT modifying ROSTER_lookup.csv
   - Write to `ROSTER_lookup_PREVIEW.csv`
   - Show statistics per year
   - **User approval required to proceed**

4. **Import Phase**
   - Append validated data to existing ROSTER_lookup.csv
   - Sort by Year, Season_Team, Last_Name
   - Write final output

5. **Verification Phase**
   - Generate before/after comparison
   - Check for duplicates
   - Verify row counts

### Column Mapping

#### 2002 Format
```
Team → Season_Team (normalized)
First Name → First_Name
Last Name → Last_Name
Number → Jersey
Overall → POVR
Speed → PSPD
Acceleration → PACC
Strength → PSTR
Awareness → PAWR
Agility → PAGI
Catching → PCTH
Carrying → PCAR
Throw Power → PTHP
Throw Accuracy → (not available)
Pass Block → PPBK
Run Block → PRBK
Tackle → PTAK
Break Tackle → PBTK
Jumping → PJMP
Kick Power → PKPW
Kick Accuracy → PKAC
Injury → PINJ
Stamina → PSTA
Toughness → PTGH
Years Pro → YearsPro
Age → Age
Height → Height
Weight → Weight
```

#### 2007/2008 Format (PLYR_ prefix)
```
PLYR_FIRSTNAME → First_Name
PLYR_LASTNAME → Last_Name
PLYR_JERSEYNUM → Jersey
PLYR_OVERALLRATING → POVR
PLYR_SPEED → PSPD
PLYR_ACCELERATION → PACC
PLYR_STRENGTH → PSTR
PLYR_AGILITY → PAGI
PLYR_AWARENESS → PAWR
PLYR_CATCHING → PCTH
PLYR_CARRYING → PCAR
PLYR_THROWPOWER → PTHP
PLYR_THROWACCURACY → (single value, map to PTAS/PTAM/PTAD as same)
PLYR_KICKPOWER → PKPW
PLYR_KICKACCURACY → PKAC
PLYR_RUNBLOCK → PRBK
PLYR_PASSBLOCK → PPBK
PLYR_TACKLE → PTAK
PLYR_JUMPING → PJMP
PLYR_INJURY → PINJ
PLYR_STAMINA → PSTA
PLYR_TOUGHNESS → PTGH
PLYR_TRUCKING → PTRK
PLYR_ELUSIVENESS → PCOD
PLYR_BCVISION → PBCV
PLYR_STIFFARM → PSTF
PLYR_SPINMOVE → PSPM
PLYR_JUKEMOVE → PJUM
PLYR_IMPACTBLOCKING → PIBL
PLYR_RUNBLOCKSTRENGTH → PRBP
PLYR_RUNBLOCKFOOTWORK → PRBF
PLYR_PASSBLOCKSTRENGTH → PPBP
PLYR_PASSBLOCKFOOTWORK → PPBF
PLYR_POWERMOVES → PPWM
PLYR_FINESSEMOVES → PFNM
PLYR_BLOCKSHEDDING → PBSH
PLYR_PURSUIT → PPUR
PLYR_PLAYRECOGNITION → PPRC
PLYR_MANCOVERAGE → PMCV
PLYR_ZONECOVERAGE → PZCV
```

#### 2013+ Format
```
Similar to 2002 but with additional columns:
Spectacular Catch → PSPC
Catch in Traffic → PCIT
Route Running → PSRR (short route running)
Hit Power → PHTP
Press → PPRS
Release → PREL
Throw Accuracy Short → PTAS
Throw Accuracy Mid → PTAM
Throw Accuracy Deep → PTAD
Play Action → PPLA
Throw on Run → PTOR
```

### Team Name Normalization

```python
TEAM_NORMALIZATIONS = {
    # Full names to short names
    "Arizona Cardinals": "Cardinals",
    "Atlanta Falcons": "Falcons",
    "Baltimore Ravens": "Ravens",
    "Buffalo Bills": "Bills",
    "Carolina Panthers": "Panthers",
    "Chicago Bears": "Bears",
    "Cincinnati Bengals": "Bengals",
    "Cleveland Browns": "Browns",
    "Dallas Cowboys": "Cowboys",
    "Denver Broncos": "Broncos",
    "Detroit Lions": "Lions",
    "Green Bay Packers": "Packers",
    "Houston Texans": "Texans",
    "Indianapolis Colts": "Colts",
    "Jacksonville Jaguars": "Jaguars",
    "Kansas City Chiefs": "Chiefs",
    "Miami Dolphins": "Dolphins",
    "Minnesota Vikings": "Vikings",
    "New England Patriots": "Patriots",
    "New Orleans Saints": "Saints",
    "New York Giants": "Giants",
    "New York Jets": "Jets",
    "Oakland Raiders": "Raiders",
    "Philadelphia Eagles": "Eagles",
    "Pittsburgh Steelers": "Steelers",
    "San Diego Chargers": "Chargers",
    "San Francisco 49Ers": "49ers",
    "Seattle Seahawks": "Seahawks",
    "St. Louis Rams": "Rams",
    "Tampa Bay Buccaneers": "Buccaneers",
    "Tennessee Titans": "Titans",
    "Washington Redskins": "Redskins",

    # Variations
    "Bucs": "Buccaneers",
    "Free Agent": "{year} Free Agents",
}
```

## Error Handling

### Missing Files
- Log warning and skip year
- Continue with other years

### Malformed Data
- Skip rows missing both First Name and Last Name
- Skip rows missing Team
- Log all skips to `import_errors.log`

### Data Type Issues
- Numeric columns: Convert to int, default to 0 if invalid
- String columns: Strip whitespace, empty string if None

### Duplicate Detection
- Check: Year + Last_Name + First_Name + Season_Team
- If duplicate: Skip and log (preserve existing data)

## Output Files

- `ROSTER_lookup_BACKUP_[timestamp].csv` - Original backup
- `ROSTER_lookup_PREVIEW.csv` - Dry-run output for review
- `import_validation_report.txt` - Validation results
- `import_errors.log` - Skipped rows and errors

## Testing Strategy

1. **Manual Verification:**
   - Test team name normalizer with all variations
   - Verify column mapping for each year format

2. **Integration Testing:**
   - Run dry-run one year at a time
   - Verify output format
   - Check existing data preservation

3. **Verification Checks:**
   - Row count accuracy
   - No data corruption in existing rows
   - Complete imports (32 teams per year)
   - Column integrity (all 83 columns aligned)

## Safety Measures

- Backup always created before modifications
- Explicit user approval required after preview
- Duplicate detection prevents re-imports
- All intermediate files preserved for debugging
- Script can be run multiple times safely
