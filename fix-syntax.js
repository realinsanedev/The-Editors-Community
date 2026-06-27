const fs = require('fs');
let c = fs.readFileSync('app.js', 'utf8');
c = c.replace(/haven\\\\'t/g, "haven\\'t");
fs.writeFileSync('app.js', c);
console.log('Fixed syntax in app.js');
