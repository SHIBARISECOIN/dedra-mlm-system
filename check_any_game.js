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
        
        const txQuery = {
            structuredQuery: {
                from: [{ collectionId: 'gamelogs' }],
                limit: 10
            }
        };
        
        const txRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(txQuery)
        });
        
        const txData = await txRes.json();
        console.log("--- ANY GAMELOGS ---");
        console.log(JSON.stringify(txData, null, 2));
        
    } catch (e) {
        console.error(e);
    }
}
run();
