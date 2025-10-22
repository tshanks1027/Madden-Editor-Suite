# Enhanced Lookup Scraper V2 - User Controls

## What This Scraper Does

Scrapes Pro Football Reference for **all 11,140 players** from 41 draft years (AFL 1960-1969, NFL 1994-2024) and collects:

- **Height** - e.g., "6-2"
- **Weight** - e.g., "215"
- **Career Stats** - From (first year), To (last year), AP1 (All-Pro First Team), PB (Pro Bowls), St (Years Started), wAV (Weighted Approximate Value)
- **Race/Ethnicity** - Detected from birthplace (for generic face matching)
- **Hometown** - Birth city/state for roster editor
- **Preserves existing PID/PLPO** - Keeps photo ID mappings from original lookup

## Files Created

| File | Purpose |
|------|---------|
| `data/lookups/enhanced_lookup_FINAL.csv` | **Main output** - Appended in real-time (NO data loss) |
| `data/lookups/scraper_checkpoint.json` | Resume point (year + player count) |
| `data/lookups/scraper_progress.txt` | **Live stats** - Check anytime to see progress |
| `data/lookups/PAUSE` | **Control file** - Create to pause scraper |

## How to Run

```bash
cd madden-editor-suite
python scripts/build-enhanced-lookup-v2.py
```

## Controls You Have

### ⏸ PAUSE (Stop Gracefully)

**To pause the scraper:**
1. Create an empty file: `data/lookups/PAUSE`
2. Scraper will finish current player and stop
3. All progress is saved automatically

**Windows command:**
```cmd
cd madden-editor-suite\data\lookups
type nul > PAUSE
```

**To resume after pausing:**
1. Delete the `PAUSE` file
2. Run the script again
3. It automatically resumes from checkpoint

### 📊 CHECK PROGRESS (Anytime)

**View live progress:**
```cmd
type data\lookups\scraper_progress.txt
```

**Shows:**
- Current year and player being processed
- Total players processed
- Players with height/weight data
- Players with race data
- Estimated time remaining
- Rate (players per second)

### 🔄 RESUME FROM CRASH

If the scraper crashes or you stop it:
1. Just run the script again
2. It **automatically resumes** from last checkpoint
3. Skips years already completed
4. Continues appending to CSV

**No data is lost!** Every player is written to CSV immediately.

### 🔥 START FRESH (From Beginning)

To completely restart:
```cmd
cd madden-editor-suite\data\lookups
del enhanced_lookup_FINAL.csv
del scraper_checkpoint.json
del scraper_progress.txt
```

Then run the script again.

## What Gets Saved

### CSV Output Format

```csv
Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,PhotoID,Player Assets ID,CommID,PresID,PLPO,Height,Weight,From,To,AP1,PB,St,wAV,League,Race,Hometown
Manning,Peyton,Tennessee,1,1,1998,QB,1234,5678,,,8901,6-5,230,1998,2015,7,14,17,172,NFL,,New Orleans LA
Brady,Tom,Michigan,6,199,2000,QB,2345,6789,,,9012,6-4,225,2000,2022,3,15,18,163,NFL,,San Mateo CA
```

### Race Detection Logic

Race is detected from hometown using these heuristics:
- **Black** - Nigeria, Ghana, Haiti, Jamaica, Bahamas, etc.
- **Pacific** - Samoa, Tonga, Fiji, Hawaii
- **Asian** - China, Japan, Korea, Vietnam, Thailand, Philippines
- **Hispanic** - Mexico, Puerto Rico, Cuba, Dominican Republic, etc.
- **Empty** - US-born players (can't reliably determine from location alone)

**Note:** For US-born players, race will be empty and you'll need to match generic faces manually or use photo analysis later.

## Reliability Features

### ✅ No Data Loss
- Every player written to CSV **immediately** after scraping
- Even if script crashes, you keep all data scraped so far

### ✅ Resilient Requests
- 5 automatic retries with exponential backoff (1s, 2s, 4s, 8s, 16s)
- 30-second timeout per request
- Continues on errors instead of crashing

### ✅ Checkpoint System
- Saves checkpoint after **every draft year**
- Tracks exact year index and player count
- Resume picks up from last completed year

### ✅ Rate Limiting
- 2-second delay between player page requests
- 3-second delay between draft year requests
- Prevents getting blocked by Pro Football Reference

## Expected Runtime

**Estimated time:** 6-8 hours for all 11,140 players

**Math:**
- ~9,050 players with player page links
- ~2 seconds per player page
- = ~5 hours minimum
- Plus draft table scraping (~20 minutes)
- Plus retries/errors buffer

**You can check live progress in `scraper_progress.txt` for time remaining estimate.**

## Troubleshooting

### "No existing FullData_Lookup.csv found"
⚠ This is OK! The script will create a new file without PID/PLPO mappings. You can merge them later.

### Script seems stuck
1. Check `scraper_progress.txt` - shows current player
2. If same player for 5+ minutes, might be retrying failed requests
3. Create `PAUSE` file to stop gracefully
4. Check network connection
5. Resume when ready

### Getting blocked by Pro Football Reference
- Script has 2-3 second delays to prevent this
- If you get 429 errors, increase `time.sleep(2)` to `time.sleep(5)` in the script
- Pause for 15 minutes then resume

### CSV has missing data (empty Height/Weight)
- This is normal for players without PFR profiles
- Usually older AFL players or undrafted players
- The script tries 5 times before giving up
- Check error count in `scraper_progress.txt`

## After Scraping Completes

1. **Review the output:**
   ```cmd
   head data\lookups\enhanced_lookup_FINAL.csv
   ```

2. **Check stats in final progress file:**
   ```cmd
   type data\lookups\scraper_progress.txt
   ```

3. **Backup original lookup:**
   ```cmd
   copy data\lookups\FullData_Lookup.csv data\lookups\FullData_Lookup.BACKUP.csv
   ```

4. **Replace with enhanced version:**
   ```cmd
   copy data\lookups\enhanced_lookup_FINAL.csv data\lookups\FullData_Lookup.csv
   ```

5. **Clean up checkpoint files:**
   ```cmd
   del data\lookups\scraper_checkpoint.json
   del data\lookups\scraper_progress.txt
   ```

## Summary

**You are in full control:**
- ⏸ **Pause anytime** by creating `PAUSE` file
- 📊 **Check progress anytime** by reading `scraper_progress.txt`
- 🔄 **Resume anytime** by just restarting the script
- 🛡️ **No data loss** - every player saved immediately
- ⚡ **Reliable** - 5 retries on every request, continues on errors

**The scraper saves as it goes, so you can trust it to run overnight without losing work.**
