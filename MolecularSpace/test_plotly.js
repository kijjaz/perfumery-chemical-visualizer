const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.goto('http://localhost:8000/MolecularSpace/index.html', {waitUntil: 'networkidle2'});
    
    // Check initial mode
    const initialMode = await page.evaluate(() => document.getElementById('plot-container').data[0].mode);
    console.log('Initial mode:', initialMode);
    
    // Click toggle
    await page.click('#toggle-labels');
    
    await new Promise(r => setTimeout(r, 1000));
    const toggledMode = await page.evaluate(() => document.getElementById('plot-container').data[0].mode);
    console.log('Toggled mode:', toggledMode);
    
    // Click node
    const rect = await page.evaluate(() => {
        const r = document.getElementById('plot-container').getBoundingClientRect();
        return {x: r.x + r.width/2, y: r.y + r.height/2};
    });
    await page.mouse.click(rect.x, rect.y);
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Click toggle again
    await page.click('#toggle-labels');
    await new Promise(r => setTimeout(r, 1000));
    const toggledMode2 = await page.evaluate(() => document.getElementById('plot-container').data[0].mode);
    console.log('Toggled mode after click node:', toggledMode2);
    
    await browser.close();
})();
