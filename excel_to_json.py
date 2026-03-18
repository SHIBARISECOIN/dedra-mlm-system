import pandas as pd
import json

file_path = '/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260318_1558.xlsx'
df = pd.read_excel(file_path)

# Fill na and convert dates to string
df = df.fillna('')
df['purchase_date'] = df['purchase_date'].astype(str)
df['allowance_date'] = df['allowance_date'].astype(str)

data = df.to_dict('records')

with open('/home/user/webapp/migrated_investments.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Dumped to migrated_investments.json")
