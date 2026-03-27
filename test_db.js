const fetch = require('node-fetch');

async function test() {
  const proj = 'dedra-mlm';
  const url1 = `https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents/products`;
  const url2 = `https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents/announcements`;

  try {
    const res1 = await fetch(url1);
    const data1 = await res1.json();
    console.log('PRODUCTS:', JSON.stringify(data1, null, 2).slice(0, 500));

    const res2 = await fetch(url2);
    const data2 = await res2.json();
    console.log('ANNOUNCEMENTS:', JSON.stringify(data2, null, 2).slice(0, 500));
  } catch(e) {
    console.error(e);
  }
}
test();
