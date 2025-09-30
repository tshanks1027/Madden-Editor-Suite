# Madden Modding Tools Research Findings

## Executive Summary

This research documents all available Madden NFL modding resources for building a retro franchise editor. The primary reference is **bep713's madden-franchise ecosystem** (npm package + editor), which provides the most mature and complete JavaScript-based solution for parsing Madden franchise files. The MyFranchise extracted tool uses this library and serves as our closest architectural reference. Key findings:

- **Best Parsing Library**: `madden-franchise` npm package (v3.8.0+) by bep713 - MIT licensed, supports Madden 19-26
- **Primary Architecture Reference**: MyFranchise_extracted (Electron + Node.js + Handsontable + madden-franchise)
- **File Format Support**: TDB Legacy, TDB2 Compressed/Uncompressed, FBCH formats
- **Binary Parsing**: Uses zlib decompression, bit-buffer for binary manipulation, custom schema parsing
- **Retro Mod Reference**: 1994 Mod V2 includes 7 specialized tools for retro franchise management

## GitHub Repositories Analysis

### bep713/madden-franchise
**Repository**: https://github.com/bep713/madden-franchise

- **Language**: JavaScript/TypeScript (Node.js, migrated to ESM in v4.0.0)
- **License**: MIT License - FREE to use, modify, and distribute
- **Parsing Method**:
  - Decompresses franchise files using zlib
  - Parses binary table structures using BitView
  - Schema-driven parsing with auto-detection
  - Supports custom offset tables for field interpretation
- **Supported Formats**:
  - Franchise files (Madden 19-26)
  - FTC (Franchise-common) files
  - Handles compressed and uncompressed variants
- **Key Files/Classes**:
  - `FranchiseFile.js` - Main file parser class
  - `FranchiseFileTable.js` - Table structure handler
  - `FranchiseFileRecord.js` - Individual record parser
  - `FranchiseFileField.js` - Field-level parsing
  - `FranchiseSchema.js` - Schema management
  - `strategies/` - Game-specific parsing strategies
- **Binary Reading Utilities**:
  - Uses `bit-buffer` npm package for binary data manipulation
  - Custom BitView for reading binary fields
  - Supports zlib and zstd compression (via `@toondepauw/node-zstd`)
  - Fast-xml-parser for schema files
- **Code We Can Use**:
  - Complete franchise file parsing logic
  - Schema management system
  - Binary reading/writing utilities
  - Table and record abstraction
  - Reference tracking between records
- **Installation**: `npm i madden-franchise@3.8.0` (v3.x for CommonJS, v4.x for ESM)
- **Source Attribution**: Created by bep713 (matthewpanetta), MIT License

**Key API Usage**:
```javascript
import Franchise from 'madden-franchise';
let franchise = await Franchise.create(filePath, options);
let table = franchise.getTableByName('Player');
await table.readRecords(['FirstName', 'LastName']);
table.records[0].FirstName = 'John';
await franchise.save();
```

### bep713/madden-franchise-editor
**Repository**: https://github.com/bep713/madden-franchise-editor

- **Language**: JavaScript (Electron + Node.js)
- **License**: MIT License
- **Architecture**: Electron desktop app with Handsontable for data grids
- **This is the MyFranchise_extracted tool we have locally** (v4.5.9)
- **Parsing Method**: Uses `madden-franchise` npm package internally
- **Key Features**:
  - Schedule editor with historical NFL schedules (1970-2019)
  - Table editor for raw franchise data editing
  - Schema viewer
  - Offset tool for finding binary patterns
  - Auto-save functionality
  - Support for Madden 19-26
- **Files to Study**: See "Local Tools Analysis" section for detailed breakdown

### Sinthros/madden-franchise-utils
**Repository**: https://github.com/Sinthros/madden-franchise-utils

- **Language**: JavaScript (90.4%), Python (7.9%), Batchfile (0.8%)
- **License**: Not specified in repository overview
- **Parsing Method**: Uses `madden-franchise` API by bep713
- **Supported Formats**: Depends on madden-franchise library (franchise files)
- **Key Features**:
  - ~50+ specialized utility scripts organized by function
  - Examples: `assignVanityGear`, `bodyTypeFix`, `characterVisuals`, `updatePlayersWithLookup`, `rosterDataTransfer`
  - Node.js project structure (package.json)
- **Binary Reading**: Leverages madden-franchise API for low-level operations
- **Code We Can Use**:
  - Utility script patterns for specific franchise modifications
  - Examples of batch operations on franchise data
  - Demonstrates practical use cases of madden-franchise API
