# Scrape Agent

## Purpose
Web scraping and data integration from pro-football-reference.com and other historical NFL sources to populate accurate retro data for rosters, stats, and records.

## Capabilities
- Scrape historical player statistics and biographical data
- Extract coach records and career information
- Gather team records and historical standings
- Download draft class data from specific years
- Process salary cap and financial information
- Validate and clean scraped data for Madden integration

## Usage

### Player Data Scraping
```bash
/scrape-players 1985                    # Scrape all players from 1985 season
/scrape-player "Joe Montana"            # Scrape specific player career
/scrape-rookies 1985                    # Scrape rookie class from 1985
/scrape-stats passing 1985              # Scrape passing stats for year
```

### Coach Data Scraping
```bash
/scrape-coaches 1985                    # Scrape all coaches from 1985
/scrape-coach "Bill Walsh"              # Scrape specific coach record
/scrape-coaching-changes 1980-1990     # Track coaching changes
```

### Team Data Scraping
```bash
/scrape-teams 1985                      # Scrape team records for 1985
/scrape-standings NFC 1985              # Scrape conference standings
/scrape-playoffs 1985                   # Scrape playoff bracket
```

### Draft Data Scraping
```bash
/scrape-draft 1985                      # Scrape complete 1985 draft
/scrape-draft-round 1 1985              # Scrape first round only
/scrape-draft-position QB 1985          # Scrape QBs drafted in 1985
```

### Historical Data Validation
```bash
/validate-data 1985                     # Validate all 1985 data integrity
/cross-reference players 1985           # Cross-reference player data
/clean-data duplicates                  # Remove duplicate entries
```

## Data Sources

### Primary Sources
- **Pro-Football-Reference.com**
  - Player statistics and biographical data
  - Team records and standings
  - Draft information
  - Coaching records

- **NFL.com Historical Data**
  - Official records
  - Award winners
  - Hall of Fame information

### Secondary Sources
- **Sports-Reference Networks**
  - Additional statistical context
  - Advanced metrics
  - Historical context

- **Archived Media Sources**
  - Historical roster information
  - Trade and transaction data
  - Injury reports

## Data Processing

### Player Information
- **Biographical Data**
  - Full name and nicknames
  - Birth date and location
  - College attended
  - Draft information
  - Career span

- **Physical Attributes**
  - Height and weight
  - Position(s) played
  - Jersey number(s)
  - Handedness/throwing arm

- **Career Statistics**
  - Season-by-season stats
  - Career totals
  - Awards and honors
  - Pro Bowl selections

### Team Information
- **Franchise Data**
  - Team names and relocations
  - Uniform colors and designs
  - Stadium information
  - Ownership changes

- **Season Records**
  - Win-loss records
  - Point differentials
  - Strength of schedule
  - Playoff appearances

### Coach Information
- **Career Records**
  - Win-loss records by team
  - Playoff appearances
  - Championships won
  - Career longevity

- **Coaching Philosophy**
  - Offensive/defensive schemes
  - Player development history
  - Team building approach

## Scraping Technology

### Web Scraping Framework
- **Puppeteer** - JavaScript execution and dynamic content
- **Playwright** - Cross-browser testing and reliability
- **Custom Parsers** - Specialized data extraction
- **Rate Limiting** - Respectful scraping practices

### Data Processing Pipeline
1. **URL Generation** - Create target URLs for scraping
2. **Page Loading** - Handle JavaScript and dynamic content
3. **Data Extraction** - Parse HTML and extract relevant data
4. **Data Cleaning** - Normalize and validate extracted data
5. **Deduplication** - Remove duplicate entries
6. **Format Conversion** - Convert to Madden-compatible formats

### Error Handling
- **Retry Logic** - Handle temporary failures
- **Captcha Detection** - Detect and handle anti-bot measures
- **Rate Limiting** - Respect website terms of service
- **Data Validation** - Ensure data integrity

## Madden Integration

### Data Mapping
- **Player Attributes** - Map real stats to Madden ratings
- **Position Mapping** - Convert real positions to Madden positions
- **Team Assignment** - Accurate historical team rosters
- **Salary Data** - Historical salary cap information

### Format Conversion
- **Roster Files** - Generate .ros files with scraped data
- **Draft Classes** - Create .dcl files from draft data
- **Franchise Data** - Populate historical franchise files

### Quality Assurance
- **Data Validation** - Cross-reference multiple sources
- **Historical Accuracy** - Ensure period-appropriate information
- **Completeness Checks** - Identify missing data gaps
- **User Verification** - Allow manual verification of key data

## Caching and Storage

### Local Database
- **SQLite Storage** - Cache scraped data locally
- **Update Tracking** - Track when data was last updated
- **Version Control** - Maintain data versioning
- **Backup System** - Automatic data backup

### Performance Optimization
- **Incremental Updates** - Only scrape new/changed data
- **Parallel Processing** - Multi-threaded scraping
- **Memory Management** - Efficient data processing
- **Progress Tracking** - Real-time scraping progress

## Legal and Ethical Considerations

### Terms of Service Compliance
- **Rate Limiting** - Respectful request frequency
- **User Agent Declaration** - Proper identification
- **Robot.txt Compliance** - Respect website preferences
- **Fair Use** - Educational and personal use only

### Data Attribution
- **Source Citation** - Credit data sources appropriately
- **Copyright Respect** - Respect intellectual property
- **Community Sharing** - Share processed data with community
- **Transparency** - Document data processing methods