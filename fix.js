const fs = require('fs');
const path = require('path');

function fixFileEncoding(filename) {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) return;
    
    // Read the raw buffer
    let buffer = fs.readFileSync(filePath);
    
    // Convert buffer to string, ignoring null bytes that PowerShell might have added
    let content = '';
    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] !== 0x00) {
            content += String.fromCharCode(buffer[i]);
        }
    }
    
    // Write back as standard UTF-8
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed encoding for ' + filename);
}

fixFileEncoding('styles.css');
fixFileEncoding('app.js');
