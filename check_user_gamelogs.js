import { readFileSync } from 'fs';
import { google } from 'googleapis';

const projectId = "dedra-mlm";

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
        
        const txQuery = {
            structuredQuery: {
                from: [{ collectionId: 'gamelogs' }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'userId' },
                        op: 'EQUAL',
                        value: { stringValue: uid }
                    }
                },
                limit: 100
            }
        };
        
        const txRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(txQuery)
        });
        
        const txData = await txRes.json();
        console.log("--- GAMELOGS WITHOUT ORDERBY ---");
        let logs = [];
        if (txData && Array.isArray(txData)) {
            for (const doc of txData) {
                if (doc.document && doc.document.fields) {
                    logs.push({
                        time: doc.document.fields.createdAt?.timestampValue,
                        game: doc.document.fields.game?.stringValue,
                        win: doc.document.fields.win?.booleanValue,
                        bet: doc.document.fields.bet?.integerValue,
                        ddraChange: doc.document.fields.ddraChange?.integerValue
                    });
                }
            }
        }
        // sort logs manually
        logs.sort((a,b) => new Date(b.time) - new Date(a.time));
        console.table(logs);
        
    } catch (e) {
        console.error(e);
    }
}
run();
