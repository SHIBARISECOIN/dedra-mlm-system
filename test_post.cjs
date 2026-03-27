async function run() {
  const text = "비트코인 가격 상승".repeat(100); // 900 chars
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `q=${encodeURIComponent(text)}`
  });
  console.log(res.status);
  const data = await res.json();
  console.log(data[0][0][0].substring(0, 50));
}
run();
