import pandas as pd
import requests

r = requests.get('https://www.pro-football-reference.com/teams/crd/1970_roster.htm')
tables = pd.read_html(r.text)
print(f'Tables found: {len(tables)}')
for i, t in enumerate(tables):
    print(f'Table {i}: {len(t)} rows, columns: {list(t.columns)}')

print(f'\nLargest table: {max(tables, key=len).shape}')
