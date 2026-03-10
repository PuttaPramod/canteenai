const BASE={
  "Biryani":{base:120,vol:0.25},"Fried Rice":{base:95,vol:0.18},
  "Chapati":{base:80,vol:0.15},"Veg Curry":{base:70,vol:0.20},
  "Samosa":{base:60,vol:0.30},"Dosa":{base:85,vol:0.22},
  "Pasta":{base:50,vol:0.28},"Fresh Juice":{base:45,vol:0.35},
  "Noodles":{base:65,vol:0.26},"Paneer Butter Masala":{base:75,vol:0.22},
};
const F={
  day:{Monday:0.85,Tuesday:0.90,Wednesday:1.00,Thursday:0.95,Friday:1.25,Saturday:0.70,Sunday:0.50},
  meal:{Breakfast:0.60,Lunch:1.00,"Evening Snacks":0.45,Dinner:0.72},
  weather:{Sunny:1.00,Rainy:0.78,Cloudy:0.88,"Hot & Humid":1.12,Cold:0.82},
  event:{None:1.00,"Sports Day":1.38,"Cultural Fest":1.55,"Exam Week":0.68,Holiday:0.38,"Freshers Day":1.42,"Annual Day":1.60},
  footfall:{"Low (<100 people)":0.60,"Medium (100–300)":1.00,"High (300–600)":1.45,"Very High (600+)":1.85},
};

function mlPredict(item,day,meal,weather,event,footfall){
  const b=BASE[item]||{base:70,vol:0.22};
  const d=F.day[day]||1,m=F.meal[meal]||1,w=F.weather[weather]||1,
        e=F.event[event]||1,ff=F.footfall[footfall]||1;
  const p=Math.round(b.base*d*m*w*e*ff);
  return{
    predicted:p,lower:Math.round(p*(1-b.vol)),upper:Math.round(p*(1+b.vol)),
    confidence:Math.round((1-b.vol*0.5)*100),
    waste:Math.round(Math.max(0,p*(1+b.vol)-p)*0.15),
    factors:{day:d,meal:m,weather:w,event:e,footfall:ff}
  };
}

function getSel(){
  return{
    item:document.getElementById('s-item').value,
    day:document.getElementById('s-day').value,
    meal:document.getElementById('s-meal').value,
    weather:document.getElementById('s-weather').value,
    event:document.getElementById('s-event').value,
    footfall:document.getElementById('s-footfall').value,
  };
}

let activeTab='weekly', lastResult=null, predHistory=[];

// ── RUN ───────────────────────────────────────────────────────────────────────
async function runPrediction(){
  const btn=document.getElementById('run-btn');
  btn.classList.add('loading');btn.disabled=true;
  const sel=getSel();
  const r=mlPredict(sel.item,sel.day,sel.meal,sel.weather,sel.event,sel.footfall);
  lastResult={sel,r};
  updateMetrics(r,sel);
  updateFactors(r.factors);
  renderChart();
  renderRecs(r,sel);
  addHistory(sel,r);
  await fetchAI(sel,r);
  btn.classList.remove('loading');btn.disabled=false;
}

