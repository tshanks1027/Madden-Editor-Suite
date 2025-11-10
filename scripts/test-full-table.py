"""Test getting full PFR table (not just visible rows)"""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pandas as pd
import re

# Setup Chrome
chrome_options = Options()
chrome_options.add_argument('--headless')
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

driver = webdriver.Chrome(options=chrome_options)

try:
    # Test with 1999 Colts (should have 58 players per your example)
    url = "https://www.pro-football-reference.com/teams/clt/1999_roster.htm"
    print(f"Testing: {url}\n")

    driver.get(url)

    # Wait for table
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.ID, "roster"))
    )

    # Get full page source
    html = driver.page_source

    print(f"HTML length: {len(html)}")

    # PFR hides full tables in HTML comments to prevent scraping
    # Find commented-out table data
    comment_pattern = r'<!--(.*?)-->'
    comments = re.findall(comment_pattern, html, re.DOTALL)

    print(f"\nFound {len(comments)} HTML comment blocks")

    # Try to find roster table in comments
    for i, comment in enumerate(comments):
        if 'id="roster"' in comment or '<table' in comment and 'Player' in comment:
            print(f"\n✓ Found table in comment block {i}")
            print(f"Comment length: {len(comment)}")

            # Parse the commented table
            try:
                tables = pd.read_html(comment)
                if tables:
                    df = tables[0]
                    print(f"\n✓ SUCCESS! Parsed table with {len(df)} rows")
                    print(f"Columns: {list(df.columns)}\n")
                    print("First 5 players:")
                    for idx, row in df.head(5).iterrows():
                        print(f"  {row.get('Player', '')} - {row.get('Pos', '')}")
                    break
            except Exception as e:
                print(f"Error parsing comment block: {e}")

    # Also try regular pandas parsing for comparison
    print("\n" + "="*80)
    print("Regular pandas parsing (for comparison):")
    tables = pd.read_html(html)
    if tables:
        df_regular = tables[0]
        print(f"Regular parsing: {len(df_regular)} rows")

finally:
    driver.quit()
