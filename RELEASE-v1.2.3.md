# Release v1.2.3 - FA Pool & Binary Save Fixes

## What's New in v1.2.3

### Major Fixes

- **FA Pool Generation**: Now respects template roster size instead of always generating 3000 players
  - Prevents leftover FAs from original roster
  - Fills template exactly with no wasted slots
  - Template loaded first to determine max player count

- **Binary Roster Save**: Implemented proper Madden 26 binary file saving using MaddenRosterHelper
  - No more JSON saves
  - Compatible with regular roster editor

- **Field Mapping Fix**: Corrected PSXP (Player Picture ID) vs PYRP (Years Pro) field mapping
  - PSXP now correctly maps to Player Picture ID
  - PYRP now correctly maps to Years Pro

### Features Added

- **Smart College Matching**: Abbreviation expansion handles 30+ patterns
  - Examples: "Florida St." → "Florida State", "Penn St." → "Penn State"
  - Improved college lookup accuracy

- **Non-Existent Team Support**: Teams that didn't exist in selected year get low ratings
  - Ravens (pre-1996): 30-40 OVR
  - Texans (pre-2002): 30-40 OVR
  - Jaguars/Panthers (pre-1995): 30-40 OVR
  - Makes retro franchise mode easier

- **Free Agent Team**: Added to team dropdown filter
  - Team ID: 1009
  - Makes filtering FAs easier

- **Multi-PC Workflow**: New scripts for easy setup on multiple computers
  - `setup-home-pc.bat` - Automated project setup
  - `sync.bat` - Quick git sync
  - `HOME-PC-SETUP.md` - Complete documentation

### Technical Improvements

- Template roster loaded first to determine max player count
- FA generation uses dynamic calculation: `maxPlayers - teamPlayerCount`
- Position array cycling with modulo operator for unlimited fictional players
- Enhanced debug logging for FA generation in `scraper-debug.log`

### Installation

**For Developers (Recommended):**
1. Clone or download this repository
2. Run `npm install`
3. Run `npm start`
4. Updates are easy: `git pull` + `npm install` + `npm start`

**For End Users (Packaged Version):**
- Packaged `.exe` releases coming soon
- For now, follow developer instructions above

### Note About Releases

GitHub release downloads provide source code only. To run the app:
- You need Node.js installed
- Run `npm install` then `npm start` in the project folder

### Full Changelog

- `d817e82` - Fix roster creator: FA pool, field mapping, binary save, and multi-PC setup
- `8afa50d` - Fix FA generation to respect template roster size
- `8f8df53` - Bump version to 1.2.3

---

**GitHub Repository**: https://github.com/tshanks1027/Madden-Editor-Suite

🤖 Generated with [Claude Code](https://claude.com/claude-code)
