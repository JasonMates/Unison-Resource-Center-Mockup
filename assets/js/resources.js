/**
 * Resource center filtering, search, and modal interactions.
 * The resource catalog remains declarative in Resources.html for easy editing.
 */
let activeResource = null;

function renderResources(){
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const c = document.getElementById('categoryFilter').value;
  const t = document.getElementById('typeFilter').value;
  const a = document.getElementById('audienceFilter').value;
  const filtered = resources.filter(r => {
    const hay = (r.title+" "+r.desc+" "+r.keywords+" "+r.category+" "+r.type+" "+r.audience+" "+r.filename).toLowerCase();
    return (!q || hay.includes(q)) && (!c || r.category===c) && (!t || r.type===t) && (!a || r.audience===a);
  });
  const grid = document.getElementById('resourceGrid');
  if(!filtered.length){
    grid.innerHTML = '<div class="no-results">No resources match those filters. Try a broader search.</div>';
    return;
  }
  grid.innerHTML = filtered.map(r => {
    const index = resources.indexOf(r);
    return `<article class="resource" role="button" tabindex="0" onclick="openResource(${index})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openResource(${index})}">
      <div class="resource-top"><span class="tag">${r.category}</span><span class="type">${r.type}</span></div>
      <h3>${r.title}</h3><p>${r.desc}</p>
      <div class="host"><span class="host-dot"></span>${r.host === "YouTube" ? "Video hosted on YouTube" : "PDF hosted on Cloudflare R2"}</div>
      <div class="resource-foot"><span>${r.date}</span><span class="arrow">→</span></div>
    </article>`;
  }).join('');
}

function setCategory(cat){
  document.getElementById('categoryFilter').value = cat;
  document.getElementById('searchInput').value = '';
  renderResources();
  document.getElementById('resources').scrollIntoView({behavior:'smooth'});
}
function quickSearch(term){
  document.getElementById('searchInput').value = term;
  document.getElementById('categoryFilter').value = '';
  document.getElementById('typeFilter').value = '';
  document.getElementById('audienceFilter').value = '';
  renderResources();
  document.getElementById('resources').scrollIntoView({behavior:'smooth'});
}
function runHeroSearch(){
  document.getElementById('searchInput').value = document.getElementById('heroSearch').value;
  renderResources();
  document.getElementById('resources').scrollIntoView({behavior:'smooth'});
}
document.getElementById('heroSearch').addEventListener('keydown', e => { if(e.key==='Enter') runHeroSearch(); });

function openResource(index){
  activeResource = resources[index];
  document.getElementById('modalCategory').textContent = activeResource.category;
  document.getElementById('modalTitle').textContent = activeResource.title;
  document.getElementById('modalDescription').textContent = activeResource.desc;
  document.getElementById('modalMeta').innerHTML = `<span>${activeResource.type}</span><span>${activeResource.audience}</span><span>${activeResource.date}</span>`;
  const url = activeResource.host === "YouTube" ? `https://${activeResource.filename}` : `https://files.unison-re.org/${activeResource.category.toLowerCase()}/${activeResource.filename}`;
  document.getElementById('modalUrl').textContent = url;
  document.getElementById('openButton').textContent = activeResource.host === "YouTube" ? "Watch Video" : "View PDF";
  document.getElementById('resourceModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function showPrototypeLink(){
  if(!activeResource) return;
  alert(activeResource.host === "YouTube" ? "Prototype only. In production, this button would open or embed the YouTube video." : "Prototype only. In production, this Framer CMS button would open the PDF stored in Cloudflare R2.");
}
function forceClose(){ document.getElementById('resourceModal').classList.remove('open'); document.body.style.overflow=''; }
function closeModal(e){ if(e.target.id==='resourceModal') forceClose(); }
document.addEventListener('keydown',e=>{if(e.key==='Escape') forceClose()});
renderResources();

