# Quick Start Guide

This guide will help you get started with the Draft Prospect Scraper in just a few minutes.

## Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd Madden-Editor-Suite
```

2. **Install dependencies:**
```bash
pip install -r requirements.txt
```

That's it! You're ready to start scraping.

## Basic Usage

### Scrape a Single Draft Class

Scrape prospects for the 2026 NFL Draft:

```bash
python src/main.py --years 2026
```

Output will be saved to: `output/draft_class_2026.csv`

### Scrape Multiple Years

Scrape prospects for 2026, 2027, and 2028:

```bash
python src/main.py --years 2026 2027 2028
```

### Scrape a Range of Years

Scrape all years from 2026 to 2030:

```bash
python src/main.py --year-range 2026-2030
```

### Default Behavior

If you don't specify years, it will scrape the next 5 draft classes:

```bash
python src/main.py
```

## Understanding the Output

The scraper generates CSV files in the `output/` directory. Each file contains:

### Required Fields
- **Last Name, First Name** - Player's name
- **College/Univ** - Current/committed school
- **Position** - Madden-formatted position
- **Draft Class** - Year of draft

### Predicted Fields
- **Round** - Predicted draft round (1-7)
- **Pick** - Predicted overall pick number

### Physical Attributes
- **Height** - Player height (format: "6-2")
- **Weight** - Player weight in pounds

### Additional Data
- **Home State** - Player's home state
- **Wiki_Image_URL** - Player photo URL
- **PFR_Image_URL** - Sports Reference photo URL

## How Draft Predictions Work

The scraper uses different data sources based on how far out the draft is:

### Near-term Drafts (2026-2030)
Uses **Sports Reference** to get current college player stats:
- Looks at junior and senior college players
- Analyzes performance statistics
- Considers conference and national awards

### Far-future Drafts (2031+)
Uses **247Sports** recruiting rankings:
- 5-star recruits → Projected 1st round
- 4-star recruits → Projected 1st-3rd round
- 3-star recruits → Projected 3rd-7th round

### Prediction Factors
1. **Recruiting Rankings** (35%) - Star rating and composite score
2. **College Performance** (40%) - Stats, awards, playing time
3. **Awards & Honors** (15%) - All-American, All-Conference, etc.
4. **Mock Drafts** (10%) - Aggregated mock draft data (when available)

## Configuration

Edit `config/scraper_config.yaml` to customize:

### Adjust scraping speed
```yaml
scraping:
  rate_limit_seconds: 2.0  # Increase for slower scraping
  timeout_seconds: 30
```

### Change prediction weights
```yaml
prediction:
  recruiting_rank_weight: 0.35
  college_stats_weight: 0.40
  awards_weight: 0.15
  mock_drafts_weight: 0.10
```

### Enable/disable data sources
```yaml
data_sources:
  sports_reference:
    enabled: true
  recruiting_247:
    enabled: true
```

## Example Output

Here's what a typical prospect looks like in the CSV:

| Last Name | First Name | College | Round | Pick | Position | Height | Weight | Stars |
|-----------|------------|---------|-------|------|----------|--------|--------|-------|
| Smith | John | Ohio State | 1 | 15 | QB | 6-3 | 215 | 5 |
| Johnson | Mike | Alabama | 2 | 38 | WR | 6-1 | 190 | 4 |
| Williams | Chris | Georgia | 1 | 7 | DE | 6-5 | 265 | 5 |

## Troubleshooting

### No prospects found
- Check your internet connection
- Verify the year is valid (not too far in the past/future)
- Enable verbose logging: `python src/main.py --years 2026 --verbose`

### Rate limiting errors
- Increase `rate_limit_seconds` in config
- The scraper respects site terms of service

### Missing data
- Some fields may not be available for all players
- Future prospects (recruiting rankings) have less complete data
- The scraper fills in what it can find

## Next Steps

1. **Customize predictions** - Edit the prediction weights in config
2. **Add more data sources** - Extend the scraper to use ESPN, On3, etc.
3. **Integrate with Madden** - Use the CSV files to update your rosters
4. **Automate** - Set up scheduled scraping for regular updates

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review the example scripts in `examples/`
- Look at the configuration file: `config/scraper_config.yaml`

Happy scraping!
