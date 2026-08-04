const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:5173/products', { waitUntil: 'networkidle0' });
  const html = await page.content();
  console.log("HTML length:", html.length);
  if (html.includes("color:red")) {
     console.log("ERROR RENDERED IN DOM!");
  }
  await browser.close();
})();
