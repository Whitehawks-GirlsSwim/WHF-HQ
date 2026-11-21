/* FoodScan v1 — shared across MIA / STRONG, SAM / WELLNESS and FORGE / ATHLETIC.
   Fetches public product nutrition only by barcode. No camera images are uploaded.
   Daily adult logs stay in this browser; teen mode shows fueling info without calorie targets. */
(function(){
"use strict";
const root=document.getElementById("foodScanner");if(!root)return;
const mode=root.dataset.foodMode||"sam",teen=mode==="mia",forge=mode==="forge";
const key=forge?"forge-food-diary-v1":"sam-wellness-food-diary-v1";
const data=()=>{try{const x=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(x)?x:[]}catch(e){return []}};
const persist=rows=>{try{localStorage.setItem(key,JSON.stringify(rows.slice(0,500)));return true}catch(e){notice("Local storage is full. Food entry was not saved.");return false}};
const localDay=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const safe=t=>String(t??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>v===null||v===undefined||v===""?null:(Number.isFinite(Number(v))?Number(v):null);
const r1=v=>Math.round(v*10)/10;
const fmt=v=>Number.isFinite(v)?r1(v).toLocaleString(undefined,{maximumFractionDigits:1}):"—";
const $=selector=>root.querySelector(selector);
let active=null,scanner=null,reading=false,libPromise=null,cameraOn=false;
root.innerHTML=
'<div class="foodscan-head"><div class="foodscan-kicker">'+(teen?'FUEL SMARTER · FOOD SCANNER':forge?'THE NUTRITION LAB · SCAN TO FUEL':'THE NOURISH EDIT · FOOD SCANNER')+'</div>'+
'<h3>'+(teen?'What’s in this snack?':forge?'Scan. Fuel. Perform.':'Scan your food.')+'</h3>'+
'<p>'+(teen?'Scan packaged snacks to see carbohydrates and protein for training, with no calorie or weight-loss tracking.':'Use a barcode to look up packaged-food nutrition, adjust the amount eaten, and save a private food entry.')+'</p></div>'+
'<div class="foodscan-actions"><button type="button" class="foodscan-primary" id="foodCameraButton">▣ &nbsp; SCAN BARCODE</button><button type="button" class="foodscan-secondary" id="foodPhotoButton">PHOTO OF BARCODE</button></div>'+
'<div id="foodCameraArea" class="foodscan-camera-area" hidden><div id="foodCamera" class="foodscan-camera"></div><button type="button" id="foodCameraStop">STOP CAMERA ×</button></div>'+
'<input id="foodImageFile" type="file" accept="image/*" capture="environment" hidden>'+
'<form id="foodBarcodeForm" class="foodscan-code"><label for="foodBarcodeInput">OR ENTER THE NUMBERS UNDER THE BARCODE</label>'+
'<div><input id="foodBarcodeInput" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="off" placeholder="Barcode / UPC / EAN" aria-label="Barcode number"><button type="submit">LOOK UP ↗</button></div></form>'+
'<div class="foodscan-status" id="foodScanStatus" role="status" aria-live="polite"></div>'+
'<div id="foodScanResult" class="foodscan-result" hidden></div>'+
(!teen?'<div class="foodscan-journal"><div class="foodscan-journal-heading"><b>TODAY’S FOOD LOG</b><small id="foodLogDay"></small></div><div class="foodscan-totals" id="foodTotals"></div><div class="foodscan-entries" id="foodEntries"></div></div>':
'<p class="foodscan-teen-note">Food is fuel, especially during swim training. This scanner does not set calorie goals or judge food as “good” or “bad.”</p>')+
'<p class="foodscan-source">Product data: <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a> (community supplied). Check the package label for accurate serving size, ingredients and nutrition. Barcodes are sent to Open Food Facts for lookup; photos stay on your phone. Camera access requires permission and internet.</p>';
function notice(msg){$("#foodScanStatus").textContent=msg||""}
function freshProduct(product,barcode){
 const n=product?.nutriments||{},nval=k=>num(n[k]);
 const energy=nval("energy-kcal_100g")??(nval("energy_100g")!==null?nval("energy_100g")/4.184:null);
 const servingQuantity=num(product?.serving_quantity);
 let amount=(servingQuantity&&servingQuantity>0)?servingQuantity:100;
 if(amount>2000)amount=100;
 return {barcode,name:product?.product_name||"Packaged food",brand:product?.brands||"",amount,serving:product?.serving_size||"",
  calories:energy,protein:nval("proteins_100g"),carbs:nval("carbohydrates_100g"),fat:nval("fat_100g")};
}
function results(product,barcode,message){
 active=freshProduct(product,barcode);
 const p=active;
 const result=$("#foodScanResult");result.hidden=false;
 result.innerHTML='<div class="foodscan-result-kicker">'+(message?"BARCODE LOOKUP":"PRODUCT FOUND")+'</div>'+
 '<h4>'+safe(p.name)+'</h4>'+(p.brand?'<p>'+safe(p.brand)+'</p>':'')+
 (message?'<p class="foodscan-warning">'+safe(message)+'</p>':'')+
 '<div class="foodscan-fields">'+
 '<label class="foodscan-full">NAME <input id="foodItemName" maxlength="90" value="'+safe(p.name)+'" placeholder="Food name"></label>'+
 '<label class="foodscan-full">AMOUNT '+(p.serving?'· LABEL SERVING '+safe(p.serving):'')+
 '<input id="foodItemAmount" type="number" inputmode="decimal" min="1" max="3000" step="1" value="'+safe(p.amount)+'" aria-label="Amount in grams or milliliters"> <small>g or mL consumed</small></label>'+
 (!teen?'<label>CALORIES PER 100 g/mL <input id="foodItemCal" type="number" inputmode="decimal" min="0" max="2000" step=".1" placeholder="Check label" value="'+(p.calories??"")+'"></label>':'')+
 '<label>PROTEIN PER 100 g/mL <input id="foodItemProtein" type="number" inputmode="decimal" min="0" max="200" step=".1" placeholder="Check label" value="'+(p.protein??"")+'"></label>'+
 '<label>CARBS PER 100 g/mL <input id="foodItemCarbs" type="number" inputmode="decimal" min="0" max="200" step=".1" placeholder="Check label" value="'+(p.carbs??"")+'"></label>'+
 '<label>FAT PER 100 g/mL <input id="foodItemFat" type="number" inputmode="decimal" min="0" max="200" step=".1" placeholder="Check label" value="'+(p.fat??"")+'"></label>'+
 '</div>'+
 '<div id="foodScanNutrients" class="foodscan-nutrients"></div>'+
 (!teen?'<button type="button" id="foodScanSave" class="foodscan-save">＋ ADD TO TODAY’S FOOD LOG</button>':'')+
 '<p class="foodscan-check">Nutrition values are per 100 g or mL; adjust quantity and any missing values to match the package. Serving amounts are estimates.</p>';
 result.querySelectorAll("input").forEach(x=>x.addEventListener("input",totals));
 $("#foodScanSave")?.addEventListener("click",saveFood);
 totals();
 result.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function currentNumbers(){
 const amount=num($("#foodItemAmount")?.value);
 const c=teen?null:num($("#foodItemCal")?.value),protein=num($("#foodItemProtein")?.value),carbs=num($("#foodItemCarbs")?.value),fat=num($("#foodItemFat")?.value);
 const mul=amount&&amount>0?amount/100:null;
 const scale=n=>mul!==null&&n!==null?n*mul:null;
 return {name:$("#foodItemName")?.value.trim()||"Food item",amount,calories:scale(c),protein:scale(protein),carbs:scale(carbs),fat:scale(fat)};
}
function totals(){
 const n=currentNumbers();
 $("#foodScanNutrients").innerHTML=(teen?
 '<div><b>'+fmt(n.carbs)+' g</b><small>CARBS</small></div><div><b>'+fmt(n.protein)+' g</b><small>PROTEIN</small></div>':
 '<div><b>'+fmt(n.calories)+'</b><small>CALORIES</small></div><div><b>'+fmt(n.protein)+' g</b><small>PROTEIN</small></div><div><b>'+fmt(n.carbs)+' g</b><small>CARBS</small></div>')+
 '<div><b>'+fmt(n.fat)+' g</b><small>FAT</small></div>';
}
function saveFood(){
 const n=currentNumbers();
 if(!n.amount||n.amount<=0||n.amount>3000){notice("Enter an amount from 1 to 3000 g or mL.");return}
 const rows=data(),r={...n,id:Date.now()+Math.random(),date:localDay(),barcode:active?.barcode||""};
 rows.unshift(r);
 if(!persist(rows))return;
 notice("Added to today’s food log.");renderLog();
}
function renderLog(){
 if(teen)return;
 const rows=data().filter(e=>e.date===localDay());
 const add=k=>rows.reduce((sum,e)=>sum+(num(e[k])??0),0);
 $("#foodLogDay").textContent=new Date().toLocaleDateString(undefined,{month:"short",day:"numeric"});
 $("#foodTotals").innerHTML='<div><strong>'+fmt(add("calories"))+'</strong><small>kcal logged</small></div><div><strong>'+fmt(add("protein"))+' g</strong><small>protein</small></div><div><strong>'+fmt(add("carbs"))+' g</strong><small>carbs</small></div>';
 $("#foodEntries").innerHTML=rows.length?rows.map(e=>'<div class="foodscan-entry"><div><b>'+safe(e.name)+'</b><small>'+fmt(e.amount)+' g/mL · '+fmt(num(e.calories))+' cal · '+fmt(num(e.protein))+' g protein</small></div><button type="button" data-food-delete="'+safe(e.id)+'" aria-label="Delete '+safe(e.name)+'">×</button></div>').join(""):
 '<p>No foods logged today. Your entries will appear here.</p>';
 if(forge)document.dispatchEvent(new Event("forge-food-changed"));
}
root.addEventListener("click",e=>{const b=e.target.closest("[data-food-delete]");if(!b)return;const id=Number(b.dataset.foodDelete);if(!confirm("Remove this food entry?"))return;persist(data().filter(x=>Number(x.id)!==id));renderLog()});
async function lookup(code){
 code=String(code||"").replace(/\D/g,"");
 if(code.length<6||code.length>14){notice("Enter a barcode with 6 to 14 digits.");return}
 $("#foodBarcodeInput").value=code;notice("Looking up product "+code+"…");
 try{
  const url="https://world.openfoodfacts.org/api/v2/product/"+encodeURIComponent(code)+".json?fields=code,product_name,brands,serving_size,serving_quantity,nutriments";
  const res=await fetch(url,{method:"GET",headers:{"Accept":"application/json"}});
  if(!res.ok)throw new Error("Product service is temporarily unavailable");
  const json=await res.json();
  if(json.status===1&&json.product){
   results(json.product,code);notice("");
  }else{results(null,code,"No product found for this barcode. You can enter the nutrition values from the package below.");notice("Product not found. You can enter details manually.")}
 }catch(err){results(null,code,"Could not retrieve nutrition right now. You can still enter details from the label.");notice("Lookup unavailable. Check connection or enter package information manually.")}
}
$("#foodBarcodeForm").addEventListener("submit",e=>{e.preventDefault();stopCamera();lookup($("#foodBarcodeInput").value)});
function loadLibrary(){
 if(window.Html5Qrcode)return Promise.resolve(window.Html5Qrcode);
 if(libPromise)return libPromise;
 libPromise=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
  script.async=true;script.onload=()=>window.Html5Qrcode?resolve(window.Html5Qrcode):reject(new Error("Scanner library didn't load"));
  script.onerror=()=>reject(new Error("Camera scanner unavailable. Enter the barcode manually."));
  document.head.appendChild(script);
 });
 return libPromise;
}
async function stopCamera(){
 if(!scanner){cameraOn=false;$("#foodCameraArea").hidden=true;return}
 try{if(cameraOn)await scanner.stop()}catch(e){}
 try{await scanner.clear()}catch(e){}
 scanner=null;cameraOn=false;reading=false;$("#foodCameraArea").hidden=true;
}
$("#foodCameraButton").addEventListener("click",async()=>{
 if(reading)return;reading=true;notice("Opening your camera…");
 $("#foodCameraArea").hidden=false;
 try{
  const Html5Qrcode=await loadLibrary();
  scanner=new Html5Qrcode("foodCamera",{verbose:false});
  let found=false;
  await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:250,height:155},aspectRatio:1.7778},code=>{
   if(found)return;found=true;
   stopCamera().then(()=>lookup(code));
  },()=>{});
  cameraOn=true;notice("Point the camera at a UPC/EAN barcode. Hold steady.");
 }catch(err){
  await stopCamera();
  notice("Camera unavailable. Allow camera access or use Photo of Barcode / manual entry.");
 }finally{reading=false}
});
$("#foodCameraStop").addEventListener("click",()=>{stopCamera();notice("Camera stopped.")});
$("#foodPhotoButton").addEventListener("click",()=>$("#foodImageFile").click());
$("#foodImageFile").addEventListener("change",async()=>{
 const file=$("#foodImageFile").files?.[0];if(!file)return;
 $("#foodImageFile").value="";notice("Reading barcode photo…");
 try{
  await stopCamera();
  const Html5Qrcode=await loadLibrary();
  scanner=new Html5Qrcode("foodCamera",{verbose:false});
  const barcode=await scanner.scanFile(file,true);
  await stopCamera();await lookup(barcode);
 }catch(e){await stopCamera();notice("Could not read that barcode photo. Try a sharper photo or enter the digits below.")}
});
document.addEventListener("click",e=>{if(e.target.closest("[data-nav]"))stopCamera()});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopCamera()});
window.addEventListener("pagehide",()=>stopCamera());
if(forge)window.forgeFoodProteinToday=()=>data().filter(e=>e.date===localDay()).reduce((n,e)=>n+(num(e.protein)??0),0);
document.addEventListener("foodscan-sync",renderLog);
renderLog();
})();
