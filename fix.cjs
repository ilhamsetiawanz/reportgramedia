const fs = require('fs');
let c = fs.readFileSync('src/icons/index.ts', 'utf8');
c = c.replace(/import \{ ReactComponent as (\w+) \} from "\.\/([\w-]+)\.svg\?react";/g, 'import $1 from "./$2.svg?react";');
fs.writeFileSync('src/icons/index.ts', c);
