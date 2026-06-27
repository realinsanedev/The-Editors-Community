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

function mergeData(local, remote) {
    const merged = { ...remote }; // Start with remote data to preserve everything by default
    
    for (const [key, localPage] of Object.entries(local)) {
        if (!merged[key]) {
            merged[key] = localPage;
            continue;
        }
        
        const remotePage = merged[key];
        
        const mergedPage = {
            ...remotePage,
            title: localPage.title || remotePage.title,
            breadcrumb: localPage.breadcrumb || remotePage.breadcrumb,
            content: localPage.content !== undefined ? localPage.content : remotePage.content,
        };
        
        // 1. Merge downloadLinks
        const localDLinks = localPage.downloadLinks || [];
        const remoteDLinks = remotePage.downloadLinks || [];
        const mergedDLinks = [...localDLinks];
        
        remoteDLinks.forEach(rLink => {
            const exists = mergedDLinks.some(lLink => lLink.url === rLink.url || lLink.label === rLink.label);
            if (!exists) {
                mergedDLinks.push(rLink);
            }
        });
        mergedPage.downloadLinks = mergedDLinks;
        
        // 2. Merge softwareGroups
        const localSGroups = localPage.softwareGroups || [];
        const remoteSGroups = remotePage.softwareGroups || [];
        const mergedSGroups = [...localSGroups];
        
        remoteSGroups.forEach(rGroup => {
            const lGroup = mergedSGroups.find(g => g.title === rGroup.title);
            if (!lGroup) {
                mergedSGroups.push(rGroup);
            } else {
                const mergedLinks = [...(lGroup.links || [])];
                const rLinks = rGroup.links || [];
                rLinks.forEach(rLink => {
                    const exists = mergedLinks.some(lLink => lLink.url === rLink.url || lLink.label === rLink.label);
                    if (!exists) {
                        mergedLinks.push(rLink);
                    }
                });
                lGroup.links = mergedLinks;
            }
        });
        mergedPage.softwareGroups = mergedSGroups;
        
        merged[key] = mergedPage;
    }
    
    return merged;
}

async function run() {
    try {
        const dataPath = path.join(__dirname, 'data.json');
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        const localData = JSON.parse(fileContent);
        
        console.log("Checking for existing live data in Firestore...");
        const siteDoc = await db.collection('site').doc('data').get();
        
        let finalData = localData;
        
        if (siteDoc.exists) {
            console.log("Live data found. Merging local data.json with live database data to preserve admin panel links...");
            const remoteData = siteDoc.data();
            finalData = mergeData(localData, remoteData);
            
            // Sync merged data back to local data.json so it gets committed/tracked
            fs.writeFileSync(dataPath, JSON.stringify(finalData, null, 4), 'utf8');
            console.log("Local data.json updated with merged live data.");
        } else {
            console.log("No existing live data found. Initializing Firestore with local data.json contents.");
        }
        
        console.log("Uploading merged data to Firestore collection 'site', document 'data'...");
        await db.collection('site').doc('data').set(finalData);
        console.log("Success! Data uploaded successfully to Firestore.");
        process.exit(0);
    } catch (err) {
        console.error("Data upload/sync failed:", err);
        process.exit(1);
    }
}

run();
