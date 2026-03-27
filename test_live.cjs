async function run() {
  const url = `https://deedra.pages.dev/api/news-digest`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(data.items.length > 0 ? Object.keys(data.items[0]) : "No items");
  if(data.items.length > 0) {
    console.log('Title KO:', data.items[0].title);
    console.log('Title EN:', data.items[0].title_en);
  }
}
run();
