# Build Enhanced Lookup Script

## Purpose

This script scrapes comprehensive player data from Pro Football Reference to build an enhanced version of `FullData_Lookup.csv` that includes:

- **Physical Stats**: Height, Weight
- **Career Stats**: From (first year), To (last year), AP1 (All-Pro 1st Team), PB (Pro Bowls), St (Years Started), wAV (Weighted Approximate Value)
- **League**: NFL or AFL designation

## Coverage

- **AFL Drafts**: 1960-1969 (10 years)
- **NFL Drafts**: 1994-2024 (31 years)
- **Total**: 41 draft years

## How It Works

### Phase 1: Draft Table Scraping (~2-3 minutes)
- Visits each draft year page on Pro Football Reference
- Extracts player data from draft tables
- Collects player page links for physical data scraping
- Rate limited to 2 seconds between draft years

### Phase 2: Player Physical Data Scraping (~2-4 hours)
- Visits individual player pages to extract height/weight
- Only scrapes players with valid player links
- Rate limited to 3 seconds between player pages
- Progress reported every 50 players
- **This is slow but only needs to be done once!**

### Phase 3: Data Merging
- Loads existing `FullData_Lookup.csv`
- Preserves existing PID and PLPO mappings
- Adds new columns with scraped data
- Outputs to `FullData_Lookup_Enhanced.csv`

## Running the Script

```bash
cd madden-editor-suite
node scripts/build-enhanced-lookup.js
```

## Expected Runtime

- **Draft table scraping**: ~2-3 minutes (41 years × 2 seconds)
- **Physical data scraping**: ~2-4 hours (depends on number of players with links)
- **Total**: 2-4 hours

## Output

Creates `data/lookups/FullData_Lookup_Enhanced.csv` with format:

```csv
Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,PhotoID,Player Assets ID,CommID,PresID,PLPO,Height,Weight,From,To,AP1,PB,St,wAV,League
```

## After Running

1. **Review** the enhanced CSV file
2. **Backup** the original `FullData_Lookup.csv`
3. **Replace** original with enhanced version
4. **Update generators** to use new columns for:
   - Physical attributes (height/weight)
   - Career tiering (AP1, PB, St, wAV)
   - Year range filtering (From, To)

## Benefits

- **Faster generation**: Lookup data instead of web scraping
- **More accurate**: Real NFL data from Pro Football Reference
- **Better ratings**: Use AP1/PB/St/wAV to tier player overalls
- **Historical accuracy**: AFL and vintage NFL players included