- **Source Attribution**: Built on top of bep713's madden-franchise API

### ethpec/MaddenTools
**Repository**: https://github.com/ethpec/MaddenTools

- **Language**: 100% Python
- **License**: No explicit license information
- **Framework**: Uses Pandas for data manipulation
- **Parsing Method**:
  - Vectorized functions to join to logic sheets
  - Determines skill/regression points based on player rating, position, season stats
- **Supported Formats**: Not explicitly specified (requires code inspection)
- **Key Files**:
  - `main.py` - Entry point
  - `AgeBasedProgression.py` - Age-based stat progression
  - `ContractFixer.py` - Contract management
  - `DraftClassEdit.py` - Draft class manipulation
  - `PreseasonRookieProgression.py` - Rookie development
  - `StatBasedEditor.py` - Stat-based progression
  - `requirements.txt` - Dependencies
- **Code We Can Use**:
  - Progression calculation algorithms
  - Contract validation logic
  - Draft class manipulation patterns
  - Statistical analysis approaches
- **Target Game**: Madden NFL 24
- **Source Attribution**: Python-based toolset for game management features

### kn1meR/MaddenRosterEditor
**Status**: Repository not found at https://github.com/kn1meR/MaddenRosterEditor

- **Search Results**: Could not locate this specific repository
- **Alternative**: kn1meR has "CFB-Dynasty-Manager" for College Football Dynasty tracking
- **Note**: May be private, renamed, or the URL is incorrect
- **Recommendation**: If this is a critical reference, need to verify the correct repository name/URL

### tshanks1027/MaddenRosterEditor
**Status**: 404 Not Found

- This appears to be your own repository that may not exist yet or is private
- Could be the target repository for this project

## Local Tools Analysis

### MyFranchise (PRIMARY REFERENCE)
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\MyFranchise_extracted`

- **Official Name**: madden-franchise-editor v4.5.9
- **Author**: bep713
- **Architecture**:
  - Electron 38.x desktop application
  - Node.js backend with main/renderer process separation
  - Handsontable v11.1.0 for data grid display
  - madden-franchise v3.4.1 for file parsing
- **Technology Stack**:
  - Main Process: Node.js with Electron IPC
  - Renderer Process: Vanilla JavaScript (no React/Vue)
  - File Parsing: madden-franchise npm package
  - Compression: lz4 (v0.6.5), built-in zlib
  - UI Components: Handsontable, custom vanilla JS
  - Data Export: xlsx (v0.17.5)
  - File Watching: chokidar (v3.5.3)
  - Auto-updates: electron-updater (v4.6.1)
  - Preferences: electron-preferences (v2.7.0)
- **Parsing Approach**:
  - Opens franchise file → reads raw Buffer
  - Detects file type (compressed/uncompressed, format)
  - Decompresses using zlib if needed
  - Loads schema from included schema files
  - Parses table structures with offset mapping
  - Creates FranchiseFile object with tables/records
  - Displays in Handsontable grid
- **Key Features**:
  - Schedule editor with historical schedules (1970-2019)
  - Table editor for raw data editing
  - Schema viewer and manager
  - Ability editor (Madden 20)
  - League editor
  - Auto-save on changes
  - Recent files tracking
  - Schema update detection
  - Excel export functionality
- **Code Patterns We Should Emulate**:
  1. **IPC Architecture**: Clear separation between main/renderer processes
  2. **Service Pattern**: Services organized by feature (welcomeService, tableEditorService, scheduleService, etc.)
  3. **Event-Driven**: Heavy use of EventEmitter for communication
  4. **Auto-Save**: Watches file changes and saves automatically
  5. **Tab Management**: Custom tab system for multiple editors
  6. **Preferences System**: Centralized settings management
  7. **Schema Management**: Auto-detects and manages game-specific schemas

- **File Structure**:
```
MyFranchise_extracted/
├── main.js                          # Electron main process
├── package.json                     # Dependencies and config
├── renderer/                        # Frontend code
│   ├── index.html                   # Welcome screen
│   ├── table-editor.html           # Table editor UI
│   ├── schedule.html               # Schedule editor UI
│   ├── ability-editor.html         # Ability editor UI
│   ├── league-editor.html          # League editor UI
│   ├── schema-viewer.html          # Schema viewer UI
│   ├── schema-manager.html         # Schema manager UI
│   └── js/
│       ├── index.js                # Entry point
│       ├── worker.js               # Background worker
│       └── services/               # Feature services
│           ├── welcomeService.js
│           ├── tableEditorService.js
│           ├── scheduleService.js
│           ├── abilityEditorService.js
│           ├── leagueEditorService.js
│           ├── schemaViewerService.js
│           ├── preferencesService.js
│           ├── recentFileService.js
│           ├── utilService.js
│           └── table-editor/
│               ├── TableEditorWrapper.js
│               ├── TableEditorView.js
│               ├── Loader.js
│               ├── ExternalDataHandler.js
│               └── custom-renderers/
│                   ├── reference/
│                   └── binary-blob/
├── data/                           # Data lookups
│   ├── offsets.json               # Binary field offsets
│   ├── teamData.json              # Team information
│   ├── seasonWeekData.json        # Season weeks
│   ├── dayOfWeekData.json         # Day mappings
│   ├── gameYearTableIdData.json   # Game year mappings
│   └── schemas/                   # Schema files
├── schedules/                      # Historical NFL schedules (1970-2019)
└── temp/                          # Temporary file backups
```

- **Files to Study in Detail**:
  1. `main.js` - Electron setup, IPC communication, window management
  2. `renderer/js/services/welcomeService.js` - File opening, recent files
  3. `renderer/js/services/tableEditorService.js` - Table editing core
  4. `renderer/js/services/table-editor/TableEditorWrapper.js` - Handsontable integration
  5. `renderer/js/services/scheduleService.js` - Schedule editing logic
  6. `renderer/js/franchise/FranchiseFile.js` - Custom franchise file abstraction
  7. `data/offsets.json` - Binary offset definitions for game fields

- **Notable Implementation Details**:
  - Uses worker window for background processing
  - Schema files stored in `data/schemas/` directory
  - Supports Madden 19-26 (configured in preferences)
  - Auto-backup to temp folder on file open
  - File watcher detects external changes
  - Preference storage in userData directory
  - Custom Handsontable renderers for references and binary data

### Head Coach Editor
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 26\Tools\Head Coach Editor`

