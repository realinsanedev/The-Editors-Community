const fs = require('fs');
let txt = fs.readFileSync('data.json', 'utf8');

// The file currently has a literal backslash followed by a literal newline where it should have just "\\n"
// Let's replace `\\\r\n` or `\\\n` with `\\n` (which becomes an escaped n in the JSON file).
txt = txt.replace(/\\\r?\n/g, '\\n');

try {
  JSON.parse(txt);
  fs.writeFileSync('data.json', txt);
  console.log('Fixed JSON successfully!');
} catch (e) {
  console.error('Still invalid:', e);
}
