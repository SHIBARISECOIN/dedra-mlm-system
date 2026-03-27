async function run() {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=테스트`;
  const res = await fetch(url);
  console.log('Google:', res.status);
  const text = await res.text();
  console.log(text.substring(0, 100));

  const mmUrl = `https://api.mymemory.translated.net/get?q=테스트&langpair=ko|en`;
  const mmRes = await fetch(mmUrl);
  console.log('MyMemory:', mmRes.status);
  const mmText = await mmRes.text();
  console.log(mmText.substring(0, 100));
}
run();