- **Architecture**: Desktop application using WebView2
- **Technology**:
  - DeskGap framework (deskgap_winrt.dll, deskgap_wv2.dll)
  - WebView2Loader.dll (Microsoft Edge WebView2)
- **Files**:
  - `HC09Editor.exe` - Main executable
  - `HC09Editor.exe.WebView2/` - WebView2 runtime
  - `resources/` - Application resources
  - `log/` - Log files
- **Purpose**: Specialized editor for head coach data in Madden 09 format
- **Code Patterns**: Uses WebView2 for cross-platform UI rendering
- **Notes**: May contain useful patterns for head coach/staff editing features

### Modding Tools (Frosty MMC Editor & Manager)
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 26\Tools\Modding Tools`

- **MMC_Editor_v1.0.3.2**: Create and edit .fbmod files
- **MMC_ModManager_v1.0.3.2**: Apply and manage mods
- **Architecture**: WPF-based Frosty Editor (C#)
- **Key Components**:
  - `MMCEditor.exe` - Frosty-based mod editor
  - `FrostyCore.dll` - Core Frosty functionality
  - `FrostySdk.dll` - SDK for Frosty modding
  - `FrostyModSupport.dll` - Mod support library
  - `madden24.key`, `madden25.key`, `madden26.key` - Encryption keys
  - `Plugins/` - Editor plugins
  - `Profiles/` - Game profiles
  - `SharedTypeDescriptors.ebx` - Type descriptors
- **Supported Features**:
  - EBX (Entity Blueprint XML) editing
  - Texture editing (TexturePlugin.dll)
  - Asset browsing and modification
  - Mod packaging (.fbmod format)
- **File Format**: Works with FBCH format files
- **Anti-Cheat Bypass**: Custom EAAntiCheat.GameServiceLauncher.exe
- **Code We Can Learn From**:
  - Asset extraction patterns
  - Mod packaging/loading system
  - Game file encryption/decryption
  - Plugin architecture for extensibility
- **Note**: This is primarily for asset modding (visuals, gear, stadiums), not franchise data

### AC (Asset Compiler) Tool
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 26\Tools\Modding Tools\AC_(PUT IN M26 FOLDER)`

- **Purpose**: Asset compilation tool for Madden 26
- **Usage**: Copy to Madden 26 installation folder
- **Integration**: Works with MMC Editor/Manager for asset mods

## Utility Programs

