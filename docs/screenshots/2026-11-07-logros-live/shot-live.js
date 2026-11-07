const {chromium}=require(require('path').join(__dirname,'../../../tests/node_modules/playwright'));
const H=require(require('path').join(__dirname,'../../../tests/helpers.js'));
(async()=>{
  const url='https://trck3r.netlify.app/', out=process.argv[2];
  const browser=await chromium.launch();
  const r=await H.blankDB({browser,url}); const db=r.db||r; const ids=r.ids;
  H.addS(db,...H.gen(ids,120,"2026-03-01"));
  for(const [d,w] of [["2026-03-01",82],["2026-06-01",80],["2026-09-01",79]]) H.bw(db,d,w);
  for(const theme of ["dark","light"]){
    db.settings.theme=theme;
    const c=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:"block"});
    await c.addInitScript(([s])=>{ if(!sessionStorage.getItem("seeded")){localStorage.setItem("gymtracker_uni_v1",s);sessionStorage.setItem("seeded","1");} },[JSON.stringify(db)]);
    const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url); await p.waitForSelector('.nav'); await p.waitForTimeout(900);
    await p.evaluate(()=>A.goData("logros")); await p.waitForSelector('.lgtile'); await p.waitForTimeout(500);
    await p.screenshot({path:`${out}/s-${theme}.png`});
    if(theme==="dark"){
      await p.evaluate(()=>document.querySelector('.content').scrollTo(0,1500)); await p.waitForTimeout(300);
      await p.screenshot({path:`${out}/s-dark-scroll.png`});
      await p.evaluate(()=>openLogro("c50")); await p.waitForTimeout(500);
      await p.screenshot({path:`${out}/s-sheet.png`});
    }
    console.log(theme,"sessions:",Object.keys(db.sessions).length,"summary:",await p.evaluate(()=>JSON.stringify(logrosSummary())).catch(e=>e.message),"errors:",errs.length?errs:"none");
    await c.close();
  }
  await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1)});
