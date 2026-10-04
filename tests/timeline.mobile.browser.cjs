// Touch-enabled phone contexts are isolated from the user's browser and local notes.
const path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),fs=require('node:fs');
let playwright;try{playwright=require('playwright');}catch{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}
(async()=>{
 const browser=await playwright.chromium.launch({headless:true,executablePath:process.env.EOG_BROWSER_EXECUTABLE||(process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)});
 const base=process.env.EOG_TIMELINE_TEST_URL||'http://127.0.0.1:8037',checks=[],errors=[];
 const check=name=>{checks.push(name);console.log('PASS '+name);};
 const ready=page=>page.waitForFunction(()=>document.body.dataset.timelineReady==='true');
 const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const close=async(page,id)=>{await page.locator(`[data-close-dialog="${id}"]`).tap();await page.waitForFunction(id=>!document.getElementById(id).open,id);await frames(page);};
 const within=async(page,selector)=>{const b=await page.locator(selector).boundingBox(),viewport=page.viewportSize();assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=viewport.width+1&&b.y+b.height<=viewport.height+1,JSON.stringify({selector,b,viewport}));};
 try{
  for(const width of [320,375,390,430]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/timeline.html');await ready(page);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const nav=await page.locator('#tw-overview').boundingBox();assert.ok(Math.abs(nav.y+nav.height-844)<=1);
   for(const id of ['tw-previous','tw-period-button','tw-next','tw-search-toggle','tw-more-button']){const b=await page.locator('#'+id).boundingBox();assert.ok(b.width>=44&&b.height>=44,id+' '+JSON.stringify(b));}
   assert.ok(await page.locator('#tw-records>li').first().evaluate(el=>el.getBoundingClientRect().top)<180);
   check(width+'px: thumb bar, 44px targets, first article visible and no horizontal overflow');
   await page.locator('#tw-period-button').tap();assert.equal(await page.locator('#tw-mobile-date-dialog').evaluate(el=>el.open),true);await within(page,'#tw-mobile-date-dialog');
   assert.equal(await page.locator('#tw-picker-year').evaluate(el=>getComputedStyle(el).fontSize),'16px');await page.locator('#tw-picker-year').selectOption('2025');await page.locator('#period-2025-08').tap();
   await page.waitForFunction(()=>!document.getElementById('tw-mobile-date-dialog').open&&document.getElementById('tw-current-period').textContent==='Aug 2025');
   await frames(page);const target=await page.locator('#tw-records>li').first().boundingBox();assert.ok(target.y>=54&&target.y<120,JSON.stringify(target));
   check(width+'px: year/month touch selection closes the sheet and lands below the header');
   await page.locator('#tw-more-button').tap();await within(page,'#tw-mobile-tools-dialog');await page.locator('#tw-refine-toggle').tap();assert.equal(await page.locator('#tw-mobile-tools-dialog').evaluate(el=>el.open),false);
   assert.equal(await page.locator('#tw-filter-dialog').evaluate(el=>el.open),true);assert.ok(await page.locator('#tw-filter-dialog').evaluate(el=>el.contains(document.activeElement)));await within(page,'#tw-filter-dialog');
   await page.locator('#tw-from').fill('2024-01-01');await page.locator('#tw-to').fill('2024-01-31');await close(page,'tw-filter-dialog');
   assert.equal(await page.locator('#tw-results-title').getAttribute('data-count'),'1');assert.equal(await page.evaluate(()=>document.activeElement.id),'tw-more-button');await page.locator('#tw-browse-all').tap();
   assert.equal(await page.locator('#tw-results-title').getAttribute('data-count'),'1331');
   check(width+'px: tools-to-filter focus, date application and restricted-link recovery');
   await page.screenshot({path:`/tmp/eog-mobile-${width}.png`});await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/timeline.html');await ready(page);await page.locator('#tw-search-toggle').tap();await within(page,'#tw-mobile-search-dialog');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'tw-query');assert.equal(await page.locator('#tw-query').evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await page.locator('#tw-query').pressSequentially('Nasser ',{delay:60});await page.waitForTimeout(450);assert.equal(await page.locator('#tw-query').inputValue(),'Nasser ');await page.locator('#tw-query').pressSequentially('Hospital',{delay:30});await page.waitForTimeout(450);assert.equal(await page.locator('#tw-query').inputValue(),'Nasser Hospital');assert.ok(Number(await page.locator('#tw-results-title').getAttribute('data-count'))>0);
  check('search preserves spaces and the caret across debounced results');
  await page.locator('.tw-search-submit').tap();await page.waitForFunction(()=>!document.getElementById('tw-mobile-search-dialog').open);await frames(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'tw-search-toggle');
  await page.reload();await ready(page);assert.equal(await page.locator('#tw-mobile-search-dialog').evaluate(el=>el.open),false);assert.equal(await page.locator('#tw-query').inputValue(),'Nasser Hospital');
  check('Show articles dismisses search and shared/reloaded queries keep the feed visible');
  await page.locator('#tw-search-toggle').tap();await page.locator('#tw-query').fill('women');await page.locator('#tw-query').press('Enter');await frames(page);assert.equal(await page.locator('#tw-mobile-search-dialog').evaluate(el=>el.open),false);
  check('keyboard Search/Enter shows results and closes the search sheet');
  await page.goto(base+'/timeline.html');await ready(page);await page.locator('#tw-more-button').tap();await page.locator('#tw-options-open').tap();await page.locator('#tw-auto-load').tap();await close(page,'tw-options-dialog');
  await page.locator('#tw-records h3 a').nth(5).scrollIntoViewIfNeeded();const link=page.locator('#tw-records h3 a').nth(5);await link.tap();await page.waitForFunction(()=>document.getElementById('tw-reader-dialog').open);const origin=await page.evaluate(()=>history.state.readerOrigin.scroll);
  await within(page,'#tw-reader-dialog');const footer=await page.locator('.tw-reader-sequence').boundingBox();assert.ok(Math.abs(footer.y+footer.height-844)<=1);assert.equal(await page.locator('.tw-detail-body>p:not(.tw-small)').first().evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await page.locator('#tw-detail').evaluate(el=>el.scrollTop=el.scrollHeight);const correction=await page.locator('#tw-detail a[href="collab.html"]').boundingBox();assert.ok(correction.y+correction.height<=footer.y);
  check('reader footer stays visible while the last source action remains above it');
  const initial=new URL(page.url()).searchParams.get('selected');await page.locator('[data-reader-step="1"]').tap();assert.notEqual(new URL(page.url()).searchParams.get('selected'),initial);await page.locator('[data-close-detail]').tap();await page.waitForFunction(()=>!document.getElementById('tw-reader-dialog').open);await frames(page);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-origin)<=2);
  check('full phone reader has bottom next/previous controls and restores the exact feed position');
  await page.locator('#tw-more').scrollIntoViewIfNeeded();const more=await page.locator('#tw-more').boundingBox(),dock=await page.locator('#tw-overview').boundingBox();assert.ok(more.y+more.height<=dock.y,JSON.stringify({more,dock}));
  check('bottom bar leaves Load more and the end of the feed reachable');
  await page.locator('#tw-search-toggle').tap();await page.setViewportSize({width:390,height:420});await within(page,'#tw-mobile-search-dialog');assert.ok(await page.locator('.tw-search-submit').isVisible());await close(page,'tw-mobile-search-dialog');
  check('search fits a shortened viewport with its submit and close controls reachable');
  await page.setViewportSize({width:844,height:390});await page.locator('#tw-period-button').tap();await within(page,'#tw-mobile-date-dialog');await page.locator('#tw-latest').tap();await page.waitForFunction(()=>!document.getElementById('tw-mobile-date-dialog').open);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/eog-mobile-landscape.png'});
  check('landscape phones retain touch sheets, native scrolling and reachable latest-date action');
  await page.setViewportSize({width:390,height:844});await page.locator('#tw-period-button').tap();await page.setViewportSize({width:1024,height:900});await frames(page);assert.equal(await page.locator('#tw-mobile-date-dialog').evaluate(el=>el.open),false);assert.equal(await page.locator('#tw-picker-year').evaluate(el=>el.closest('#tw-date-picker')?.id),'tw-date-picker');
  await page.locator('#tw-period-button').click();assert.ok(await page.locator('#tw-picker-year').isVisible());await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});await frames(page);
  const ids=await page.evaluate(()=>[...document.querySelectorAll('[id]')].map(el=>el.id));assert.equal(new Set(ids).size,ids.length);await page.locator('#tw-more-button').tap();await within(page,'#tw-mobile-tools-dialog');await page.screenshot({path:'/tmp/eog-mobile-tools.png'});
  check('resizing moves existing controls between desktop and mobile without duplicate IDs');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('tw-mobile-tools-dialog').open);await frames(page);assert.equal(await page.evaluate(()=>document.activeElement.id),'tw-more-button');
  check('Escape closes a phone tool sheet and restores its trigger');
  await page.locator('#tw-search-toggle').tap();await page.screenshot({path:'/tmp/eog-mobile-search.png'});await close(page,'tw-mobile-search-dialog');await page.locator('#tw-period-button').tap();await page.screenshot({path:'/tmp/eog-mobile-date.png'});await close(page,'tw-mobile-date-dialog');
  await context.close();assert.deepEqual(errors,[]);check('no mobile runtime errors');
  fs.writeFileSync('/tmp/eog-timeline-mobile-result.json',JSON.stringify({passed:true,checks,widths:[320,375,390,430,844],touchEnabled:true,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
