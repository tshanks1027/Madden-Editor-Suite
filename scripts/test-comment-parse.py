import pandas as pd
import requests
import re

url = 'https://www.pro-football-reference.com/teams/crd/1970_roster.htm'
r = requests.get(url)

# Find commented HTML
comment_pattern = r'<!--(.*?)-->'
comments = re.findall(comment_pattern, r.text, re.DOTALL)
print(f'Found {len(comments)} comment blocks')

# Find roster table in comments
for i, comment in enumerate(comments):
    if 'id="roster"' in comment or ('<table' in comment and 'Player' in comment):
        print(f'\nFound roster in comment block {i}')
        tables = pd.read_html(comment)
        if tables:
            df = max(tables, key=len)
            print(f'Table size: {df.shape}')
            print(f'Columns: {list(df.columns)}')
            print(f'First 3 players:')
            for idx, row in df.head(3).iterrows():
                print(f"  {row.get('Player', '')} - {row.get('Pos', '')}")
            break
