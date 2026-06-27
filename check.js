const fs = require('fs');

function cleanFile(filename) {
    let buf = fs.readFileSync(filename);
    let newBuf = Buffer.alloc(buf.length);
    let j = 0;
    let foundBom = false;
    
    for (let i = 0; i < buf.length; i++) {
        // Look for 0xFF 0xFE (UTF-16 LE BOM)
        if (buf[i] === 0xFF && i + 1 < buf.length && buf[i+1] === 0xFE) {
            console.log(`Found BOM in ${filename} at index ${i}`);
            i++; // skip both
            foundBom = true;
            continue;
        }
        // Also look for 0xFE 0xFF (UTF-16 BE BOM)
        if (buf[i] === 0xFE && i + 1 < buf.length && buf[i+1] === 0xFF) {
            console.log(`Found BE BOM in ${filename} at index ${i}`);
            i++;
            foundBom = true;
            continue;
        }
        // Look for 0xEF 0xBB 0xBF (UTF-8 BOM) in the middle of file
        if (i > 0 && buf[i] === 0xEF && i + 2 < buf.length && buf[i+1] === 0xBB && buf[i+2] === 0xBF) {
            console.log(`Found UTF-8 BOM in ${filename} at index ${i}`);
            i += 2;
            foundBom = true;
            continue;
        }
        
        newBuf[j++] = buf[i];
    }
    
    if (foundBom) {
        fs.writeFileSync(filename, newBuf.slice(0, j));
        console.log(`Cleaned ${filename}`);
    } else {
        console.log(`${filename} is clean of mid-file BOMs`);
    }
}

cleanFile('styles.css');
cleanFile('app.js');
