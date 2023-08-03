const fs = require('fs');
const pngToIco = require('png-to-ico');
const sharp = require('sharp');

sharp('public/favicon.svg')
    .toBuffer()
    .then(buffer => pngToIco([buffer]))
    .then(ico => fs.writeFileSync('public/favicon.ico', ico));