// ── CLAUDE AI ────────────────────────────────────────────────────────────────
async function fetchAI(sel,r){
  const box=document.getElementById('ai-text');
  box.className='ai-body dim';
  box.innerHTML='Analyzing your inputs and generating advice<span class="cblink"></span>';

  const prompt=`You are a helpful canteen operations assistant. A canteen manager needs practical advice.

Today's scenario:
- Food Item: ${sel.item}
- Day: ${sel.day}, Meal Time: ${sel.meal}
- Weather: ${sel.weather}
- Special Event: ${sel.event}
- Expected Footfall: ${sel.footfall}

ML Prediction Results:
- Recommended portions to prepare: ${r.predicted}
- Minimum safe quantity: ${r.lower}
- Maximum (peak) quantity: ${r.upper}
- Model confidence: ${r.confidence}%
- Estimated waste risk: ${r.waste} portions

Write 3–4 clear, helpful sentences telling the manager: exactly how much to prepare, when to start cooking, any important risks to watch out for, and one practical tip to save cost or reduce waste. Use simple language. No bullet points, just flowing advice.`;

  try{
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:300,
        messages:[{role:"user",content:prompt}]
      })
    });
    if(!res.ok){
      const err=await res.json();
      throw new Error(err.error?.message||'API error');
    }
    const data=await res.json();
    const text=(data.content&&data.content[0]&&data.content[0].text)||"Analysis unavailable.";
    box.className='ai-body';
    box.innerHTML='';
    let i=0;
    const cur=document.createElement('span');cur.className='cblink';
    function type(){
      if(i<text.length){box.textContent=text.slice(0,i+1);box.appendChild(cur);i++;setTimeout(type,13);}
      else{cur.remove();}
    }
    type();
  }catch(err){
    box.className='ai-body';
    box.innerHTML=`
      <div style="background:rgba(240,90,58,0.12);border:1px solid rgba(240,90,58,0.3);border-radius:10px;padding:12px 14px;font-size:13px;color:rgba(255,255,255,0.75)">
        ⚠️ <strong>AI Analysis Unavailable</strong><br>
        <span style="font-size:12px;opacity:0.7">The ML prediction above is still fully accurate. AI narrative requires an active API connection.</span>
      </div>
      <div style="margin-top:12px;font-size:13px;color:rgba(255,255,255,0.6)">
        📌 <strong>Based on ML model:</strong> Prepare <strong style="color:#12bdb8">${r.predicted} portions</strong> of ${sel.item}.
        Range is ${r.lower}–${r.upper}. Confidence: ${r.confidence}%. Waste risk: ${r.waste} units.
        ${sel.event!=='None'?`Note: "${sel.event}" significantly affects demand.`:''}
      </div>`;
  }
}

// ── METRICS ──────────────────────────────────────────────────────────────────
function animCount(el,to,suffix=''){
  let v=0;const inc=to/36;
  const t=setInterval(()=>{v=Math.min(v+inc,to);el.textContent=Math.round(v)+suffix;if(v>=to)clearInterval(t);},16);
}

function updateMetrics(r,sel){
  animCount(document.getElementById('mv-pred'),r.predicted);
  animCount(document.getElementById('mv-low'),r.lower);
  animCount(document.getElementById('mv-high'),r.upper);
  animCount(document.getElementById('mv-conf'),r.confidence,'%');
  animCount(document.getElementById('mv-waste'),r.waste);

  document.getElementById('ms-pred').textContent=`Ideal quantity for ${sel.day} ${sel.meal}`;

  const[ul,uc,ud]=r.predicted>100?['HIGH 🔴','#f05a3a','Start cooking 90 min early']:
    r.predicted>60?['MEDIUM 🟡','#d97706','Start cooking 60 min early']:['LOW 🟢','#16a34a','Standard prep time is fine'];
  document.getElementById('mv-urgency').textContent=ul;
  document.getElementById('mv-urgency').style.color=uc;
  document.getElementById('ms-urgency').textContent=ud;

  // Show meaning box
  const mb=document.getElementById('meaning-box');
  mb.style.display='block';
  document.getElementById('mb-text').textContent=r.predicted;
  document.getElementById('mb-upper').textContent=r.upper;
  document.getElementById('mb-lower').textContent=r.lower;
}

// ── FACTORS ──────────────────────────────────────────────────────────────────
function updateFactors(f){
  const map={day:f.day,meal:f.meal,weather:f.weather,event:f.event,footfall:f.footfall};
  Object.entries(map).forEach(([k,v])=>{
    document.getElementById('fv-'+k).textContent=(v*100).toFixed(0)+'%';
    document.getElementById('ff-'+k).style.width=Math.min(v*65,100)+'%';
  });
}

