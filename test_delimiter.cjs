async function run() {
  const text = "안녕<br>테스트<br>입니다";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  const translatedText = data[0].map(item => item[0] || '').join('');
  console.log(translatedText);
}
run();
