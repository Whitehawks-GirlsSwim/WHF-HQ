/* FoodScan v3 — shared across MIA / STRONG, SAM / WELLNESS and FORGE / ATHLETIC.
   Fetches public product nutrition only by barcode. No camera images are uploaded.
   Daily adult logs stay in this browser; teen mode shows fueling info without calorie targets. */
(function(){
"use strict";
const root=document.getElementById("foodScanner");if(!root)return;
const mode=root.dataset.foodMode||"sam",teen=mode==="mia",forge=mode==="forge";
const key=teen?"mia-food-meals-v1":forge?"forge-food-diary-v1":"sam-wellness-food-diary-v1";
const waterKey=teen?"mia-water-diary-v1":forge?"forge-water-diary-v1":"sam-wellness-water-diary-v1";
const waterData=()=>{try{const x=JSON.parse(localStorage.getItem(waterKey)||"[]");return Array.isArray(x)?x:[]}catch(e){return []}};
const saveWaterRows=rows=>{try{localStorage.setItem(waterKey,JSON.stringify(rows.slice(0,500)));return true}catch(e){notice("Storage full. Water entry was not saved.");return false}};
const MEALS=[
 {id:"breakfast",label:"Breakfast",icon:"☀️"},
 {id:"lunch",label:"Lunch",icon:"🥗"},
 {id:"dinner",label:"Dinner",icon:"🍽️"},
 {id:"snacks",label:"Snacks",icon:"🍎"}
];
const mealAtTime=()=>{const hr=new Date().getHours();return hr<11?"breakfast":hr<15?"lunch":hr<20?"dinner":"snacks"};
let selectedMeal=mealAtTime();
const mealOptions=selected=>MEALS.map(m=>'<option value="'+m.id+'"'+(m.id===selected?' selected':'')+'>'+m.label+'</option>').join("");
const mealInfo=id=>MEALS.find(m=>m.id===id)||{id:"earlier",label:"Earlier entries",icon:"📁"};
const mealId=id=>MEALS.some(m=>m.id===id)?id:"earlier";

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
'<h3>'+(teen?'Fuel the whole day.':forge?'Scan. Fuel. Perform.':'Scan your food.')+'</h3>'+
'<p>'+(teen?'See carbs and protein in packaged foods, then organize meals without calorie or weight-loss targets.':'Scan packaged foods, select a meal, and save the serving to your daily journal.')+'</p></div>'+
'<div class="foodscan-meal-picker"><div class="foodscan-meal-caption">ADD FOOD TO <span>· choose before scanning</span></div><div id="foodMealChoices" class="foodscan-meal-choices"></div></div>'+
'<div class="foodscan-actions"><button type="button" class="foodscan-primary" id="foodCameraButton">▣ &nbsp; SCAN BARCODE</button><button type="button" class="foodscan-secondary" id="foodManualOpen">✎ &nbsp; ADD MANUALLY</button></div>'+
'<details class="foodscan-manual" id="foodManualPanel"><summary>✎ MANUAL FOOD ENTRY <span>Food without a barcode? Add it here.</span></summary>'+
'<form id="foodManualForm" class="foodscan-manual-form">'+
'<label class="foodscan-full">MEAL <select id="foodManualMeal" aria-label="Choose meal for manual food">'+mealOptions(selectedMeal)+'</select></label>'+
'<label class="foodscan-full">FOOD NAME <input id="foodManualName" type="text" autocomplete="off" maxlength="100" required placeholder="e.g. Homemade turkey sandwich"></label>'+
(teen?'<label class="foodscan-full">OPTIONAL NOTE <input id="foodManualNote" type="text" maxlength="140" placeholder="e.g. After practice, with fruit"></label>':
'<label>SERVINGS EATEN <input id="foodManualServings" type="number" inputmode="decimal" value="1" step="any" min=".1" max="100" required></label>'+
'<div class="foodscan-manual-note">Enter nutrition <b>per serving</b> from the label or your own estimate. Leave unknown values blank.</div>'+
'<label>CALORIES / SERVING <input id="foodManualCal" type="number" inputmode="decimal" min="0" max="5000" step="1" placeholder="Optional"></label>'+
'<label>PROTEIN (g) / SERVING <input id="foodManualProtein" type="number" inputmode="decimal" min="0" max="300" step=".1" placeholder="Optional"></label>'+
'<label>CARBS (g) / SERVING <input id="foodManualCarbs" type="number" inputmode="decimal" min="0" max="500" step=".1" placeholder="Optional"></label>'+
'<label>FAT (g) / SERVING <input id="foodManualFat" type="number" inputmode="decimal" min="0" max="300" step=".1" placeholder="Optional"></label>')+
'<button type="submit" class="foodscan-save">＋ SAVE MANUAL FOOD</button></form></details>'+
'<div class="foodscan-photo-row"><button type="button" class="foodscan-photo-button" id="foodPhotoButton">▧ &nbsp; Scan barcode from a photo</button></div>'+
'<div id="foodCameraArea" class="foodscan-camera-area" hidden><div id="foodCamera" class="foodscan-camera"></div><button type="button" id="foodCameraStop">STOP CAMERA ×</button></div>'+
'<input id="foodImageFile" type="file" accept="image/*" capture="environment" hidden>'+
'<form id="foodBarcodeForm" class="foodscan-code"><label for="foodBarcodeInput">OR ENTER THE NUMBERS UNDER THE BARCODE</label>'+
'<div><input id="foodBarcodeInput" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="off" placeholder="Barcode / UPC / EAN" aria-label="Barcode number"><button type="submit">LOOK UP ↗</button></div></form>'+
'<div class="foodscan-status" id="foodScanStatus" role="status" aria-live="polite"></div>'+
'<div id="foodScanResult" class="foodscan-result" hidden></div>'+
'<div class="foodscan-journal"><div class="foodscan-journal-heading"><b>'+(teen?'YOUR MEALS TODAY':'TODAY’S MEAL JOURNAL')+'</b><small id="foodLogDay"></small></div>'+(!teen?'<div class="foodscan-totals" id="foodTotals"></div>':'')+'<div class="foodscan-entries" id="foodEntries"></div></div>'+
'<div class="foodscan-water"><div class="foodscan-water-head"><div><b>💧 TODAY’S WATER</b><small>Log drinks when helpful. No fixed target.</small></div><strong id="foodWaterTotal">0 oz</strong></div>'+
'<div class="foodscan-water-actions"><button type="button" data-water-oz="8">＋ 8 oz</button><button type="button" data-water-oz="12">＋ 12 oz</button><button type="button" data-water-oz="16">＋ 16 oz</button></div>'+
'<form id="foodWaterForm" class="foodscan-water-custom"><label for="foodWaterCustom">OTHER AMOUNT (FL OZ)</label><div><input id="foodWaterCustom" type="number" inputmode="decimal" min="1" max="100" step=".5" placeholder="Enter ounces"><button type="submit">ADD</button></div></form>'+
'<div class="foodscan-water-footer"><small id="foodWaterLast"></small><button type="button" id="foodWaterUndo">UNDO LAST</button></div></div>'+
(teen?'<p class="foodscan-teen-note">Food is fuel for swimming, school and recovery. This meal journal does not set calorie targets or rate foods.</p>':'')+
'<p class="foodscan-storage">Your food and water logs stay on this device. <button type="button" id="foodBackupExport">SAVE NUTRITION BACKUP</button> <button type="button" id="foodBackupImportButton">RESTORE</button><input id="foodBackupImportFile" hidden type="file" accept=".json,application/json"></p>'+
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
'<label class="foodscan-full">ADD THIS TO <select id="foodSaveMeal" aria-label="Choose meal for this food">'+mealOptions(selectedMeal)+'</select></label>'+
 '<label class="foodscan-full">NAME <input id="foodItemName" maxlength="90" value="'+safe(p.name)+'" placeholder="Food name"></label>'+
 '<label class="foodscan-full">AMOUNT '+(p.serving?'· LABEL SERVING '+safe(p.serving):'')+
 '<input id="foodItemAmount" type="number" inputmode="decimal" min="1" max="3000" step="1" value="'+safe(p.amount)+'" aria-label="Amount in grams or milliliters"> <small>g or mL consumed</small></label>'+
 (!teen?'<label>CALORIES PER 100 g/mL <input id="foodItemCal" type="number" inputmode="decimal" min="0" max="2000" step=".1" placeholder="Check label" value="'+(p.calories??"")+'"></label>':'')+
 '<label>PROTEIN PER 100 g/mL <input id="foodItemProtein" type="number" inputmode="decimal" min="0" max="200" step=".1" placeholder="Check label" value="'+(p.protein??"")+'"></label>'+
 '<label>CARBS PER 100 g/mL <input id="foodItemCarbs" type="number" inputmode="decimal" min="0" max="200" step=".1" placeholder="Check label" value="'+(p.carbs??"")+'"></label>'+
 '<label>FAT PER 100 g/mL <input id="foodItemFat" type="number" inputmode="decimal" min="0" max="200" step=".1" placeholder="Check label" value="'+(p.fat??"")+'"></label>'+
 '</div>'+
 '<div id="foodScanNutrients" class="foodscan-nutrients"></div>'+
 '<button type="button" id="foodScanSave" class="foodscan-save">＋ SAVE TO '+mealInfo(selectedMeal).label.toUpperCase()+'</button>'+
 '<p class="foodscan-check">Nutrition values are per 100 g or mL; adjust quantity and any missing values to match the package. Serving amounts are estimates.</p>';
 result.querySelectorAll("input").forEach(x=>x.addEventListener("input",totals));
 $("#foodSaveMeal").addEventListener("change",e=>chooseMeal(e.target.value));
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
 const meal=mealId($("#foodSaveMeal")?.value||selectedMeal);
 if(meal==="earlier"){notice("Choose breakfast, lunch, dinner, or snacks.");return}
 const rows=data(),r={...n,calories:teen?null:n.calories,id:Date.now()+Math.random(),date:localDay(),barcode:active?.barcode||"",meal};
 rows.unshift(r);
 if(!persist(rows))return;
 notice("Saved to "+mealInfo(meal).label+".");renderLog();
}

function renderMealPicker(){
 const host=$("#foodMealChoices");if(!host)return;
 host.innerHTML=MEALS.map(m=>'<button type="button" data-food-meal="'+m.id+'" class="'+(selectedMeal===m.id?'active':'')+'" aria-pressed="'+(selectedMeal===m.id)+'">'+m.icon+' '+m.label+'</button>').join("");
 const manual=$("#foodManualMeal");if(manual)manual.value=selectedMeal;
}
function chooseMeal(id){
 if(mealId(id)==="earlier")return;
 selectedMeal=id;renderMealPicker();
 const select=$("#foodSaveMeal");if(select)select.value=id;
 const manual=$("#foodManualMeal");if(manual)manual.value=id;
 const button=$("#foodScanSave");if(button)button.textContent="＋ SAVE TO "+mealInfo(id).label.toUpperCase();
}
function renderLog(){
 const rows=data().filter(e=>e.date===localDay());
 const add=(r,k)=>r.reduce((sum,e)=>sum+(num(e[k])??0),0);
 $("#foodLogDay").textContent=new Date().toLocaleDateString(undefined,{month:"short",day:"numeric"});
 if(!teen){
  $("#foodTotals").innerHTML='<div><strong>'+fmt(add(rows,"calories"))+'</strong><small>kcal logged</small></div><div><strong>'+fmt(add(rows,"protein"))+' g</strong><small>protein</small></div><div><strong>'+fmt(add(rows,"carbs"))+' g</strong><small>carbs</small></div>';
 }
 const groups=MEALS.slice();
 if(rows.some(e=>mealId(e.meal)==="earlier"))groups.push({id:"earlier",label:"Earlier entries",icon:"📁"});
 $("#foodEntries").innerHTML=groups.map(m=>{
  const items=rows.filter(e=>mealId(e.meal)===m.id);
  const subtotal=!teen?(items.length?'<div class="foodscan-group-subtotal">'+fmt(add(items,"calories"))+' cal · '+fmt(add(items,"protein"))+' g protein</div>':'<div class="foodscan-group-subtotal">Nothing logged yet</div>'):'<div class="foodscan-group-subtotal">'+(items.length?items.length+' item'+(items.length===1?'':'s')+' added':'Nothing added yet')+'</div>';
  const itemHtml=items.map(e=>{
   const moveOptions=mealOptions(m.id);
   const controls='<select class="foodscan-reassign" data-food-move="'+safe(e.id)+'" aria-label="Move '+safe(e.name)+' to another meal">'+(m.id==="earlier"?'<option value="earlier">Move to...</option>':'')+moveOptions+'</select>';
   const qty=e.source==="manual"?(teen?"Manual entry":fmt(e.amount)+' serving'+(e.amount===1?'':'s')):fmt(e.amount)+' g/mL';
   const details=teen?(e.note?safe(e.note):qty):qty+(e.calories===null||e.calories===undefined?'':' · '+fmt(num(e.calories))+' cal')+(e.protein===null||e.protein===undefined?'':' · '+fmt(num(e.protein))+' g protein');
   return '<div class="foodscan-entry"><div><b>'+safe(e.name)+'</b><small>'+details+'</small>'+controls+'</div><button type="button" data-food-delete="'+safe(e.id)+'" aria-label="Delete '+safe(e.name)+'">×</button></div>';
  }).join("");
  return '<section class="foodscan-meal-group" aria-label="'+safe(m.label)+'"><div class="foodscan-meal-group-top"><div><strong>'+m.icon+' '+safe(m.label)+'</strong>'+subtotal+'</div>'+
   (m.id!=="earlier"?'<button type="button" data-food-target="'+m.id+'">＋ ADD FOOD</button>':'')+'</div>'+
   (itemHtml||'<p class="foodscan-empty">'+(m.id==="earlier"?'Earlier scanned foods appear here. You can move them into a meal.':'Tap + Scan to add a food to '+m.label.toLowerCase()+'.')+'</p>')+'</section>';
 }).join("");
 if(forge)document.dispatchEvent(new Event("forge-food-changed"));
}
root.addEventListener("click",e=>{
 const target=e.target.closest("[data-food-target]");
 if(target){chooseMeal(target.dataset.foodTarget);openManual();return}
 const pick=e.target.closest("[data-food-meal]");if(pick){chooseMeal(pick.dataset.foodMeal);return}
 const b=e.target.closest("[data-food-delete]");if(!b)return;
 const id=Number(b.dataset.foodDelete);if(!confirm("Remove this food entry?"))return;
 if(persist(data().filter(x=>Number(x.id)!==id)))renderLog();
});
root.addEventListener("change",e=>{
 const move=e.target.closest("[data-food-move]");if(!move||mealId(move.value)==="earlier")return;
 const id=Number(move.dataset.foodMove),rows=data(),item=rows.find(x=>Number(x.id)===id);
 if(!item)return;
 item.meal=move.value;
 if(persist(rows)){renderLog();notice("Moved to "+mealInfo(item.meal).label+".")}
});
renderMealPicker();


function openManual(){
 const panel=$("#foodManualPanel");panel.open=true;
 $("#foodManualMeal").value=selectedMeal;
 panel.scrollIntoView({behavior:"smooth",block:"start"});
 $("#foodManualName").focus({preventScroll:true});
}
$("#foodManualOpen").addEventListener("click",openManual);
$("#foodManualMeal").addEventListener("change",e=>chooseMeal(e.target.value));
$("#foodManualForm").addEventListener("submit",e=>{
 e.preventDefault();
 const name=$("#foodManualName").value.trim(),meal=mealId($("#foodManualMeal").value);
 if(!name||meal==="earlier"){notice("Enter a food name and select a meal.");return}
 const entry={id:Date.now()+Math.random(),date:localDay(),name:name.slice(0,100),meal,source:"manual",barcode:"",calories:null,protein:null,carbs:null,fat:null,amount:1};
 if(teen){entry.note=$("#foodManualNote").value.trim().slice(0,140)}
 else{
  const servings=num($("#foodManualServings").value);
  if(servings===null||servings<.1||servings>100){notice("Servings must be between 0.1 and 100.");return}
  entry.amount=servings;
  const fields=[["calories","#foodManualCal",5000],["protein","#foodManualProtein",300],["carbs","#foodManualCarbs",500],["fat","#foodManualFat",300]];
  for(const [field,id,max] of fields){
   const raw=$(id).value.trim();
   if(raw===""){entry[field]=null;continue}
   const value=num(raw);
   if(value===null||value<0||value>max){notice("Check the "+field+" value.");return}
   entry[field]=r1(value*servings);
  }
 }
 const rows=data();rows.unshift(entry);
 if(!persist(rows))return;
 $("#foodManualName").value="";
 if(teen)$("#foodManualNote").value="";
 else{
  $("#foodManualServings").value="1";
  ["#foodManualCal","#foodManualProtein","#foodManualCarbs","#foodManualFat"].forEach(id=>$(id).value="");
 }
 $("#foodManualPanel").open=false;
 notice("Added "+name+" to "+mealInfo(meal).label+".");renderLog();
});
function renderWater(){
 const rows=waterData().filter(e=>e.date===localDay());
 const ounces=rows.reduce((sum,e)=>sum+(num(e.oz)??0),0);
 $("#foodWaterTotal").textContent=fmt(ounces)+" fl oz";
 $("#foodWaterLast").textContent=rows.length?rows.length+" water entr"+(rows.length===1?"y":"ies")+" today":"Start with a glass of water.";
}
function addWater(value){
 const oz=num(value);
 if(oz===null||oz<=0||oz>100){notice("Enter 1–100 fl oz.");return}
 const rows=waterData();rows.unshift({id:Date.now()+Math.random(),date:localDay(),oz});
 if(!saveWaterRows(rows))return;
 renderWater();notice("Added "+fmt(oz)+" fl oz of water.");
}
root.addEventListener("click",e=>{const b=e.target.closest("[data-water-oz]");if(b)addWater(b.dataset.waterOz)});
$("#foodWaterForm").addEventListener("submit",e=>{e.preventDefault();addWater($("#foodWaterCustom").value);$("#foodWaterCustom").value=""});
$("#foodWaterUndo").addEventListener("click",()=>{
 const rows=waterData(),pos=rows.findIndex(e=>e.date===localDay());
 if(pos<0){notice("No water entries to undo.");return}
 rows.splice(pos,1);
 if(saveWaterRows(rows)){renderWater();notice("Last water entry undone.")}
});
$("#foodBackupExport").addEventListener("click",async()=>{
 try{
  const payload={format:"foodscan-nutrition-v1",exportedAt:new Date().toISOString(),meals:data(),water:waterData()};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const filename=(teen?"MIA":forge?"FORGE":"SAM")+"-nutrition-"+localDay()+".json";
  const file=new File([blob],filename,{type:"application/json"});
  if(navigator.canShare?.({files:[file]})&&navigator.share){
   try{await navigator.share({files:[file],title:"Private food and water backup"});notice("Nutrition backup shared.");return}
   catch(e){if(e?.name==="AbortError")return}
  }
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);
  notice("Save the nutrition backup to Files.");
 }catch(e){notice("Could not export. Try Safari.")}
});
$("#foodBackupImportButton").addEventListener("click",()=>$("#foodBackupImportFile").click());
$("#foodBackupImportFile").addEventListener("change",async()=>{
 const input=$("#foodBackupImportFile"),file=input.files?.[0];
 if(!file)return;
 try{
  if(file.size>5000000)throw Error("Backup too large");
  const payload=JSON.parse(await file.text());
  if(payload.format!=="foodscan-nutrition-v1"||!Array.isArray(payload.meals)||!Array.isArray(payload.water))throw Error("Not a nutrition backup");
  if(!confirm("Replace the current food and water journal with this backup? Workouts and photos will not change."))return;
  if(!persist(payload.meals)||!saveWaterRows(payload.water))throw Error("Storage unavailable");
  renderLog();renderWater();notice("Food and water history restored.");
 }catch(e){notice("Could not restore that nutrition backup.")}
 finally{input.value=""}
});

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
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopCamera();else{renderLog();renderWater()}});
window.addEventListener("pagehide",()=>stopCamera());
if(forge)window.forgeFoodProteinToday=()=>data().filter(e=>e.date===localDay()).reduce((n,e)=>n+(num(e.protein)??0),0);
document.addEventListener("foodscan-sync",()=>{renderLog();renderWater()});
renderLog();renderWater();
})();
