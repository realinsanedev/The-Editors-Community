const fs = require('fs');

function restoreEncoding(filename) {
    let content = fs.readFileSync(filename, 'utf8');
    
    // Check if the file contains the specific corrupted sequences
    if (content.match(/[^\x00-\x7F]+/g)) {
        // Convert the string to latin1 buffer (reversing the bad fromCharCode)
        // Then parse that buffer as utf8
        const restored = Buffer.from(content, 'latin1').toString('utf8');
        
        // Safety check: if the restored version contains replacement characters \uFFFD,
        // it means there were characters that were not latin1-decodable. 
        // But since they came from fromCharCode originally, they should all be 1:1 mapped to latin1.
        fs.writeFileSync(filename, restored, 'utf8');
        console.log(`Restored encoding in ${filename}`);
    } else {
        console.log(`${filename} is already clean.`);
    }
}

restoreEncoding('app.js');
restoreEncoding('styles.css');
restoreEncoding('index.html');
