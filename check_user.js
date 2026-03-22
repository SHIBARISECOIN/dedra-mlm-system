import { readFileSync } from 'fs';
import { google } from 'googleapis';

const projectId = "dedra-mlm";

async function getAccessToken() {
    const keyFile = readFileSync('/home/user/webapp/service-account.json', 'utf8');
    const credentials = JSON.parse(keyFile);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/datastore', 'https://www.googleapis.com/auth/identitytoolkit']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

async function run() {
    try {
        const token = await getAccessToken();
        
        // Find user by email in Firestore
        const query = {
            structuredQuery: {
                from: [{ collectionId: 'users' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'email' },
                        op: 'EQUAL',
                        value: { stringValue: 'hsy7948@deedra.com' }
                    }
                }
            }
        };
        
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(query)
        });
        
        const data = await res.json();
        
        if (data && data[0] && data[0].document) {
            const uid = data[0].document.name.split('/').pop();
            console.log("Found UID:", uid);
            
            // Check wallet
            const walletRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/wallets/${uid}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const walletData = await walletRes.json();
            console.log("Wallet:", JSON.stringify(walletData.fields, null, 2));
            
            // Check all transactions for this user
            const txQuery = {
                structuredQuery: {
                    from: [{ collectionId: 'transactions' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'userId' },
                            op: 'EQUAL',
                            value: { stringValue: uid }
                        }
                    },
                    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
                    limit: 100
                }
            };
            
            const txRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(txQuery)
            });
            
            const txData = await txRes.json();
            console.log("--- TRANSACTIONS ---");
            if (txData && Array.isArray(txData)) {
                for (const doc of txData) {
                    if (doc.document && doc.document.fields) {
                        const f = doc.document.fields;
                        const type = f.type?.stringValue;
                        const amount = f.amount?.doubleValue || f.amount?.integerValue || 0;
                        const date = f.createdAt?.timestampValue || f.createdAt?.integerValue || f.createdAt?.stringValue;
                        const asset = f.asset?.stringValue || 'USDT';
                        const status = f.status?.stringValue;
                        console.log(`[${date}] Type: ${type}, Amount: ${amount} ${asset}, Status: ${status}`);
                        if (type === 'withdraw' || type === 'withdraw_request') {
                             console.log(`   Withdrawal details: toAddress=${f.toAddress?.stringValue}, txid=${f.txid?.stringValue}, withdrawable=${f.withdrawable?.booleanValue}`);
                        }
                        if (type.includes('game')) {
                             console.log(`   Game details: result=${f.result?.stringValue}, game=${f.game?.stringValue}`);
                        }
                    }
                }
            } else {
                console.log("No transactions found or error:", txData);
            }
        } else {
            console.log("User not found!");
        }
    } catch (e) {
        console.error(e);
    }
}
run();
