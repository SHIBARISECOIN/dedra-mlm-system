import pandas as pd

file_path = '/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260318_1558.xlsx'
try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head().to_string())
    print(f"\nTotal rows: {len(df)}")
except Exception as e:
    print("Error reading excel:", e)
