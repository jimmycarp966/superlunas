require('dotenv').config({ path: '.env.local' });
require('ts-node').register();
const load = require('./lib/sourceLoader');

load.fetchSourceFile(true).then((p) => {
    console.log(`Extraidos ${p.length} productos.`);
    console.log('Primeros 15:', p.slice(0, 15));
}).catch(console.error);
