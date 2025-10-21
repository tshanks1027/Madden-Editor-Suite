# NFL Supplemental Draft & UDFA Scraper

This tool scrapes Wikipedia's NFL Draft pages to collect data on:
- **Supplemental Draft Picks** - Players drafted in the supplemental draft
- **Notable Undrafted Free Agents (UDFAs)** - Undrafted players who made an impact in the NFL

## Overview

Wikipedia maintains comprehensive NFL draft pages that include sections for supplemental draft picks and notable UDFAs at the bottom of each year's draft page. This scraper extracts that data automatically.

Example pages:
- https://en.wikipedia.org/wiki/2023_NFL_draft
- https://en.wikipedia.org/wiki/2022_NFL_draft
- https://en.wikipedia.org/wiki/2021_NFL_draft

## Installation

```bash
# Install dependencies (if not already installed)
pip install -r requirements.txt
```

## Usage

### Scrape a Single Year

```bash
python scrape_supplemental_udfa.py --year 2023
```

### Scrape Multiple Specific Years

```bash
python scrape_supplemental_udfa.py --years 2020 2021 2022 2023
```

### Scrape a Range of Years

```bash
# Get all supplemental picks and UDFAs from 2000-2023
python scrape_supplemental_udfa.py --start-year 2000 --end-year 2023
```

### Output Formats

```bash
# JSON format (default)
python scrape_supplemental_udfa.py --year 2023 --format json

# CSV format
python scrape_supplemental_udfa.py --year 2023 --format csv

# Both formats
python scrape_supplemental_udfa.py --year 2023 --format both
```

### Verbose Logging

```bash
python scrape_supplemental_udfa.py --year 2023 --verbose
```

## Output

Data is saved to the `output/` directory with the following naming conventions:

- Single year: `supplemental_udfa_2023.json` or `supplemental_udfa_2023.csv`
- Multiple years: `supplemental_udfa_2000_2023.json` or `supplemental_udfa_2000_2023.csv`

### JSON Output Format

```json
{
  "2023": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "full_name": "John Doe",
      "college": "University of Example",
      "position": "QB",
      "draft_class": 2023,
      "round": 0,
      "pick": 1,
      "draft_type": "supplemental",
      "team": "Example Team",
      "height": "6-3",
      "weight": 220
    },
    {
      "first_name": "Jane",
      "last_name": "Smith",
      "full_name": "Jane Smith",
      "college": "State University",
      "position": "WR",
      "draft_class": 2023,
      "round": null,
      "pick": null,
      "draft_type": "undrafted",
      "team": "Sample Team",
      "height": null,
      "weight": null
    }
  ]
}
```

### CSV Output Format

| year | first_name | last_name | full_name | college | position | round | pick | draft_type | team | height | weight |
|------|-----------|-----------|-----------|---------|----------|-------|------|------------|------|--------|--------|
| 2023 | John | Doe | John Doe | University of Example | QB | 0 | 1 | supplemental | Example Team | 6-3 | 220 |
| 2023 | Jane | Smith | Jane Smith | State University | WR | UDFA | N/A | undrafted | Sample Team | | |

## Data Fields

| Field | Description | Notes |
|-------|-------------|-------|
| first_name | Player's first name | Extracted from full name |
| last_name | Player's last name | Extracted from full name |
| full_name | Player's complete name | As appears on Wikipedia |
| college | College/University attended | School player came from |
| position | Player's position | Normalized to standard NFL positions |
| draft_class | Year of the draft | Input year |
| round | Draft round number | 0 for supplemental, null for UDFA |
| pick | Pick number in draft | Only for supplemental picks |
| draft_type | Type of selection | "supplemental" or "undrafted" |
| team | NFL team that signed player | When available |
| height | Player height | When available from profile |
| weight | Player weight | When available from profile |

## Notable Supplemental Draft Picks (Examples)

The supplemental draft has produced some notable NFL players over the years:

- **Cris Carter** (1987) - Hall of Fame WR
- **Bernie Kosar** (1985) - Pro Bowl QB
- **Josh Gordon** (2012) - Pro Bowl WR
- **Terrelle Pryor** (2011) - NFL QB/WR

## Notable UDFAs (Examples)

Many undrafted free agents have had successful NFL careers:

- **Kurt Warner** - Hall of Fame QB
- **Tony Romo** - Pro Bowl QB
- **Wes Welker** - Pro Bowl WR
- **James Harrison** - Defensive Player of the Year
- **Jason Peters** - Pro Bowl OT
- **Antonio Gates** - Hall of Fame TE

## Historical Coverage

The supplemental draft has been held irregularly since 1977. Notable years include:

- **1984-1992**: Most active period for supplemental drafts
- **1993-2008**: Limited supplemental draft activity
- **2009-Present**: Occasional supplemental drafts

The scraper will correctly handle years with no supplemental draft activity (returns empty list).

## Rate Limiting

The scraper is configured to be respectful of Wikipedia's servers:

- 2 second delay between requests
- Proper User-Agent identification
- Automatic retry logic with backoff

## Troubleshooting

### HTTP 403 Forbidden Error

If you encounter a 403 error, Wikipedia may be blocking automated requests. Try:

1. **Increase rate limiting**: Edit the script and increase `rate_limit_seconds` to 3-5 seconds
2. **Run from different network**: Some networks/IPs may be blocked
3. **Add custom User-Agent**: Wikipedia prefers identifiable user agents

### No Data Found

If the scraper finds no data:

1. **Verify the year**: Not all years have supplemental drafts
2. **Check Wikipedia page**: The page structure may have changed
3. **Use --verbose flag**: Get detailed logging to see what's happening

### Missing Fields

Some players may have incomplete data on Wikipedia:
- Height/weight may not be available
- Team information may be missing for older entries
- Position information may be inconsistent

## Technical Details

### Architecture

The scraper follows the existing Madden Editor Suite architecture:

- `WikipediaDraftScraper`: Main scraper class extending `BaseScraper`
- `RateLimitedClient`: HTTP client with rate limiting
- `DataMapper`: Data normalization and mapping
- `Prospect`: Data model for player information

### Page Parsing

The scraper looks for specific sections on Wikipedia pages:

1. **Supplemental Draft Section**
   - Headings: "Supplemental draft", "Supplemental Draft", "Supplemental draft picks"
   - Extracts data from wikitable following the heading

2. **Notable UDFA Section**
   - Headings: "Notable undrafted players", "Undrafted free agents", etc.
   - Extracts data from wikitable following the heading

### Error Handling

The scraper includes comprehensive error handling:

- Network errors: Retry with exponential backoff
- Parsing errors: Log and skip problematic rows
- Missing sections: Continue without error

## Future Enhancements

Potential improvements for this tool:

- [ ] Add support for scraping player career stats
- [ ] Include draft pick trades/compensatory information
- [ ] Add support for other Wikipedia draft-related pages
- [ ] Create database export format
- [ ] Add data validation and quality checks
- [ ] Include player images/photos

## Contributing

To contribute improvements to the supplemental/UDFA scraper:

1. The scraper is located in `src/scrapers/wikipedia_draft_scraper.py`
2. The main script is `scrape_supplemental_udfa.py`
3. Submit pull requests with enhancements

## Legal & Ethical Considerations

- **Rate Limiting**: Respects Wikipedia's servers with appropriate delays
- **User-Agent**: Identifies itself clearly
- **Personal Use**: Intended for personal/educational use
- **Wikipedia ToS**: Review Wikipedia's Terms of Service before large-scale scraping
- **Data Attribution**: Data sourced from Wikipedia (CC BY-SA license)

## License

See LICENSE file for details. Data scraped from Wikipedia is subject to Wikipedia's licensing terms.

## Support

For issues or questions:

1. Check this README
2. Review the source code comments
3. Check Wikipedia page structure hasn't changed
4. Open an issue on the repository

---

**Happy Scraping!** 📊🏈