// ── RECS ──────────────────────────────────────────────────────────────────────
function renderRecs(r,sel){
  const evtMsg=sel.event!=='None'
    ?`"${sel.event}" boosts demand by ${Math.round((F.event[sel.event]-1)*100)}%. Order extra ingredients in advance.`
    :'No special event today — standard preparation quantities apply.';
  const wxMsg=F.weather[sel.weather]>=1
    ?`${sel.weather} weather increases demand by ${Math.round((F.weather[sel.weather]-1)*100)}%. Consider more hot or refreshing items.`
    :`${sel.weather} conditions reduce demand by ${Math.abs(Math.round((F.weather[sel.weather]-1)*100))}%. Prepare lighter portions to avoid waste.`;
  const cards=[
    {icon:'📦',title:'How Much to Prepare',color:'#0ea5a0',bg:'#e6f7f7',border:'rgba(14,165,160,0.25)',
     text:`Prepare ${r.upper} portions to be safe on a busy day. The model expects ${r.predicted} — that's your target. Never prepare below ${r.lower} or you risk running out.`},
    {icon:'🗑️',title:'Reduce Waste',color:'#16a34a',bg:'#f0fdf4',border:'rgba(22,163,74,0.2)',
     text:`Estimated ${r.waste} portions could go unsold. Use the FIFO method (first in, first out) and track leftovers daily to improve future predictions.`},
    {icon:'🎉',title:'Event Impact',color:'#d97706',bg:'#fffbeb',border:'rgba(217,119,6,0.2)',text:evtMsg},
    {icon:'🌤️',title:'Weather Impact',color:'#334155',bg:'#f8fafc',border:'rgba(51,65,85,0.15)',text:wxMsg},
  ];
  document.getElementById('recs-grid').innerHTML=cards.map(c=>`
    <div class="rec" style="background:${c.bg};border-color:${c.border}">
      <div class="rec-icon">${c.icon}</div>
      <h4 style="color:${c.color}">${c.title}</h4>
      <p>${c.text}</p>
    </div>`).join('');
}