### franchiseToRosterV0.3.exe
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 25\Tools\franchiseToRosterV0.3.exe`

- **Purpose**: Converts franchise save files to roster files
- **How It Fits Our Plan**: Phase 8 - Toolkit feature for roster extraction
- **Use Cases**:
  - Extract current roster state from franchise
  - Create roster snapshots at different franchise points
  - Share rosters without franchise save dependency
- **Implementation Notes**:
  - Needs to parse franchise Player table
  - Map to roster file format
  - Handle team assignments
  - Preserve attributes and ratings

### transferRetroSchedule.exe
**Location**: Multiple locations including 1994 Mod tools

- **Purpose**: Applies historical NFL schedules to franchise files
- **Functionality**:
  - Reads schedule data for specific season year
  - Updates SeasonGame table in franchise file
  - Handles non-existent teams (expansion teams)
  - Ensures historical accuracy
- **How It Fits Our Plan**: Phase 5 - Retro scheduling feature
- **Implementation Approach**:
  - Load historical schedule JSON/data
  - Parse franchise SeasonGame table
  - Map teams by historical accuracy
  - Write updated schedule data
- **Critical For**: Retro franchise mode accuracy

### presentationIdFixV3.0.exe (and earlier versions)
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 25\Tools\`

- **Purpose**: Fixes presentation/commentary ID numbers for players
- **Versions Available**: v1.5, v2.0, v3.0
- **How It Fits Our Plan**: Phase 3 - Commentary system
- **Functionality**:
  - Maps player names to commentary audio IDs
  - Updates PresentationId field in Player table
  - Ensures proper name calling during gameplay
- **Implementation Notes**:
  - Requires player name database
  - Maps to available commentary audio
  - Handles generic callouts for unmapped players
  - Critical for immersive retro experience

### bodyTypeFixV1.0.exe
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 25\Mods\1994 Mods\1994 Mod V2\Tools\`

- **Purpose**: Corrects player body types based on weight
- **Use Case**: Ensures 300+ lb players don't appear skinny
- **How It Fits Our Plan**: Phase 2 - Player attribute validation
- **Implementation**:
  - Read Player table
  - Check Weight field
  - Update BodyType field based on thresholds
  - Save changes
- **Logic**: Weight-based body type assignment (likely uses lookup table)

### commentaryIdFixV1.2.exe
**Location**: 1994 Mod V2 Tools

- **Purpose**: Stops players from being called incorrect names
- **How It Fits Our Plan**: Phase 3 - Commentary system enhancement
- **Functionality**: Similar to presentationIdFix but more advanced
- **Implementation**: Updates commentary mappings for accurate name calling

### HandleRetroPicks.exe
**Location**: 1994 Mod V2 Tools

- **Purpose**: Adjusts draft picks for retro seasons
- **Functionality**:
  - Moves expansion team picks to end of draft
  - Ensures non-existent teams don't draft high picks
  - Maintains historical draft order accuracy
- **How It Fits Our Plan**: Phase 4 - Draft class system
- **Implementation**:
  - Identify expansion teams by year
  - Reorder DraftPick table entries
  - Preserve existing team picks

### handleTeamNames.exe
**Location**: 1994 Mod V2 Tools

- **Purpose**: Updates team names based on season year
- **Examples**:
  - Houston Oilers → Tennessee Titans (1999+)
  - Washington Redskins → Washington Commanders (2022+)
  - Handles expansion teams (Texans, Jags, Panthers)
- **How It Fits Our Plan**: Phase 5 - Historical team accuracy
- **Implementation**:
  - Read current franchise year
  - Look up historical team names
  - Update Team table entries
  - Critical for year-to-year progression

### seasonYearSetup.exe
**Location**: 1994 Mod V2 Tools

- **Purpose**: Sets franchise to proper season year
- **How It Fits Our Plan**: Phase 5 - Franchise year management
- **Functionality**:
  - Updates franchise metadata
  - Sets current season year
  - Prepares franchise for year-specific adjustments
- **Run Timing**: Before starting each new season

### trimFreeAgents.exe
**Location**: 1994 Mod V2 Tools

- **Purpose**: Removes excess free agents to prevent draft class loading errors
- **How It Fits Our Plan**: Phase 4 - Draft class loading
- **Problem It Solves**: Madden has limits on total players; too many FAs prevent draft class imports
- **Implementation**:
  - Count total players
  - Identify low-rated free agents
  - Remove/empty Player table entries
  - Ensure space for draft class

### draftPickReset.exe
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 25\Tools\`

- **Purpose**: Resets draft pick assignments
- **How It Fits Our Plan**: Phase 4 - Draft system management
- **Use Case**: Fix corrupted draft orders or reset for testing

### playerAppearanceTransfer.exe
**Location**: Madden 25 Tools

- **Purpose**: Transfers player appearance data between files
- **How It Fits Our Plan**: Phase 6 - Visual customization
- **Implementation**: Copies appearance-related fields between Player records

### isonParserV1.0.exe
**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 25\Tools\isonParserV1.0.exe`

