async function run() {
  const text = "비트코인 가격 상승\n\n###\n\n비트코인이 오늘 10% 상승했습니다.\n\n###\n\n이더리움 2.0 출시\n\n###\n\n이더리움이 새로운 버전을 출시했습니다.";
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  const data = await res.json();
  const translatedText = data[0].map(item => item[0] || '').join('');
  console.log(translatedText);
  console.log(translatedText.split('\n\n###\n\n'));
}
run();
