/**
 * Services.html page interactions.
 * Shared navigation behavior lives in site-navigation.js.
 */
const serviceSections = [...document.querySelectorAll('.service-group')];
const serviceItems = [...document.querySelectorAll('.service-item')];
const serviceSheets = [...document.querySelectorAll('.service-sheet')];
const capabilityGroups = [...document.querySelectorAll('[data-capability-group]')];
const capabilityLinks = [...document.querySelectorAll('[data-capability-link]')];
const capabilitySections = capabilityLinks
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

serviceSections.forEach(section => {
  const subnav = document.querySelector(`[data-subnav-for="${section.id}"]`);
  const items = [...section.querySelectorAll('.service-item')];
  items.forEach((item, index) => {
    const title = item.querySelector('h4');
    item.id = `${section.id}-service-${index + 1}`;

    if (subnav && title) {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${item.id}`;
      link.textContent = title.textContent;
      link.dataset.serviceLink = item.id;
      listItem.append(link);
      subnav.append(listItem);
    }
  });
});

serviceSheets.forEach(sheet => {
  const content = document.createElement('div');
  content.className = 'service-sheet-content';
  while (sheet.firstChild) content.append(sheet.firstChild);

  const border = document.createElement('div');
  border.className = 'service-card-border';
  border.setAttribute('aria-hidden', 'true');
  const borderGradient = document.createElement('div');
  borderGradient.className = 'service-card-border-gradient';
  border.append(borderGradient);

  const surface = document.createElement('div');
  surface.className = 'service-card-surface';
  surface.setAttribute('aria-hidden', 'true');
  sheet.append(border, surface, content);
});

function setActiveCapability(sectionId) {
  capabilityLinks.forEach(link => {
    const isCurrent = link.getAttribute('href') === `#${sectionId}`;
    if (isCurrent) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  capabilityGroups.forEach(group => {
    group.classList.toggle('is-active', group.dataset.capabilityGroup === sectionId);
  });
}

capabilityLinks.forEach(link => {
  link.addEventListener('click', () => setActiveCapability(link.getAttribute('href').slice(1)));
});

if ('IntersectionObserver' in window && capabilitySections.length) {
  const visibleSections = new Map();
  const capabilityObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) visibleSections.set(entry.target.id, entry.intersectionRatio);
      else visibleSections.delete(entry.target.id);
    });
    if (!visibleSections.size) return;
    const activeSection = [...visibleSections.entries()]
      .sort((first, second) => second[1] - first[1])[0][0];
    setActiveCapability(activeSection);
  }, {
    rootMargin: '-18% 0px -52% 0px',
    threshold: [0, .1, .25, .5, .75]
  });
  capabilitySections.forEach(section => capabilityObserver.observe(section));
}

const serviceLinks = [...document.querySelectorAll('[data-service-link]')];
if ('IntersectionObserver' in window && serviceItems.length) {
  const visibleItems = new Map();
  const itemObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) visibleItems.set(entry.target.id, entry.intersectionRatio);
      else visibleItems.delete(entry.target.id);
    });
    serviceLinks.forEach(link => link.classList.remove('is-active'));
    if (!visibleItems.size) return;
    const activeItem = [...visibleItems.entries()]
      .sort((first, second) => second[1] - first[1])[0][0];
    document.querySelector(`[data-service-link="${activeItem}"]`)?.classList.add('is-active');
  }, {
    rootMargin: '-20% 0px -62% 0px',
    threshold: [0, .25, .5, .75]
  });
  serviceItems.forEach(item => itemObserver.observe(item));
}

const hashTarget = location.hash ? document.querySelector(location.hash) : null;
const initialSection = capabilitySections.find(section => section === hashTarget || section.contains(hashTarget));
setActiveCapability(initialSection?.id || capabilitySections[0]?.id);

serviceSheets.forEach(card => {
  let lastUpdate = 0;
  card.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const currentTime = performance.now();
    if (currentTime - lastUpdate < 50) return;
    lastUpdate = currentTime;

    const bounds = card.getBoundingClientRect();
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;
    const pointerX = event.clientX - bounds.left - halfWidth;
    const pointerY = event.clientY - bounds.top - halfHeight;
    if (Math.abs(pointerX) < .01 && Math.abs(pointerY) < .01) return;

    const horizontalScale = Math.abs(pointerX) > .01 ? halfWidth / Math.abs(pointerX) : Infinity;
    const verticalScale = Math.abs(pointerY) > .01 ? halfHeight / Math.abs(pointerY) : Infinity;
    const edgeScale = Math.min(horizontalScale, verticalScale);
    card.style.setProperty('--card-mouse-x', `${halfWidth + pointerX * edgeScale}px`);
    card.style.setProperty('--card-mouse-y', `${halfHeight + pointerY * edgeScale}px`);
  }, { passive: true });
});

const metricNumbers = [...document.querySelectorAll('[data-count]')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function setMetricValue(element, value) {
  element.textContent = `${Math.round(value).toLocaleString()}${element.dataset.suffix ?? ''}`;
}

function animateMetric(element) {
  if (element.dataset.animated) return;
  element.dataset.animated = 'true';
  const target = Number(element.dataset.count);
  if (reduceMotion) {
    setMetricValue(element, target);
    return;
  }
  const duration = 1250;
  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    setMetricValue(element, target * eased);
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if ('IntersectionObserver' in window) {
  const metricObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      metricNumbers.forEach(animateMetric);
      metricObserver.disconnect();
    });
  }, { threshold: .35 });
  const proofBand = document.querySelector('.proof-band');
  if (proofBand) metricObserver.observe(proofBand);
} else {
  metricNumbers.forEach(animateMetric);
}
