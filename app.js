const goal=30000;
let data=JSON.parse(localStorage.getItem("whfAppClearFilled")||JSON.stringify({fund:0,sponsors:[{name:"Your Business Here",note:"Become a sponsor and support WHF girls swim & dive."}]}));

function showScreen(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".bottomNav button").forEach(b=>b.classList.toggle("active",b.dataset.screen===id));
}

function greet(){
  const h=new Date().getHours();
  document.getElementById("greeting").textContent=h<12?"good morning":h<18?"good afternoon":"good evening";
}

function save(){
  localStorage.setItem("whfAppClearFilled",JSON.stringify(data));
  render();
}

function render(){
  greet();
  const water = document.getElementById("water");
  const poolText = document.getElementById("poolText");
  const sponsorWall = document.getElementById("sponsorWall");
  const pct=Math.min(100,Math.round((data.fund/goal)*100));
  if (water) water.style.height=pct+"%";
  if (poolText) poolText.innerHTML="$"+data.fund.toLocaleString()+"<br><small>of $30,000</small>";
  if (sponsorWall) {
    sponsorWall.innerHTML=data.sponsors.map((s,i)=>`<div class="card green"><h3>${s.name}</h3><p>${s.note||""}</p><button class="ghost" onclick="removeSponsor(${i})">remove</button></div>`).join("");
  }
}

function addSponsor(){
  let name=document.getElementById("sponsorName").value.trim();
  let note=document.getElementById("sponsorNote").value.trim();
  if(name){
    data.sponsors.push({name,note});
    document.getElementById("sponsorName").value="";
    document.getElementById("sponsorNote").value="";
    save();
  }
}
function removeSponsor(i){data.sponsors.splice(i,1);save()}
function clearSponsors(){data.sponsors=[];save()}
function updateFund(){
  let amount=parseInt(document.getElementById("fundTotal").value,10);
  if(!isNaN(amount)){
    data.fund=amount;
    document.getElementById("fundTotal").value="";
    save();
  }
}
function resetFund(){data.fund=0;save()}

render();
