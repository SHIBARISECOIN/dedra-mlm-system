import { readFileSync } from 'fs';
import { google } from 'googleapis';

const projectId = "deedra-c35f2";

async function getAccessToken() {
    const keyFile = readFileSync('/home/user/webapp/service-account.json', 'utf8');
    const credentials = JSON.parse(keyFile);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/datastore']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token;
}

async function run() {
    try {
        const token = await getAccessToken();
        const uid = "mb4hYj4bb8ZWzPs1sAu4zNTf0o02";
        
        console.log("Checking all transactions for:", uid);
        
        const txQuery = {
            structuredQuery: {
                from: [{ collectionId: 'transactions' }],
                where: {
                    compositeFilter: {
                        op: 'AND',
                        filters: [
                            {
                                fieldFilter: {
                                    field: { fieldPath: 'userId' },
                                    op: 'EQUAL',
                                    value: { stringValue: uid }
                                }
                            }
                        ]
                    }
                },
                orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
                limit: 50
            }
        };
        
        const txRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(txQuery)
        });
        
        const txData = await txRes.json();
        
        console.log("--- ALL RECENT TRANSACTIONS ---");
        let count = 0;
        if (txData && Array.isArray(txData)) {
            for (const doc of txData) {
                if (doc.document && doc.document.fields) {
                    count++;
                    const f = doc.document.fields;
                    console.log(`[${f.createdAt?.timestampValue || f.createdAt?.integerValue}] Type: ${f.type?.stringValue}, Amount: ${f.amount?.doubleValue || f.amount?.integerValue}, Asset: ${f.asset?.stringValue || 'USDT'}`);
                }
            }
        }
        console.log(`Total transactions found: ${count}`);
    } catch (e) {
        console.error(e);
    }
}
run();
