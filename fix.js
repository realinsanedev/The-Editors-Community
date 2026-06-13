const fs = require('fs');
let txt = fs.readFileSync('data.json', 'utf8');
txt = txt.replace(/\\\"/g, '"');
txt = txt.replace(/\\n/g, '\n');
// But wait, if data.json literally has \\" instead of \", that means it has two characters: \ and ".
// If we replace \\" with \", it might work.
txt = txt.replace(/\\\\"/g, '\\"');
txt = txt.replace(/\\\\n/g, '\\n');

txt = txt.replace(/Editors Club/gi, 'Editors Community Test');
txt = txt.replace(/Editorsclub/gi, 'Editors Community Test');
txt = txt.replace(/Club<\/span>/gi, 'Community Test</span>');

fs.writeFileSync('data.json', txt);
try {
  JSON.parse(txt);
  console.log('Fixed JSON successfully!');
} catch(e) {
  console.error('Still invalid:', e);
}