// ── HISTORY ──────────────────────────────────────────────────────────────────
function addHistory(sel,r){
  const now=new Date();
  predHistory.unshift({sel,r,time:now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  if(predHistory.length>8)predHistory.pop();
  const cc=c=>c>=85?'#16a34a':c>=70?'#d97706':'#dc2626';
  const cb=c=>c>=85?'#f0fdf4':c>=70?'#fffbeb':'#fef2f2';
  document.getElementById('hist-body').innerHTML=predHistory.map(h=>`
    <tr>
      <td>${h.sel.item}</td>
      <td>${h.sel.day.slice(0,3)}</td>
      <td>${h.sel.meal}</td>
      <td style="color:#0ea5a0;font-weight:700;font-size:15px">${h.r.predicted} units</td>
      <td style="color:#64748b">${h.r.lower} – ${h.r.upper}</td>
      <td><span class="badge" style="background:${cb(h.r.confidence)};color:${cc(h.r.confidence)}">${h.r.confidence}%</span></td>
      <td style="color:${h.sel.event==='None'?'#94a3b8':'#d97706'}">${h.sel.event}</td>
      <td style="color:#94a3b8">${h.time}</td>
    </tr>`).join('');
}

// ── CHART ────────────────────────────────────────────────────────────────────
function switchTab(btn){
  document.querySelectorAll('.pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');activeTab=btn.dataset.t;renderChart();
}

function getChartData(){
  if(!lastResult)return{labels:[],values:[],type:'bar',selected:-1};
  const{sel}=lastResult;
  if(activeTab==='weekly'){
    const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const vals=days.map(d=>mlPredict(sel.item,d,sel.meal,sel.weather,sel.event,sel.footfall).predicted);
    const selIdx=days.indexOf(sel.day);
    document.getElementById('chart-sub').textContent=`${sel.item} demand across the week — ${sel.meal}`;
    document.getElementById('chart-legend').style.display='flex';
    document.getElementById('legend-selected').style.display='flex';
    document.getElementById('legend-sel-text').textContent=`${sel.day} (your selected day)`;
    return{labels:days.map(d=>d.slice(0,3)),values:vals,type:'bar',selected:selIdx};
  }else if(activeTab==='hourly'){
    const meals=['Breakfast','Lunch','Evening Snacks','Dinner'];
    const labels=['7–9 AM','12–2 PM','4–6 PM','7–9 PM'];
    const vals=meals.map(m=>mlPredict(sel.item,sel.day,m,sel.weather,sel.event,sel.footfall).predicted);
    const selIdx=meals.indexOf(sel.meal);
    document.getElementById('chart-sub').textContent=`${sel.item} demand by meal time on ${sel.day}`;
    document.getElementById('chart-legend').style.display='flex';
    document.getElementById('legend-selected').style.display='flex';
    document.getElementById('legend-sel-text').textContent=`${sel.meal} (your selected meal)`;
    return{labels,values:vals,type:'line',selected:selIdx};
  }else{
    const items=Object.keys(BASE);
    const d=items.map(it=>({
      label:it.length>9?it.slice(0,8)+'…':it,
      val:mlPredict(it,sel.day,sel.meal,sel.weather,sel.event,sel.footfall).predicted,
      isSelected:it===sel.item
    })).sort((a,b)=>b.val-a.val);
    const selIdx=d.findIndex(x=>x.isSelected);
    document.getElementById('chart-sub').textContent=`All items compared — ${sel.day} ${sel.meal}`;
    document.getElementById('chart-legend').style.display='flex';
    document.getElementById('legend-selected').style.display='flex';
    document.getElementById('legend-sel-text').textContent=`${sel.item} (your selected item)`;
    return{labels:d.map(x=>x.label),values:d.map(x=>x.val),type:'bar',selected:selIdx};
  }
}

function renderChart(){
  const canvas=document.getElementById('chart');
  canvas.width=canvas.parentElement.clientWidth-48;
  canvas.height=230;
  const ctx=canvas.getContext('2d');
  const{labels,values,type,selected}=getChartData();

  if(!labels.length){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#94a3b8';ctx.font='13px Plus Jakarta Sans';ctx.textAlign='center';
    ctx.fillText('Run a prediction to see the chart',canvas.width/2,108);return;
  }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  const W=canvas.width,H=canvas.height;
  const P={top:22,right:14,bottom:50,left:46};
  const cw=W-P.left-P.right,ch=H-P.top-P.bottom;
  const n=values.length;
  const maxV=Math.max(...values,10)*1.2;
  const yS=v=>P.top+ch-(v/maxV)*ch;

  // Y grid lines with labels
  for(let i=0;i<=4;i++){
    const y=P.top+(i/4)*ch;
    ctx.strokeStyle='rgba(100,116,139,0.1)';ctx.lineWidth=1;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.moveTo(P.left,y);ctx.lineTo(P.left+cw,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#94a3b8';ctx.font='10px Plus Jakarta Sans';ctx.textAlign='right';
    ctx.fillText(Math.round(maxV*(4-i)/4)+' units',P.left-5,y+4);
  }

  if(type==='line'){
    const xs=i=>P.left+(i/(n-1))*cw;
    // Area
    const grad=ctx.createLinearGradient(0,P.top,0,P.top+ch);
    grad.addColorStop(0,'rgba(14,165,160,0.18)');grad.addColorStop(1,'rgba(14,165,160,0.01)');
    ctx.beginPath();ctx.moveTo(xs(0),yS(0));
    for(let i=0;i<n;i++)ctx.lineTo(xs(i),yS(values[i]));
    ctx.lineTo(xs(n-1),yS(0));ctx.closePath();ctx.fillStyle=grad;ctx.fill();
    // Line
    ctx.beginPath();ctx.moveTo(xs(0),yS(values[0]));
    for(let i=1;i<n;i++){const cx=(xs(i-1)+xs(i))/2;ctx.bezierCurveTo(cx,yS(values[i-1]),cx,yS(values[i]),xs(i),yS(values[i]));}
    ctx.strokeStyle='#0ea5a0';ctx.lineWidth=2.5;ctx.stroke();
    // Dots
    for(let i=0;i<n;i++){
      const isSel=i===selected;
      ctx.beginPath();ctx.arc(xs(i),yS(values[i]),isSel?7:5,0,Math.PI*2);
      ctx.fillStyle=isSel?'#f05a3a':'#0ea5a0';ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#1e293b';ctx.font=`bold 11px Plus Jakarta Sans`;ctx.textAlign='center';
      ctx.fillText(values[i]+' units',xs(i),yS(values[i])-12);
      ctx.fillStyle='#64748b';ctx.font='11px Plus Jakarta Sans';
      ctx.fillText(labels[i],xs(i),P.top+ch+20);
    }
  }else{
    const bw=cw/n*0.55,gap=cw/n;
    const maxVal=Math.max(...values);
    for(let i=0;i<n;i++){
      const x=P.left+i*gap+(gap-bw)/2;
      const y=yS(values[i]);const h2=yS(0)-y;
      const isSel=i===selected;
      const isMax=values[i]===maxVal;
      const grad=ctx.createLinearGradient(0,y,0,y+h2);
      if(isSel){grad.addColorStop(0,'#f05a3a');grad.addColorStop(1,'rgba(240,90,58,0.3)');}
      else if(isMax){grad.addColorStop(0,'#0ea5a0');grad.addColorStop(1,'rgba(14,165,160,0.25)');}
      else{grad.addColorStop(0,'#0f2044');grad.addColorStop(1,'rgba(15,32,68,0.2)');}
      ctx.fillStyle=grad;
      const r=5;
      ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+bw-r,y);
      ctx.quadraticCurveTo(x+bw,y,x+bw,y+r);ctx.lineTo(x+bw,y+h2);
      ctx.lineTo(x,y+h2);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();ctx.fill();
      // Value label
      ctx.fillStyle='#1e293b';ctx.font='bold 10.5px Plus Jakarta Sans';ctx.textAlign='center';
      ctx.fillText(values[i],x+bw/2,y-5);
      // X label
      ctx.fillStyle=isSel?'#f05a3a':'#64748b';
      ctx.font=isSel?'bold 11px Plus Jakarta Sans':'11px Plus Jakarta Sans';
      ctx.fillText(labels[i],x+bw/2,P.top+ch+20);
    }
  }

  // Axis lines
  ctx.strokeStyle='rgba(100,116,139,0.15)';ctx.lineWidth=1.5;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(P.left,P.top);ctx.lineTo(P.left,P.top+ch);ctx.lineTo(P.left+cw,P.top+ch);ctx.stroke();
}

// ── SCROLL SPY ────────────────────────────────────────────────────────────────
const sections=['predict','results','charts','insights','recommendations','history'];
window.addEventListener('scroll',()=>{
  let cur='';
  sections.forEach(id=>{const el=document.getElementById(id);if(el&&el.getBoundingClientRect().top<100)cur=id;});
  document.querySelectorAll('.nav-link').forEach(a=>{a.classList.toggle('active',a.getAttribute('href')==='#'+cur);});
});
window.addEventListener('resize',()=>{if(lastResult)renderChart();});

// ── DEFAULTS ──────────────────────────────────────────────────────────────────
document.getElementById('s-day').value='Friday';
document.getElementById('s-meal').value='Lunch';
document.getElementById('s-footfall').value='High (300–600)';

// Placeholder chart
(function(){
  const c=document.getElementById('chart');
  c.width=c.parentElement.clientWidth-48;c.height=230;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#cbd5e1';ctx.font='13px Plus Jakarta Sans';ctx.textAlign='center';
  ctx.fillText('Select parameters above and click Run AI Prediction',c.width/2,105);
  ctx.font='12px Plus Jakarta Sans';ctx.fillStyle='#e2e8f0';
  ctx.fillText('Your demand chart will appear here',c.width/2,126);
})();