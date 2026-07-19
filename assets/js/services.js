/**
 * Services.html page interactions.
 * Shared navigation behavior lives in site-navigation.js.
 */
const capabilityTabs=[...document.querySelectorAll('[role="tab"][data-tab]')];
const capabilityPanels=[...document.querySelectorAll('[data-panel]')];
function activateCapability(panelId,{focus=false,updateHash=false}={}){
  const activeTab=capabilityTabs.find(tab=>tab.dataset.tab===panelId)??capabilityTabs[0];
  capabilityTabs.forEach(tab=>{const selected=tab===activeTab;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1});
  capabilityPanels.forEach(panel=>panel.hidden=panel.id!==activeTab.dataset.tab);
  if(focus)activeTab.focus();
  if(updateHash)history.replaceState(null,'',`#${activeTab.dataset.tab}`);
}
capabilityTabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>activateCapability(tab.dataset.tab,{updateHash:true}));
  tab.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    let nextIndex=index;
    if(event.key==='ArrowRight')nextIndex=(index+1)%capabilityTabs.length;
    if(event.key==='ArrowLeft')nextIndex=(index-1+capabilityTabs.length)%capabilityTabs.length;
    if(event.key==='Home')nextIndex=0;
    if(event.key==='End')nextIndex=capabilityTabs.length-1;
    activateCapability(capabilityTabs[nextIndex].dataset.tab,{focus:true,updateHash:true});
  });
});
const initialPanel=capabilityPanels.some(panel=>`#${panel.id}`===location.hash)?location.hash.slice(1):'irb-services';
activateCapability(initialPanel);
window.addEventListener('hashchange',()=>{const panelId=location.hash.slice(1);if(capabilityPanels.some(panel=>panel.id===panelId))activateCapability(panelId)});

function enhanceServicePanel(panel){
  const sheet=panel.querySelector('.service-sheet');
  const grid=sheet?.querySelector('.service-grid');
  const services=grid?[...grid.querySelectorAll(':scope > .service-item')]:[];
  if(!sheet||!grid||!services.length)return;

  const explorer=document.createElement('div');
  explorer.className='service-explorer';
  const serviceIndex=document.createElement('nav');
  serviceIndex.className='service-index';
  const practiceName=panel.querySelector(':scope > h2')?.textContent.trim()||'Practice area';
  serviceIndex.setAttribute('aria-label',`${practiceName} service options`);
  const stage=document.createElement('div');
  stage.className='service-stage';
  stage.id=`${panel.id}-detail`;
  stage.setAttribute('role','region');
  stage.setAttribute('aria-live','polite');
  stage.setAttribute('aria-atomic','true');
  const selectors=[];

  function showService(index,{focus=false}={}){
    const service=services[index];
    const sourceTitle=service.querySelector('h4');
    if(!service||!sourceTitle)return;
    selectors.forEach((selector,selectorIndex)=>selector.setAttribute('aria-pressed',String(selectorIndex===index)));
    stage.replaceChildren();

    const meta=document.createElement('div');
    meta.className='stage-meta';
    const metaLabel=document.createElement('span');
    metaLabel.textContent='Service detail';
    const position=document.createElement('span');
    position.textContent=`${String(index+1).padStart(2,'0')} / ${String(services.length).padStart(2,'0')}`;
    meta.append(metaLabel,position);

    const title=sourceTitle.cloneNode(true);
    title.className='stage-title';
    title.id=`${panel.id}-detail-title`;
    stage.setAttribute('aria-labelledby',title.id);
    const content=document.createElement('div');
    content.className='stage-content';
    [...service.children].slice(1).forEach(child=>content.append(child.cloneNode(true)));
    const action=document.createElement('a');
    action.className='stage-action';
    action.href='Contact.html';
    action.textContent='Discuss this service';
    stage.append(meta,title,content,action);
    stage.classList.remove('is-changing');
    void stage.offsetWidth;
    stage.classList.add('is-changing');
    if(focus)selectors[index].focus();
  }

  services.forEach((service,index)=>{
    const selector=document.createElement('button');
    selector.type='button';
    selector.className='service-selector';
    selector.setAttribute('aria-controls',stage.id);
    selector.setAttribute('aria-pressed','false');
    const sequence=document.createElement('span');
    sequence.className='service-sequence';
    sequence.textContent=String(index+1).padStart(2,'0');
    const name=document.createElement('span');
    name.className='service-name';
    name.textContent=service.querySelector('h4')?.textContent||`Service ${index+1}`;
    selector.append(sequence,name);
    selector.addEventListener('click',()=>showService(index));
    selector.addEventListener('keydown',event=>{
      if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
      event.preventDefault();
      let nextIndex=index;
      if(['ArrowDown','ArrowRight'].includes(event.key))nextIndex=(index+1)%selectors.length;
      if(['ArrowUp','ArrowLeft'].includes(event.key))nextIndex=(index-1+selectors.length)%selectors.length;
      if(event.key==='Home')nextIndex=0;
      if(event.key==='End')nextIndex=selectors.length-1;
      showService(nextIndex,{focus:true});
    });
    selectors.push(selector);
    serviceIndex.append(selector);
  });

  explorer.append(serviceIndex,stage);
  grid.before(explorer);
  showService(0);
  sheet.classList.add('is-enhanced');
}
capabilityPanels.forEach(enhanceServicePanel);

const metricNumbers=[...document.querySelectorAll('[data-count]')];
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function setMetricValue(element,value){element.textContent=`${Math.round(value).toLocaleString()}${element.dataset.suffix??''}`}
function animateMetric(element){
  if(element.dataset.animated)return;
  element.dataset.animated='true';
  const target=Number(element.dataset.count);
  if(reduceMotion){setMetricValue(element,target);return}
  const duration=1250,start=performance.now();
  function frame(now){const progress=Math.min((now-start)/duration,1);const eased=1-Math.pow(1-progress,3);setMetricValue(element,target*eased);if(progress<1)requestAnimationFrame(frame)}
  requestAnimationFrame(frame);
}
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){metricNumbers.forEach(animateMetric);observer.disconnect()}}),{threshold:.35});observer.observe(document.querySelector('.proof-band'))}else metricNumbers.forEach(animateMetric);

