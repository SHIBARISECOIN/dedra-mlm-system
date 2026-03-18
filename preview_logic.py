import json
from datetime import datetime

with open('migrated_investments.json', 'r') as f:
    data = json.load(f)

products = {
    '30일':  {'id': 'CISQqK3JDiltXNMtUfc3', 'name': '1개월', 'roi': 0.4, 'days': 30},
    '90일':  {'id': 'W2O5SbYgC7M2N5PbArBb', 'name': '3개월', 'roi': 0.5, 'days': 90},
    '180일': {'id': 'q4vUTRPnsKfU7yUcMUi5', 'name': '6개월', 'roi': 0.6, 'days': 180},
    '360일': {'id': 'vb7CsNewjaepbGZBCI3h', 'name': '12개월', 'roi': 0.8, 'days': 360},
}

today_str = "2026-03-18"
today_dt = datetime.strptime(today_str, "%Y-%m-%d")

sample = data[0]
print("Sample input:", sample)

processed = []
for row in data:
    p = products[row['product']]
    purch_dt = datetime.strptime(row['purchase_date'][:10], "%Y-%m-%d")
    allow_dt = datetime.strptime(row['allowance_date'][:10], "%Y-%m-%d")
    
    # Calculate days passed since allowance date to today (inclusive of allowance date? Or allowance date is the first payout day?)
    # If allowance date is 2026-03-19, and today is 2026-03-18, days_passed = 0 (actually -1, so max(0, ...))
    days_passed = (today_dt - allow_dt).days
    # But wait, if allowance_date is the date they get their FIRST ROI, 
    # and today is exactly that allowance_date, they should get 1 day.
    # Let's say days_passed = (today_dt - allow_dt).days + 1
    # Actually, if allowance_date is 03-19, they shouldn't get paid on 03-18. 
    # To prevent them from getting paid today (03-18), we can set lastSettledAt = "2026-03-18T23:59:59Z"
    
    # If we consider today is 2026-03-18:
    # If allowance_date <= today, they should have received ROI for those days.
    # Let's say they received it up to 2026-03-18.
    days_paid = max(0, (today_dt - purch_dt).days)
    
    daily_roi_amount = row['payment_amount'] * (p['roi'] / 100)
    paid_roi = days_paid * daily_roi_amount
    
    processed.append({
        'username': row['member_id'],
        'productId': p['id'],
        'productName': p['name'],
        'amount': row['payment_amount'],
        'roiPercent': p['roi'],
        'durationDays': p['days'],
        'paidRoi': paid_roi,
        'purchase_date': row['purchase_date'],
        'days_paid': days_paid
    })

print("Sample output:")
for p in processed[:5]:
    print(p)
    
print("\nSome older purchases:")
older = [p for p in processed if p['days_paid'] > 0]
for p in older[:5]:
    print(p)

