const { translateText } = require('./translate.js') || {};
async function run() {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=테스트`;
  const res = await fetch(url);
  console.log(res.status);
  const text = await res.text();
  console.log(text.substring(0, 100));
}
run();
