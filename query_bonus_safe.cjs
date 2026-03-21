const admin = require('firebase-admin');

// Initialize Firebase Admin (from SERVICE_ACCOUNT in src/index.tsx)
const serviceAccount = {
  type: "service_account",
  project_id: "dedra-mlm",
  private_key_id: "9bf051a4b3416458b8e7b18da5f51565fd5bad13",
  private_key: process.env.FIREBASE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDE2u5iT6K6e5F8\ny0QeS8gG4p+Y2+bUqj+8xTjU/m8T2/n3x3V/O6J6Y2B+8M7v2b2j4s7V/7VzQ4n+\nuP+N2t/B1F6k/8X6w/2T1m6Z9F9l6/0+z5/w8J3d/j4I6V+U3Y6n/M6R/2b7I+S+\nu+U/2W1Y9g0b+P2v2M5D1k/C+I9N0v8b+w/M4w3z/S+I2f0W7Z/I/2I7w9m4I/P\nuP2e2N/Y/M2b/Y2c/P4v/E8I/K2x/w+X+O/P/Q/T/Q4O/P9D/P/W9I3J4z/2M9I/\nP8c4M3P/P4e/P/M4e/Q8O2K/M/P4e+P/L+T/L/M4Z/R+K+C/M+M4P/D4P4O/Q/Q/\nP4E/L4D7AgMBAAECggEAf+L8w/z+c4K+c3M2I7m4D/J7O6H/O3K2b9n8M+e8P/B\nuM6M7O6P/Q/C7P8G+J8R4D+M7O3J6e5M8I+L9K9O2M5J3P/K9L8P/I+O4R+M+C/\nL3P4H/M7C+M+T+E4D/N6P9N4P+J5M6M/D3K4P4P+L+O4J4I/M4D/C4P9O4P+K/\nL4O/J4P+M/D+C/H+J8O+P/C+P+P/C+I+L/C/O4O4R4P/N+O4M+J4O+L+M4J+C/\nL4O4M4P+O4P/K+O4P+K4O/O4P4J+N4D+P4P+K/N4D4P4P+N/P4O+J+O4M+C/O4\nP4P+D+K/J4D4P/O+J+J/J/O4D4P+D+O/P/K+J+J+N4D/C/P+D+O4P+P/O4D+K/\nM4D+J+M4P+K4M4D4P+K4D4J4P4D4P/J4D4D+P4M4D4P/J/O4D/C4O4P4P+K/N\n-----END PRIVATE KEY-----\n`.replace(/\\n/g, '\n'),
  client_email: "firebase-adminsdk-fbsvc@dedra-mlm.iam.gserviceaccount.com",
  client_id: "103096684164693920388",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40dedra-mlm.iam.gserviceaccount.com"
};

try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
} catch(e) {
    if (!/already exists/.test(e.message)) {
      console.error('Firebase init error', e);
    }
}

const db = admin.firestore();

async function run() {
    try {
        console.log("Fetching today's ROI bonuses...");
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        // Let's just fetch all recent bonuses without filtering too hard to avoid timeouts/indexes
        const bonusesSnapshot = await db.collection('bonuses')
            .where('type', '==', 'roi')
            .orderBy('createdAt', 'desc')
            .limit(1000)
            .get();
            
        console.log(`Fetched ${bonusesSnapshot.size} recent ROI bonuses.`);
        
        const userMap = {};
        
        bonusesSnapshot.forEach(doc => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
            
            // Only count if it's from the last 24 hours
            if (createdAt >= startOfToday) {
                const userId = data.userId;
                if (!userMap[userId]) userMap[userId] = { totalPaid: 0, count: 0 };
                userMap[userId].totalPaid += Number(data.amount || 0);
                userMap[userId].count++;
            }
        });
        
        const activeUsers = Object.keys(userMap);
        console.log(`Found ${activeUsers.length} users who received ROI today.`);
        
        // Fetch their investments
        console.log("Fetching investments for these users...");
        let totalPrincipalOverall = 0;
        let totalPaidOverall = 0;
        
        const results = [];
        
        for (let i=0; i<activeUsers.length; i+=10) {
            const chunk = activeUsers.slice(i, i+10);
            const invSnap = await db.collection('investments')
                .where('userId', 'in', chunk)
                .where('status', '==', 'active')
                .get();
                
            const invMap = {};
            invSnap.forEach(doc => {
                const data = doc.data();
                const uId = data.userId;
                if (!invMap[uId]) invMap[uId] = 0;
                invMap[uId] += Number(data.amount || data.amountUsdt || 0);
            });
            
            for (const uId of chunk) {
                const principal = invMap[uId] || 0;
                const paid = userMap[uId].totalPaid;
                const ratio = principal > 0 ? (paid / principal) * 100 : 0;
                
                totalPrincipalOverall += principal;
                totalPaidOverall += paid;
                
                results.push({
                    userId: uId,
                    principal,
                    paid,
                    ratio,
                    count: userMap[uId].count
                });
            }
        }
        
        // Sort by ratio desc
        results.sort((a, b) => b.ratio - a.ratio);
        
        console.log("\n=== TOP 20 USERS BY PAYOUT RATIO ===");
        console.log("UserID | Principal | Paid | Ratio | Count");
        results.slice(0, 20).forEach(r => {
            console.log(`${r.userId} | $${r.principal.toFixed(2)} | $${r.paid.toFixed(2)} | ${r.ratio.toFixed(2)}% | ${r.count}`);
        });
        
        console.log("\n=== SUMMARY ===");
        console.log(`Total Users Paid: ${results.length}`);
        console.log(`Total ROI Paid: $${totalPaidOverall.toFixed(2)}`);
        console.log(`Total Active Principal of these users: $${totalPrincipalOverall.toFixed(2)}`);
        console.log(`Average Payout Ratio: ${totalPrincipalOverall > 0 ? (totalPaidOverall / totalPrincipalOverall * 100).toFixed(2) : 0}%`);
        
        const overpaid = results.filter(r => r.ratio > 1); // more than 1%
        console.log(`\nUsers with >1% payout ratio: ${overpaid.length}`);
        if (overpaid.length > 0) {
             console.log("Top 5 overpaid:");
             overpaid.slice(0, 5).forEach(r => console.log(`${r.userId}: ${r.ratio.toFixed(2)}% ($${r.paid})`));
        }

        const fs = require('fs');
        fs.writeFileSync('/home/user/webapp/today_bonus_report.json', JSON.stringify(results, null, 2));
        console.log("Saved full report to today_bonus_report.json");
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}

run();
