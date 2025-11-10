"""Test single team scrape with Puppeteer"""
import pandas as pd
import asyncio
from pyppeteer import launch

async def test():
    # Test with 1999 Colts (the example file the user provided)
    team_code = 'clt'
    year = 1999
    url = f"https://www.pro-football-reference.com/teams/{team_code}/{year}_roster.htm"

    print(f"Testing Puppeteer scrape: {url}\n")

    browser = await launch({
        'headless': True,
        'args': ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try:
        page = await browser.newPage()

        print("Navigating to page...")
        response = await page.goto(url, {'waitUntil': 'networkidle0', 'timeout': 30000})

        print(f"Status code: {response.status}")

        if response.status != 200:
            print(f"ERROR: Got status {response.status}")
            await browser.close()
            return

        print("Getting page content...")
        html = await page.content()

        print(f"HTML length: {len(html)}")

        print("\nParsing tables...")
        tables = pd.read_html(html)
        print(f"Found {len(tables)} tables\n")

        if tables:
            df = tables[0]
            print(f"First table has {len(df)} rows")
            print(f"Columns: {list(df.columns)}\n")

            print("First 3 players:")
            for idx, row in df.head(3).iterrows():
                player_name = str(row.get('Player', '')).strip()
                print(f"  {player_name} - {row.get('Pos', '')} - AV: {row.get('AV', '')}")

        await page.close()

    finally:
        await browser.close()

    print("\n✓ SUCCESS! Puppeteer can access PFR")

if __name__ == '__main__':
    asyncio.get_event_loop().run_until_complete(test())
