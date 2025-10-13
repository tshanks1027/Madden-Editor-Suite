# Home PC Setup Guide

## First Time Setup on Home PC

### Step 1: Install Prerequisites
1. **Node.js** - Download from https://nodejs.org/ (use LTS version)
2. **Git** - Download from https://git-scm.com/

### Step 2: Clone Repository
```bash
# Open Command Prompt or PowerShell
cd "C:\Users\YourUsername\Documents\Madden Files"

# Clone the repository
git clone https://github.com/tshanks1027/Madden-Editor-Suite.git

# Navigate into the project
cd Madden-Editor-Suite
```

### Step 3: Copy Required Files
Copy these files from your other PC (via USB drive or OneDrive):

**Lookup Files:**
- From: `Lookups\college_lookup.csv`
- From: `Lookups\state_lookup.csv`
- From: `Lookups\pid_lookup.csv`
- To: `[Home PC]\Madden-Editor-Suite\Lookups\`

**Madden 26 Template:**
- From: `Documents\Madden NFL 26\Saves\ROSTER-Official`
- To: `[Home PC]\Documents\Madden NFL 26\Saves\ROSTER-Official`

### Step 4: Run Setup Script
```bash
# In the Madden-Editor-Suite folder
setup-home-pc.bat
```

### Step 5: Start the App
```bash
npm start
```

---

## Daily Workflow

### Before Starting Work (Pull Latest Changes)
```bash
git pull
npm install  # Only if package.json changed
npm start
```

### After Finishing Work (Push Changes)

**Option 1: Quick Sync (Automatic)**
```bash
sync.bat
```
This will automatically commit and push all changes with a timestamp.

**Option 2: Custom Message**
```bash
sync.bat "Fixed roster save bug"
```

**Option 3: Manual (More Control)**
```bash
git add .
git commit -m "Description of what you changed"
git push
```

---

## Troubleshooting

### "Module not found" errors
```bash
npm install
```

### "Lookup file not found" errors
Make sure you copied all the CSV files from the Lookups folder.

### Git conflicts
If you have uncommitted changes on one PC and pull on another:
```bash
git stash        # Save your current changes
git pull         # Pull latest
git stash pop    # Reapply your changes
```

### Need to start fresh
```bash
# Delete the local repository
# Clone again from GitHub
git clone https://github.com/tshanks1027/Madden-Editor-Suite.git
```

---

## Tips for Working on Multiple PCs

1. **Always sync before starting work** - Run `git pull` or `sync.bat`
2. **Always sync after finishing** - Run `sync.bat` before shutting down
3. **Don't leave uncommitted changes** - Always commit before switching PCs
4. **Keep CLAUDE.md updated** - Claude reads this on every PC to understand the project

---

## What to Tell Claude When Starting on Home PC

When you open the project in Claude Code on your home PC, just say:

> "I just cloned the repo on my home PC. Continue where we left off."

Claude will:
- Read CLAUDE.md automatically
- Understand the full project context
- Know all the rules and workflows
- Be able to continue development seamlessly
