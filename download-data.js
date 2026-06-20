const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Load environment variables if available
require('dotenv').config();

let serviceAccount;
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
} else if (process.env.FIREBASE_PRIVATE_KEY) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');
    serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
    };
}

if (!serviceAccount) {
    console.error("No service account credentials found!");
    process.exit(1);
}

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
    try {
        console.log("Fetching live data from Firestore collection 'site', document 'data'...");
        const siteDoc = await db.collection('site').doc('data').get();
        
        if (!siteDoc.exists) {
            console.error("Site data document does not exist in Firestore!");
            process.exit(1);
        }
        
        const data = siteDoc.data();
        const dataPath = path.join(__dirname, 'data.json');
        
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 4), 'utf8');
        console.log("Success! Live data downloaded and saved to data.json.");
        process.exit(0);
    } catch (err) {
        console.error("Download failed:", err);
        process.exit(1);
    }
}

run();
