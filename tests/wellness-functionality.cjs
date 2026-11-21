const { chromium }=require("playwright-core");
const assert=require("node:assert/strict");
const BASE="https://whitehawks-girlsswim.github.io/WHF-HQ/";
const APPS=[
 {file:"mia.html",mode:"mia",tab:"fuel",key:"mia-food-meals-v1",release:"foodscan-20261121-4"},
 {file:"sam.html",mode:"sam",tab:"eat",key:"sam-wellness-food-diary-v1",release:"signature-20261121-9"},
 {file:"sam-signature.html",mode:"sam",tab:"eat",key:"sam-wellness-food-diary-v1",release:"signature-20261121-9"},
 {file:"forge.html",mode:"forge",tab:"fuel",key:"forge-food-diary-v1",release:"2026112106"}
];
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage"]});
 try{
  for(const cfg of APPS)await verify(browser,cfg);
  console.log("PASS: ALL FOUR LIVE APPS food, water, barcode, persistence, nav, and anti-duplicate checks.");
 }finally{await browser.close()}
}
async function verify(browser,cfg){
 const ctx=await browser.newContext({viewport:{width:390,height:844},locale:"en-US",timezoneId:"America/Chicago",acceptDownloads:true});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(String(e).slice(0,700)));
 page.on("dialog",d=>d.accept());
 await page.route("**/api/v2/product/**",route=>route.fulfill({
  status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},
  body:JSON.stringify({status:1,product:{product_name:"Test canned beans",brands:"Test kitchen",serving_size:"50 g",serving_quantity:50,nutriments:{"energy-kcal_100g":120,"proteins_100g":8,"carbohydrates_100g":18,"fat_100g":2}}})
 }));
 let loaded=false;
 for(let attempt=0;attempt<17;attempt++){
  const response=await page.goto(BASE+cfg.file+"?e2e="+Date.now()+"-"+attempt,{waitUntil:"domcontentloaded",timeout:30000});
  const html=await page.content();
  if(response?.status()===200 && html.includes(cfg.release) && html.includes(cfg.mode==="mia"?"food-scanner.js?v=20261121-4":"food-scanner.js?v=20261121-6")){
   loaded=true;break;
  }
  console.log(cfg.file+": awaiting live release, attempt "+(attempt+1));
  await sleep(9000);
 }
 assert(loaded,cfg.file+" release not served after retry");
 await page.locator("#foodMealChoices button").first().waitFor({state:"attached",timeout:30000});
 const version=await page.locator("#foodScanner").getAttribute("data-food-mode");
 assert.equal(version,cfg.mode);
 assert.equal(await page.locator(".bottomnav [data-nav]").count(),4,"main bottom tab count must remain four");
 assert.equal(await page.locator("#foodMealChoices button").count(),4,"four meal picker buttons");
 const scanner=page.locator("#foodScanner");
 await page.locator('.bottomnav [data-nav="'+cfg.tab+'"]').click();
 if(cfg.mode==="mia")await scanner.locator("#foodMealChoices button").first().waitFor({state:"visible",timeout:10000});
 else {
  await scanner.locator("#foodQuickAdd").waitFor({state:"visible",timeout:10000});
  assert(await scanner.locator("#foodAddPanel").isHidden(),"adult add-food panel starts closed");
  assert(await scanner.locator(".foodscan-journal").isVisible(),"adult daily journal starts visible");
  assert.equal(await page.locator(".nutrition-settings").getAttribute("open"),null,"nutrition calculator starts collapsed");
 }
 assert(await scanner.isVisible(),cfg.file+" scanner must be visible inside "+cfg.tab);
 const buttons=await page.locator(".bottomnav [data-nav]").all();
 for(const b of buttons){
  await b.click();
  assert.equal(await page.locator(".view.active").count(),1,"one active view at a time");
 }
 await page.locator('.bottomnav [data-nav="'+cfg.tab+'"]').click();
 if(cfg.mode!=="mia"){
  const metrics=await scanner.locator("#foodTotals").innerText();
  assert(metrics.includes("kcal logged")&&metrics.includes("protein"),"daily totals shown before adding food");
  const compact=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+3);
  assert(compact,"no horizontal overflow at 390px");
 }

 // Manual entry from breakfast.
 if(cfg.mode!=="mia")await scanner.locator("#foodQuickAdd").click();
 await scanner.locator('[data-food-meal="breakfast"]').click();
 await scanner.locator("#foodManualOpen").click();
 assert(await scanner.locator("#foodManualPanel").getAttribute("open")!==null,"manual form expands");
 await scanner.locator("#foodManualName").fill("Test yogurt");
 if(cfg.mode==="mia"){
  assert.equal(await scanner.locator("#foodManualCal").count(),0,"teen manual entry must not count calories");
  await scanner.locator("#foodManualNote").fill("After morning training");
 }else{
  await scanner.locator("#foodManualServings").fill("2");
  await scanner.locator("#foodManualCal").fill("100");
  await scanner.locator("#foodManualProtein").fill("15");
  await scanner.locator("#foodManualCarbs").fill("10");
  await scanner.locator("#foodManualFat").fill("4");
 }
 await scanner.locator('#foodManualForm button[type="submit"]').click();
 const first= scanner.locator(".foodscan-meal-group").nth(0);
 assert(await first.locator(".foodscan-entry").count()===1,"Breakfast item saved");
 assert((await first.innerText()).includes("Test yogurt"),"breakfast item displayed");
 if(cfg.mode!=="mia")assert(await scanner.locator("#foodAddPanel").isHidden(),"manual form closes after saving");
 if(cfg.mode!=="mia"){
  const totals=await scanner.locator("#foodTotals").innerText();
  assert(totals.includes("200")&&totals.includes("30"),"manual 2-serving nutrients calculated");
 }
 // Check new per-meal + ADD opens the correct meal and a ready manual form.
 if(cfg.mode!=="mia"){
  await scanner.locator('.foodscan-meal-group').nth(1).locator('[data-food-target]').click();
  assert(await scanner.locator("#foodAddPanel").isVisible(),"meal shortcut opens one Add Food panel");
  assert.equal(await scanner.locator("#foodManualMeal").inputValue(),"lunch","meal shortcut selects the right meal");
  await scanner.locator("#foodCloseAdd").click();
  assert(await scanner.locator("#foodAddPanel").isHidden(),"close button hides entry panel");
 }
 // Move item from Breakfast to Lunch, retaining totals.
 await first.locator("select.foodscan-reassign").selectOption("lunch");
 assert(await scanner.locator(".foodscan-meal-group").nth(1).innerText().then(s=>s.includes("Test yogurt")),"food moves to lunch");
 // Legacy records without meal must remain visible under Earlier entries.
 await page.evaluate(key=>{
  const d=new Date(),day=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const rows=JSON.parse(localStorage.getItem(key));
  rows.push({id:787878,date:day,name:"Legacy snack",amount:100,calories:140,protein:5,carbs:22,fat:3});
  localStorage.setItem(key,JSON.stringify(rows));
 },cfg.key);
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator('.bottomnav [data-nav="'+cfg.tab+'"]').click();
 if(cfg.mode==="mia")await scanner.locator("#foodMealChoices button").first().waitFor({state:"visible"});
 else await scanner.locator("#foodQuickAdd").waitFor({state:"visible"});
 assert((await scanner.innerText()).includes("Earlier entries"),"legacy entries preserved");
 const last=scanner.locator(".foodscan-meal-group").last();
 await last.locator("select.foodscan-reassign").selectOption("snacks");
 assert((await scanner.locator(".foodscan-meal-group").nth(3).innerText()).includes("Legacy snack"),"legacy food reassignment works");

 // Water quick adds + custom value + undo, then reload check local persistence.
 await scanner.locator('[data-water-oz="8"]').click();
 await scanner.locator('[data-water-oz="12"]').click();
 assert.equal(await scanner.locator("#foodWaterTotal").innerText(),"20 fl oz");
 await scanner.locator("#foodWaterUndo").click();
 assert.equal(await scanner.locator("#foodWaterTotal").innerText(),"8 fl oz");
 if(cfg.mode!=="mia")await scanner.locator(".foodscan-water-extra summary").click();
 await scanner.locator("#foodWaterCustom").fill("7.5");
 await scanner.locator('#foodWaterForm button[type="submit"]').click();
 assert.equal(await scanner.locator("#foodWaterTotal").innerText(),"15.5 fl oz");
 await page.reload({waitUntil:"domcontentloaded"});
 await page.locator('.bottomnav [data-nav="'+cfg.tab+'"]').click();
 if(cfg.mode==="mia")await scanner.locator("#foodMealChoices button").first().waitFor({state:"visible"});
 else await scanner.locator("#foodQuickAdd").waitFor({state:"visible"});
 assert.equal(await scanner.locator("#foodWaterTotal").innerText(),"15.5 fl oz","water survives reload");
 assert((await scanner.innerText()).includes("Test yogurt"),"meal survives reload");

 // Barcode lookup and automatic scaled nutrition, with meal selected to Dinner.
 if(cfg.mode!=="mia")await scanner.locator("#foodQuickAdd").click();
 await scanner.locator('[data-food-meal="dinner"]').click();
 await scanner.locator("#foodBarcodeInput").fill("3017620422003");
 await scanner.locator('#foodBarcodeForm button[type="submit"]').click();
 await scanner.locator("#foodScanResult h4").waitFor({state:"visible",timeout:15000});
 assert((await scanner.locator("#foodScanResult h4").innerText()).includes("Test canned beans"),"barcode result");
 await scanner.locator("#foodScanSave").click();
 assert((await scanner.locator(".foodscan-meal-group").nth(2).innerText()).includes("Test canned beans"),"scanned food goes to selected dinner");
 if(cfg.mode!=="mia"){
  assert(await scanner.locator("#foodAddPanel").isHidden(),"adult Add Food panel closes after saving");
  assert(await scanner.locator("#foodScanResult").isHidden(),"product details close after saving");
  assert.equal(await scanner.locator("#foodBarcodeInput").inputValue(),"","barcode input clears after saving");
  assert.equal(await scanner.locator("#foodScanSave").count(),0,"previous product save button disappears, preventing duplicate saves");
  assert.equal(await scanner.locator("#foodTotals > div").first().locator("strong").innerText(),"400","daily calorie total equals manual 200 + legacy 140 + scanned 60, exactly once");
  assert.equal(await scanner.locator('.foodscan-meal-group').nth(2).locator(".foodscan-entry").count(),1,"one scanned item per save");
  await scanner.locator("#foodQuickAdd").click();
  await scanner.locator("#foodBarcodeInput").fill("3017620422004");
  await scanner.locator('#foodBarcodeForm button[type="submit"]').click();
  await scanner.locator("#foodScanResult h4").waitFor({state:"visible",timeout:15000});
  assert.equal(await scanner.locator('.foodscan-meal-group').nth(2).locator(".foodscan-entry").count(),1,"looking up next product does not log old item again");
  assert.equal(await scanner.locator("#foodTotals > div").first().locator("strong").innerText(),"400","lookup alone does not alter today's calories");
 }

 // Duplicate-content / layout checks specific to adults.
 if(cfg.mode==="forge"){
  assert.equal(await page.locator(".forge-quick-protein").count(),1);
  assert.equal(await page.locator(".forge-quick-protein").getAttribute("open"),null,"quick protein collapsed");
  assert.equal(await page.locator(".forge-fuel-ideas").getAttribute("open"),null,"meal ideas collapsed");
  const after=await scanner.locator("#foodTotals").innerText();
  assert(after.includes("400"),"200 manual + 140 legacy + 60 scanned calories, without quick-protein double count");
 }
 if(cfg.mode==="sam"){
  assert.equal(await page.locator(".wellness-ideas").count(),1);
  assert.equal(await page.locator(".wellness-ideas").getAttribute("open"),null,"duplicative ideas hidden under details");
  assert.equal(await page.locator("h3").filter({hasText:"Healthy habits that stick"}).count(),0,"redundant habits removed");
 }
 if(cfg.mode==="mia"){
  assert.equal(await scanner.locator("#foodTotals").count(),0,"no calorie total for minor");
  assert.equal(await scanner.locator("#foodManualCal").count(),0,"no calorie input for minor");
  assert.equal(await scanner.locator("#foodScanResult #foodItemCal").count(),0,"no barcode calorie input for minor");
 }
 // Remove one food entry to check deletion is functional.
 const dinner=scanner.locator(".foodscan-meal-group").nth(2);
 await dinner.locator("[data-food-delete]").first().click();
 assert(!(await dinner.innerText()).includes("Test canned beans"),"delete works");
 assert.equal(errors.length,0,cfg.file+" runtime errors: "+errors.join(" ; "));
 console.log("PASS: "+cfg.file+" manual meals, move, legacy, water, barcode, deletion, tabs, controls, persistence");
 await ctx.close();
}
run().catch(e=>{console.error("FAIL:",e.stack||e);process.exit(1)});
