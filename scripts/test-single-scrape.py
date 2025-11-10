"""Quick test to debug PFR scraping"""
import pandas as pd
import requests
import time

# Test with 1999 Colts (the example file the user provided)
team_code = 'clt'
year = 1999
url = f"https://www.pro-football-reference.com/teams/{team_code}/{year}_roster.htm"

print(f"Testing: {url}\n")

try:
    # Headers to avoid being blocked as a bot
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }

    response = requests.get(url, headers=headers, timeout=10)
    print(f"Status code: {response.status_code}")

    if response.status_code != 200:
        print(f"ERROR: Got status {response.status_code}")
        exit(1)

    # Parse HTML tables
    tables = pd.read_html(response.text)
    print(f"Found {len(tables)} tables\n")

    if not tables:
        print("ERROR: No tables found!")
        exit(1)

    # First table should be roster
    df = tables[0]
    print(f"First table has {len(df)} rows")
    print(f"Columns: {list(df.columns)}\n")

    print("First 5 rows:")
    print(df.head())

    print("\n" + "="*80)
    print("Testing player extraction:")

    for idx, row in df.head(3).iterrows():
        player_name = str(row.get('Player', '')).strip()
        print(f"\nRow {idx}: Player='{player_name}'")
        print(f"  Position: {row.get('Pos', '')}")
        print(f"  Age: {row.get('Age', '')}")
        print(f"  AV: {row.get('AV', '')}")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