- **Purpose**: Parses ISON (internal Madden JSON-like) format files
- **How It Fits Our Plan**: Understanding Madden's internal data structures
- **Note**: May be useful for advanced schema/format analysis

## Test Files Inventory

**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\Madden Files`

### CAREER-AUG07-02h00m07p-AUTOSAVE
- **Size**: 5.5 MB
- **Format**: Compressed franchise file (likely TDB2)
- **Purpose**: Active franchise save with progression
- **Contains**: Full franchise state including teams, players, schedules, stats
- **Use For**: Testing complete franchise parsing and editing

### CAREERDRAFT-2026DRAFT7RND
- **Size**: 1.9 MB
- **Format**: Draft class file
- **Purpose**: 2026 7-round draft class
- **Contains**: Draft-eligible players with ratings, attributes, combine stats
- **Use For**: Testing draft class import/export, player creation

### ROSTER-Official
- **Size**: 6.1 MB
- **Format**: Roster file (TDB or TDB2)
- **Purpose**: Official roster snapshot
- **Contains**: Complete player roster with ratings, attributes, contracts
- **Use For**:
  - Primary testing file for Phase 1 roster editor
  - Baseline for comparison
  - Player data structure analysis

## Recommendations

### For Phase 1: Roster Editor
- **Primary Reference**: bep713/madden-franchise-editor (MyFranchise extracted)
- **Parsing Library**: Install `madden-franchise@3.8.0` npm package
- **Binary Reader**: Use `bit-buffer` npm package (already used by madden-franchise)
- **UI Component**: Handsontable v16.1.1 (already in your package.json)
- **Files to Adapt**:
  1. **From madden-franchise npm package**:
     - `FranchiseFile.js` - Main file parser (adapt for roster files)
     - `FranchiseFileTable.js` - Table parsing logic
     - `FranchiseFileRecord.js` - Record handling
     - Binary reading utilities from `bit-buffer`

  2. **From MyFranchise_extracted**:
     - `renderer/js/services/tableEditorService.js` - Table UI patterns
     - `renderer/js/services/table-editor/TableEditorWrapper.js` - Handsontable integration
     - `data/offsets.json` - Field offset reference (adapt for roster format)
     - `renderer/js/services/utilService.js` - Common utilities

  3. **Architecture Pattern**:
     - Electron main process for file I/O
     - IPC for main/renderer communication
     - Handsontable in renderer for data grid
     - Service-based organization

- **Implementation Approach**:
  1. Create `RosterFile.js` based on `FranchiseFile.js` patterns
  2. Implement table parsing for Player, Team tables
  3. Build Handsontable-based editor UI
  4. Add auto-save functionality
  5. Implement field validation

### For Phase 2: Player Attribute Validation
- **Reference Tools**: bodyTypeFixV1.0.exe logic
- **Data Source**: madden-franchise Player table schema
- **Implementation**:
  - Weight-based body type validation
  - Position-specific attribute ranges
  - Equipment validation by position
  - Use madden-franchise field min/max values

### For Phase 3: Commentary System
- **Reference Tools**: presentationIdFixV3.0.exe, commentaryIdFixV1.2.exe
- **Data Required**:
  - Player name to PresentationId mapping database
  - Commentary audio ID lookup table
- **Implementation**:
  - Build name matching algorithm
  - Map to available commentary IDs
  - Handle generic fallbacks
  - Batch update capability

### For Phase 4: Draft Class System
- **Test File**: CAREERDRAFT-2026DRAFT7RND
- **Reference Tools**: HandleRetroPicks.exe, trimFreeAgents.exe
- **Implementation**:
  - Parse draft class file format
  - Import/export functionality
  - Draft pick order management
  - Player slot management (trim FAs when needed)
  - Retro draft pick adjustment

### For Phase 5: Historical Accuracy
- **Reference Tools**:
  - transferRetroSchedule.exe - Schedule management
  - handleTeamNames.exe - Team naming by year
  - seasonYearSetup.exe - Year progression
- **Data Required**:
  - Historical schedule JSON files (available in MyFranchise schedules folder)
  - Team name history lookup table
  - Expansion team timeline
- **Implementation**:
  1. Historical schedule loader
  2. Team name updater by year
  3. Expansion team handler
  4. Year progression system

### For Phase 6: Visual Customization
- **Reference Tools**: playerAppearanceTransfer.exe
- **Implementation**:
  - Appearance field editor
  - Bulk appearance operations
  - Face ID management
  - Equipment assignment

### For Phase 7: Franchise Management
- **Primary Reference**: MyFranchise_extracted schedule and league editors
- **Implementation**:
  - Schedule editor (use MyFranchise schedules as reference)
  - Team editor
  - Coach editor
  - League structure editor

### For Phase 8: Toolkit Features
- **Reference Tools**: franchiseToRosterV0.3.exe
- **Implementation**:
  - Franchise to roster converter
  - Batch operations
  - Data validation tools
  - Export/import utilities

## Code Attribution Map

| Feature | Source Repository | Specific Files/Logic | License | Credit Line |
|---------|------------------|---------------------|---------|-------------|
| Franchise File Parsing | bep713/madden-franchise | FranchiseFile.js, FranchiseFileTable.js, FranchiseFileRecord.js | MIT | Based on madden-franchise by bep713 (matthewpanetta) |
| Binary Reading | bep713/madden-franchise | bit-buffer npm package usage | MIT | Uses bit-buffer library via madden-franchise |
| Table Editor UI | bep713/madden-franchise-editor | TableEditorWrapper.js, TableEditorView.js | MIT | Table editing patterns from madden-franchise-editor by bep713 |
| Handsontable Integration | bep713/madden-franchise-editor | Custom renderers, table editor service | MIT | Handsontable integration patterns from madden-franchise-editor |
| Schedule Editor | bep713/madden-franchise-editor | scheduleService.js, schedule data files | MIT | Historical schedule system from madden-franchise-editor |
| Schema Management | bep713/madden-franchise | FranchiseSchema.js, schema picker service | MIT | Schema parsing from madden-franchise |
| Utility Patterns | Sinthros/madden-franchise-utils | Various utility scripts | Not specified | Utility script patterns from madden-franchise-utils |
| Progression Algorithms | ethpec/MaddenTools | AgeBasedProgression.py, StatBasedEditor.py | None specified | Progression calculation approaches from MaddenTools |
| Body Type Validation | 1994 Mod V2 Tools | bodyTypeFixV1.0.exe logic | Not specified | Weight-based body type logic from 1994 Mod community |
| Commentary Mapping | 1994 Mod V2 Tools | commentaryIdFixV1.2.exe logic | Not specified | Commentary ID mapping from 1994 Mod community |
| Retro Draft System | 1994 Mod V2 Tools | HandleRetroPicks.exe logic | Not specified | Retro draft pick management from 1994 Mod community |
| Team Name History | 1994 Mod V2 Tools | handleTeamNames.exe logic | Not specified | Historical team naming from 1994 Mod community |
| Schedule Transfer | 1994 Mod V2 Tools | transferRetroSchedule.exe logic | Not specified | Retro schedule system from 1994 Mod community |

### Recommended Credit Section for Application

```
## Acknowledgments

