require('dotenv').config({ path: '.env.local' });
require('./lib/sourceLoader').fetchSourceFile(true).then(p => {
    console.log('--- PRODUCTS (First 20) ---');
    console.log(JSON.stringify(p.slice(0, 20), null, 2));
}).catch(console.error);
