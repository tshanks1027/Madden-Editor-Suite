# Madden Editor Suite - Draft Prospect Scraper

A comprehensive web scraping tool to collect future NFL draft prospect data for Madden roster editing.

## Overview

This tool scrapes college football player data and recruiting rankings to predict future NFL draft classes (2026-2030+). It combines current college statistics with recruiting rankings to make educated predictions about draft positioning.

## Data Sources

### Current College Players (2026-2030 Draft Classes)
- **Sports Reference College Football** - Comprehensive stats and player information
- **ESPN College Football** - Stats, rankings, and player profiles
- **247Sports** - Recruiting rankings and player ratings

### Future Prospects (2031+ Draft Classes)
- **247Sports** - High school recruiting rankings and commitments
- **Rivals** - Alternative recruiting rankings (optional)

## Features

- Scrapes comprehensive player data matching your schema
- Predicts draft round/pick based on stats and recruiting rankings
- Finds player images from multiple sources
- Handles multiple draft classes in batch
- Exports to CSV format matching your data structure
- Configurable scraping parameters
- Rate limiting and ethical scraping practices

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd Madden-Editor-Suite

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Basic Usage

```bash
# Scrape prospects for 2026 draft class
python src/main.py --year 2026

# Scrape multiple years
python src/main.py --years 2026 2027 2028 2029 2030

# Include future recruiting classes
python src/main.py --years 2026-2035 --include-recruiting
```

### Configuration

Edit `config/scraper_config.yaml` to customize:
- Data sources priority
- Scraping intervals and rate limits
- Draft prediction weights
- Position mappings
- Output format

### Output

Data is exported to `output/draft_class_YYYY.csv` with the following fields:
- Last Name, First Name
- College/University
- Round, Pick (predicted)
- Draft Class
- Position
- Height, Weight
- Stats and performance metrics
- Photo URLs
- And more...

## Project Structure

```
Madden-Editor-Suite/
├── src/
│   ├── scrapers/
│   │   ├── base_scraper.py       # Base scraper class
│   │   ├── sports_reference.py   # Sports Reference scraper
│   │   ├── espn_scraper.py       # ESPN scraper
│   │   └── recruiting_scraper.py # 247Sports/Rivals scraper
│   ├── models/
│   │   └── prospect.py           # Data model for prospects
│   ├── prediction/
│   │   └── draft_predictor.py    # Draft position prediction
│   ├── utils/
│   │   ├── http_client.py        # HTTP client with rate limiting
│   │   └── data_mapper.py        # Map scraped data to schema
│   └── main.py                   # Main entry point
├── config/
│   └── scraper_config.yaml       # Configuration file
├── output/                        # Output directory for CSV files
├── requirements.txt
└── README.md
```

## Data Schema

The scraper populates the following fields:

| Field | Source | Notes |
|-------|--------|-------|
| Last Name | Scraped | From player profiles |
| First Name | Scraped | From player profiles |
| College/Univ | Scraped | Current or committed school |
| Round | Predicted | Based on rankings/stats |
| Pick | Predicted | Based on rankings/stats |
| Draft Class | Input | Year specified |
| Position | Scraped | Normalized to Madden positions |
| Height | Scraped | From profiles |
| Weight | Scraped | From profiles |
| PhotoID | Generated | Hash of image URL |
| Wiki_Image_URL | Scraped | Player photo URLs |
| PFR_Image_URL | Scraped | Sports Reference photo |

## Prediction Logic

Draft round/pick predictions are based on:
1. **Recruiting Rankings** (for future classes)
   - 5-star → projected 1st round
   - 4-star → projected 1st-3rd round
   - 3-star → projected 3rd-7th round

2. **College Performance** (for current college players)
   - Statistical analysis (yards, TDs, efficiency)
   - All-American honors
   - Conference awards
   - Starting experience

3. **Mock Draft Data** (when available)
   - Aggregated from multiple sources

## Legal and Ethical Considerations

- Respects robots.txt
- Implements rate limiting
- Caches responses to minimize requests
- For personal/educational use only
- Verify terms of service for each data source

## Contributing

Contributions welcome! Please submit issues or pull requests.

## License

See LICENSE file for details.