This application builds upon the excellent work of the Madden modding community:

- **madden-franchise** by bep713 (matthewpanetta) - Core franchise file parsing library (MIT License)
- **madden-franchise-editor** by bep713 - Editor architecture and UI patterns (MIT License)
- **madden-franchise-utils** by Sinthros - Utility script patterns
- **MaddenTools** by ethpec - Progression and stat management algorithms
- **1994 Mod Community** - Retro franchise management tools and logic
  - Gamerr03, Ninja, Chunt04, Primetime02454, WiiMaster, Sinthros, and many others
- **Madden Modding Community (MMC)** - Ongoing support and tool development
- **Handsontable** - Data grid component (Commercial license required for production use)

Special thanks to the FootballIdiot forums and Operation Sports community for years of
Madden modding documentation and discoveries.
```

## Retro Mod Analysis (1994 Mod V2)

**Location**: `C:\Users\tshan\OneDrive\Documents\Madden Files\Madden 25\Mods\1994 Mods\1994 Mod V2`

### Project Structure
- **Mod File**: .fbmod file for Frosty Mod Manager (visual/asset mods)
- **Franchise File**: Pre-configured franchise save ready to play
- **Roster File**: 1994 roster snapshot
- **Draft Classes**: Multiple draft classes (1995 complete, others WIP)
  - Standard ratings version
  - Randomized ratings version
- **Tools**: 7 specialized utilities (documented above)
- **Portraits**: Player portraits for 1994 players
- **MFT Assets**: Logo assets for My Franchise Tool

### Team Credits (Valuable Community Contacts)
- **Project Managers**: Gamerr03, Ninja
- **Roster/Franchise**: Chunt04
- **Tools**: Primetime02454, WiiMaster, Sinthros
- **Visual Assets**: Multiple contributors

### Workflow for Retro Franchise (Our Target)
1. **Initial Setup**:
   - Load base mod (visual assets)
   - Import franchise file with 1994 roster
   - Set XP to zero for progression tool compatibility
   - Turn off Advanced Hair setting

2. **Every Offseason** (Critical sequence):
   1. Run `handleTeamNames` - Update team names for current year
   2. Run `seasonYearSetup` - Set proper season year
   3. Run `HandleRetroPicks` - Adjust draft picks (untested for Year 2+)
   4. Complete draft
   5. Run `bodyTypeFixV1.0` - Fix body types
   6. Run `transferRetroSchedule` - Load historical schedule

3. **Additional Tools**:
   - `commentaryIdFixV1.2` - Run when needed to fix commentary
   - `trimFreeAgents` - Run if draft class won't load

### Key Insights for Our Development
- **Critical Tool Sequence**: Order matters for retro progression
- **Year Management**: Must update teams/schedules each offseason
- **Draft Challenges**: Player limits require FA management
- **Testing Needed**: Year 2+ progression is experimental
- **Community Validation**: Extensive testing by mod community

## Technical Deep Dive: madden-franchise Package

### Architecture
```
madden-franchise/
├── FranchiseFile.js           # Main entry point
├── FranchiseFileTable.js      # Table abstraction
├── FranchiseFileRecord.js     # Record abstraction
├── FranchiseFileField.js      # Field abstraction
├── FranchiseSchema.js         # Schema parser
├── FranchiseEnum.js           # Enum definitions
├── Constants.js               # Constants and formats
├── services/
│   ├── utilService.js         # Utility functions
│   └── schemaPicker.js        # Schema selection
├── strategies/
│   ├── StrategyPicker.js      # Game version strategy selector
│   └── [version strategies]   # Version-specific parsing
└── data/                      # Schema files
```

### Key Concepts

1. **File Format Detection**:
   - Checks magic bytes for format identification
   - Supports: TDB Legacy, TDB2, FBCH, Franchise-common
   - Auto-detects compression (zlib, zstd)

2. **Schema System**:
   - XML-based schema files from Frosty extraction
   - Defines table structures, field types, offsets
   - Version-specific (Madden 19-26)
   - Auto-selection based on file metadata

3. **Table Structure**:
   - Header section (metadata)
   - Offset table (field definitions)
   - Record data (Table 1 - main data)
   - Table 2 (string/large data)
   - Table 3 (array data)
   - Empty record linked list

4. **Parsing Strategy**:
   - Read file signature → determine format
   - Decompress if needed
   - Parse table headers
   - Load schema
   - Map schema to offset table
   - Parse records on demand (lazy loading)
   - Track changes
   - Repack and save

5. **Memory Optimization**:
   - Lazy record loading (only load requested tables)
   - Selective field loading (specify fields to read)
   - Efficient buffer management

### Current Project Status

**Your Project**: madden-editor-suite v1.0.0

**Technology Stack**:
- Electron 38.1.2 (matches MyFranchise)
- Vite 5 (modern build tool)
- TypeScript 4.5
- Handsontable 16.1.1 (newer than MyFranchise's 11.1.0)
- SQLite3 for lookups
- Sharp for image processing
- React 19.1.1 (different from MyFranchise's vanilla JS)

**Key Differences from MyFranchise**:
- Uses React instead of vanilla JavaScript
- Uses Vite instead of direct Electron
- Has AG-Grid alongside Handsontable
- More modern TypeScript configuration
- Includes Three.js (for 3D features?)
- Already has some implementation (lookup-service.ts, field-definitions.js)

**What's Missing**:
- No madden-franchise npm package installed yet
- No binary parsers (BinaryReader, TDBFileValidator mentioned in CLAUDE.md but not found)
- No IPC handlers for file operations
- No table/roster parsing implementation
- No schema management

## Next Steps

### Immediate Actions (Phase 1 Setup)

1. **Install Core Dependencies**:
   ```bash
   npm install madden-franchise@3.8.0 --save
   npm install bit-buffer --save
   ```

2. **Study Reference Code**:
   - Read `MyFranchise_extracted/node_modules/madden-franchise/FranchiseFile.js`
   - Analyze `MyFranchise_extracted/renderer/js/services/tableEditorService.js`
   - Review `MyFranchise_extracted/data/offsets.json` structure

3. **Create Core Parser Architecture**:
   ```
   src/main/parsers/
   ├── RosterFileParser.ts       # Adapt FranchiseFile patterns
   ├── BinaryReader.ts            # Wrapper for bit-buffer
   └── FileFormatDetector.ts      # Format detection utilities

   src/main/ipc/
   ├── roster-handlers.ts         # Roster file operations
   └── parser-handlers.ts         # Generic parsing operations

   src/renderer/
   ├── components/
   │   └── RosterGrid.tsx         # Handsontable-based grid
   └── services/
       └── rosterService.ts       # Roster editing logic
   ```

4. **Test with ROSTER-Official File**:
   - Parse file structure
   - Extract Player table
   - Display in Handsontable
   - Implement basic editing
   - Test save functionality

5. **Build Minimal Viable Roster Editor**:
   - File open dialog
   - Player table display
   - Basic field editing
   - Save functionality
   - Backup before save

### Phase 2-8 Development Path

1. **Phase 2**: Leverage madden-franchise's schema system for validation
2. **Phase 3**: Build commentary database, implement presentationId logic
3. **Phase 4**: Adapt franchise draft class parsing for roster draft classes
4. **Phase 5**: Import MyFranchise schedules, implement transfer logic
5. **Phase 6**: Add appearance field editing to roster editor
6. **Phase 7**: Extend to full franchise file support (reuse madden-franchise)
7. **Phase 8**: Build utility tools using established parsing patterns

### Research Artifacts to Preserve

1. **MyFranchise_extracted folder** - Reference implementation
2. **1994 Mod V2** - End-goal reference with tools
3. **Test files** - Real-world data for testing
4. **Historical schedule data** - From MyFranchise schedules folder
5. **This research document** - Your roadmap

### Community Resources

- **FootballIdiot Forums**: Historical modding documentation
- **Operation Sports Forums**: Active Madden community
- **Madden Modding Community Discord**: Tool support and collaboration
- **GitHub Issues**: bep713's repos have valuable troubleshooting info

## Licensing Considerations

### Safe to Use (MIT License)
- madden-franchise (bep713)
- madden-franchise-editor (bep713)
- bit-buffer npm package

### Unknown/Unclear License
- Sinthros/madden-franchise-utils (no license specified)
- ethpec/MaddenTools (no license specified)
- 1994 Mod tools (community tools, no license)

### Commercial License Required
- Handsontable (free for non-commercial, license needed for commercial)

### Recommendation
- Use MIT-licensed code freely with attribution
- Study unlicensed tools for concepts, reimplement logic
- Document all code sources in credits
- Obtain Handsontable license if planning commercial release

## File Format Reference

### Madden File Signatures
- **TDB Legacy**: `54 44 42 00` ("TDB\0")
- **TDB2 Uncompressed**: `54 44 42 02` ("TDB\x02")
- **TDB2 Compressed**: zlib header `78 9C` or similar, then "TDB\x02" after decompression
- **FBCH**: `46 42 43 48` ("FBCH")
- **Franchise-common**: `.ftc` extension, contains metadata

### Compression
- **zlib**: Most common, built-in Node.js support
- **zstd**: Newer Madden versions, requires `@toondepauw/node-zstd`
- **lz4**: Used in some contexts, requires `lz4` npm package

### Table Structure Pattern
```
[Table Header]
- Magic bytes
- Table ID
- Table name
- Record count
- Field count
- Header size
- Record size

[Offset Table]
- Field index → offset mapping
- Field type definitions
- Min/max values
- Reference flags

[Record Data - Table 1]
- Fixed-size records
- Packed binary data

[String Data - Table 2] (optional)
- Variable-length strings
- Referenced from Table 1

[Array Data - Table 3] (optional)
- Array entries
- Referenced from Table 1

[Empty Record List]
- Linked list of unused records
```

## Conclusion

You have all the resources needed to build a comprehensive retro franchise editor:

1. **Proven parsing library** (madden-franchise) with MIT license
2. **Complete reference implementation** (MyFranchise extracted)
3. **Real-world tools** for every feature you want to build
4. **Test files** for validation
5. **Active community** for support

**Primary Development Path**:
Start with madden-franchise npm package as your parsing foundation, reference MyFranchise_extracted for UI/UX patterns, and incrementally add features validated against the 1994 Mod V2 workflow.

**Key Success Factor**:
Focus on Phase 1 (basic roster editor) first using ROSTER-Official test file. Once that works, everything else builds on the same foundation.

The madden-franchise package does 80% of the heavy lifting for file parsing. Your unique value-add will be the retro franchise management features inspired by the 1994 Mod tools.
