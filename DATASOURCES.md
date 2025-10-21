# Data Sources Guide

This document explains the data sources used by the Draft Prospect Scraper and how to interpret the data.

## Overview

The scraper uses different data sources depending on the draft class timeline:

| Draft Year | Primary Source | Data Type | Reliability |
|------------|---------------|-----------|-------------|
| 2026-2030 | Sports Reference | College Stats | High |
| 2031+ | 247Sports | Recruiting Rankings | Medium |

## Sports Reference (College Football Reference)

**URL:** https://www.sports-reference.com/cfb/

### What We Scrape

1. **Player Statistics**
   - Position-specific stats (passing, rushing, receiving, etc.)
   - Season performance data
   - Career totals

2. **Player Information**
   - Name, position, school
   - Height and weight
   - Class year (FR, SO, JR, SR)
   - Hometown

3. **Photos**
   - Player headshots when available

### How We Use It

- Scrapes junior and senior players (draft-eligible)
- Focuses on statistical leaders at each position
- Gets top 50 players per position group

### Data Quality

- **Accuracy:** Very high (official NCAA stats)
- **Completeness:** High for major programs
- **Update Frequency:** Weekly during season

### Example URL Patterns

```
Position Leaders:
https://www.sports-reference.com/cfb/years/2025-QB.html
https://www.sports-reference.com/cfb/years/2025-RB.html

Player Profiles:
https://www.sports-reference.com/cfb/players/john-smith-1.html
```

## 247Sports Recruiting

**URL:** https://247sports.com/

### What We Scrape

1. **Recruiting Rankings**
   - Composite rankings (aggregated from multiple services)
   - Position rankings
   - Star ratings (1-5 stars)
   - Rating scores (0.0-1.0)

2. **Player Information**
   - Name, position, committed school
   - Height and weight
   - Hometown
   - High school

3. **Recruiting Metrics**
   - National rank
   - Position rank
   - State rank

### How We Use It

- Scrapes top 100 overall recruits
- Gets top 30 per position
- Maps recruiting class year to draft year (+ 3 years typically)

### Star Rating System

| Stars | Description | Draft Projection |
|-------|-------------|------------------|
| 5-star | Elite prospect | 1st round |
| 4-star | High-major prospect | 1st-3rd round |
| 3-star | Mid-major prospect | 3rd-7th round |
| 2-star | Lower prospect | 5th-7th round |
| Unranked | Unknown | 6th-7th round |

### Data Quality

- **Accuracy:** Medium (predictions 3-4 years out)
- **Completeness:** High for top 300 recruits
- **Update Frequency:** Real-time during recruiting season

### Example URL Patterns

```
Composite Rankings:
https://247sports.com/Season/2028-Football/CompositeRecruitRankings/

Position Rankings:
https://247sports.com/Season/2028-Football/CompositeRecruitRankings/?Position=QB
```

## Field Mapping

Here's how we map data from sources to your schema:

### From Sports Reference

| Source Field | Your Field | Notes |
|-------------|------------|-------|
| Player name | First Name, Last Name | Split on space |
| School | College/Univ | Direct mapping |
| Pos | Position | Normalized to Madden positions |
| Height | Height | Converted to F-I format |
| Weight | Weight | Extracted as integer |
| Hometown | Home State | Extract state abbreviation |
| Player photo | PFR_Image_URL | Direct URL |

### From 247Sports

| Source Field | Your Field | Notes |
|-------------|------------|-------|
| Player name | First Name, Last Name | Split on space |
| Committed To | College/Univ | May be "Uncommitted" |
| Position | Position | Normalized to Madden positions |
| Stars | recruiting_stars | 1-5 star rating |
| Rating | recruiting_rating | 0.0-1.0 composite score |
| Height | Height | Converted to F-I format |
| Weight | Weight | Extracted as integer |
| Hometown | Home State | Extract state abbreviation |

## Position Mapping

We normalize positions from various sources to Madden format:

| Source Position | Madden Position |
|-----------------|-----------------|
| QB | QB |
| RB, HB | RB |
| FB | FB |
| WR, WDE | WR |
| TE | TE |
| OT, T | LT (needs manual left/right) |
| OG, G | LG (needs manual left/right) |
| C | C |
| DE, EDGE | DE |
| DT, NT | DT |
| ILB | MLB |
| OLB | ROLB |
| CB | CB |
| S, SAF | SS |
| FS | FS |
| SS | SS |
| K | K |
| P | P |
| ATH | (determined by recruiting profile) |

## Data Limitations

### What We Can Get

✅ Name, position, college
✅ Height, weight, hometown
✅ Recruiting rankings (for future prospects)
✅ College stats (for current players)
✅ Some player photos

### What We Can't Get

❌ Madden-specific IDs (Player Assets ID, CommID, PLPO)
❌ NFL career stats (AP1, PB, St, wAV) - these are for future players
❌ Exact draft round/pick (we predict these)
❌ Race/ethnicity (not publicly listed)
❌ Some photos (not all players have them)

### Fields We Predict

These fields are educated guesses:

- **Round** - Based on recruiting rank and college performance
- **Pick** - Sequential numbering based on predicted round
- **Draft Class** - Input by you, validated against player eligibility

## Alternative Data Sources (Not Yet Implemented)

You can extend the scraper to use:

1. **ESPN**
   - College stats
   - Player profiles
   - Mock drafts

2. **On3/Rivals**
   - Alternative recruiting rankings
   - Different evaluation metrics

3. **Pro Football Focus (PFF)**
   - Advanced analytics
   - Player grades (requires subscription)

4. **Mock Draft Databases**
   - NFL Mock Draft Database
   - Walter Football
   - The Draft Network

## Ethical Scraping

Our scraper follows best practices:

- ✅ Respects robots.txt
- ✅ Rate limiting (2+ seconds between requests)
- ✅ Caching to minimize requests
- ✅ User agent identification
- ✅ Personal/educational use only

## API Alternatives

If available, consider using official APIs:

- Sports Reference doesn't have a public API
- 247Sports doesn't have a public API
- Consider reaching out for data partnerships if doing this at scale

## Updating Data Sources

To add new data sources:

1. Create a new scraper class in `src/scrapers/`
2. Inherit from `BaseScraper`
3. Implement `scrape_draft_class()` method
4. Add configuration to `config/scraper_config.yaml`
5. Initialize in `src/main.py`

See the developer documentation for details.
