const FIREBASE_API_KEY = 'AIzaSyCijC0Lfvx0WJFWQc4kukND7yOlA-nABr8'
const PROJECT_ID = 'dedra-mlm'

async function getAdminToken() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@deedra.com',
      password: 'admin123!',
      returnSecureToken: true
    })
  })
  const data = await res.json()
  if (!data.idToken) throw new Error("Failed to get admin token: " + JSON.stringify(data))
  return data.idToken
}

function fromFirestoreValue(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return new Date(val.timestampValue);
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(v => fromFirestoreValue(v));
  if ('mapValue' in val) {
    const obj = {};
    for (const k in val.mapValue.fields) {
      obj[k] = fromFirestoreValue(val.mapValue.fields[k]);
    }
    return obj;
  }
  return val;
}

async function fsQueryFast(collection, token, limit=5000) {
  let query = {
    from: [{ collectionId: collection }],
    limit: limit,
    orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }]
  };
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: query })
  });
  const data = await res.json();
  if(!Array.isArray(data)) return [];
  return data.filter(d => d.document).map(d => {
    const id = d.document.name.split('/').pop();
    const obj = { id };
    for (const k in d.document.fields) {
      obj[k] = fromFirestoreValue(d.document.fields[k]);
    }
    return obj;
  });
}

// Write operation helpers
async function fsDelete(collection, docId, token) {
  await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
}

async function fsPatch(collection, docId, fields, token) {
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'number') {
      firestoreFields[k] = { doubleValue: v };
    } else if (typeof v === 'string') {
      firestoreFields[k] = { stringValue: v };
    }
  }
  
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  
  await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?${updateMask}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  });
}

async function fsGet(collection, docId, token) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.error) return null;
  const obj = { id: docId };
  if(data.fields) {
    for (const k in data.fields) {
      obj[k] = fromFirestoreValue(data.fields[k]);
    }
  }
  return obj;
}

async function run() {
  try {
    const token = await getAdminToken();
    console.log("Token acquired, fetching bonuses...");
    
    // We only need to rollback ones that were created today/yesterday (which have the bug)
    // Or just all `rank_bonus` since the system just started paying them?
    const allBonuses = await fsQueryFast('bonuses', token, 10000);
    
    const badBonuses = allBonuses.filter(b => b.type === 'rank_bonus' || b.type === 'rank_equal_or_higher_override_1pct');
    
    console.log(`Found ${badBonuses.length} bad matching bonuses to rollback.`);
    
    let totalDeducted = 0;
    const userDeductions = {};
    
    for (const b of badBonuses) {
      const amt = Number(b.amount || 0);
      if (amt === 0) continue;
      
      if (!userDeductions[b.userId]) userDeductions[b.userId] = 0;
      userDeductions[b.userId] += amt;
      totalDeducted += amt;
    }
    
    console.log("Summary of deductions per user:");
    for (const [uid, amt] of Object.entries(userDeductions)) {
      console.log(`- User ${uid}: -$${amt.toFixed(4)}`);
    }
    console.log(`Total amount to claw back: $${totalDeducted.toFixed(4)}`);
    
    // Start rollback
    console.log("\nStarting Wallet Rollback...");
    for (const [uid, deduction] of Object.entries(userDeductions)) {
      const wallet = await fsGet('wallets', uid, token);
      if (wallet && wallet.bonusBalance !== undefined) {
        const newBonus = Math.max(0, Number(wallet.bonusBalance) - deduction);
        const newTotalEarning = Math.max(0, Number(wallet.totalEarnings || 0) - deduction);
        
        await fsPatch('wallets', uid, { 
          bonusBalance: newBonus,
          totalEarnings: newTotalEarning
        }, token);
        console.log(`Updated wallet for ${uid}: bonusBalance ${wallet.bonusBalance.toFixed(2)} -> ${newBonus.toFixed(2)}`);
      }
    }
    
    console.log("\nStarting Bonus Deletion...");
    let delCount = 0;
    for (const b of badBonuses) {
      await fsDelete('bonuses', b.id, token);
      delCount++;
      if (delCount % 100 === 0) console.log(`Deleted ${delCount}/${badBonuses.length}`);
    }
    
    console.log(`\nROLLBACK COMPLETE! Deleted ${delCount} bonus records and updated wallets.`);
    
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
