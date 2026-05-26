import fs from 'fs';
let c = fs.readFileSync('src/data/tourSteps.js', 'utf8');
c = c.replace(/placement: '([a-z]+)',?/g, "placement: '$1',\n      disableBeacon: true,");
fs.writeFileSync('src/data/tourSteps.js', c);
