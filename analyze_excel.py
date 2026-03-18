import pandas as pd
file_path = '/home/user/uploaded_files/cryptosm2.0_주문_내역_통합_데이터베이스_구축-Genspark_AI_Sheets-20260318_1558.xlsx'
df = pd.read_excel(file_path)

print("Unique products:", df['product'].unique())
print("Unique payment amounts:", df['payment_amount'].unique())
print("Unique order status:", df['order_status'].unique())

# Also show some more rows
print(df.sample(5).to_string())
