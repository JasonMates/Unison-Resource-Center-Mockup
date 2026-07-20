/**
 * index.html page interactions.
 * Shared navigation behavior lives in site-navigation.js.
 */
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll('.reveal').forEach(element => observer.observe(element));

const counters = [...document.querySelectorAll('[data-counter]')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const teamMeasure = document.querySelector('.team-measure');
const globe = document.querySelector('.network-globe');
const globeCanvas = document.querySelector('.network-globe-canvas');
const globeContext = globeCanvas?.getContext('2d');
const heroContent = document.querySelector('.hero-content');
const heroTitle = document.querySelector('.hero h1');
let globeAnimationFrame;
let globeAnimationStart;
let globeAnimationLastFrame;
let globeWidth = 0;
let globeHeight = 0;
let globeHubX = 0;
let globeHubY = 0;
const globePointer = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  normalX: 0,
  normalY: 1,
  energy: 0,
  phase: 0,
  lastClientX: undefined,
  lastClientY: undefined
};

const globeRoutes = Array.from({ length: 210 }, (_, index) => {
  const random = Math.abs(Math.sin((index + 1) * 12.9898) * 43758.5453) % 1;
  const secondaryRandom = Math.abs(Math.sin((index + 7) * 24.173) * 19431.137) % 1;

  return {
    longitude: index / 210 * Math.PI * 2,
    length: Math.PI * (.27 + random * .205),
    opacity: .18 + secondaryRandom * .48,
    width: .55 + secondaryRandom * .7,
    hasDot: secondaryRandom > .18,
    cycle: 18000 + random * 10000,
    cycleOffset: secondaryRandom * 28000,
    strumEnergy: 0,
    strumNormalX: 0,
    strumNormalY: 1
  };
});

function resizeGlobeCanvas() {
  if (!globeCanvas || !globeContext) return;

  const bounds = globeCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  globeWidth = bounds.width;
  globeHeight = bounds.height;
  const contentBounds = heroContent?.getBoundingClientRect();
  let textBounds = contentBounds;

  if (heroTitle) {
    const titleRange = document.createRange();
    titleRange.selectNodeContents(heroTitle);
    textBounds = titleRange.getBoundingClientRect();
  }

  globeHubX = textBounds
    ? Math.min(globeWidth - 18, textBounds.right - bounds.left + 28)
    : globeWidth * .6;
  globeHubY = globeHeight * .485;
  globe.style.setProperty('--globe-hub-x', `${globeHubX}px`);
  globe.style.setProperty('--globe-hub-y', `${globeHubY}px`);
  globeCanvas.width = Math.round(globeWidth * pixelRatio);
  globeCanvas.height = Math.round(globeHeight * pixelRatio);
  globeContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function drawGlobe(rotation, elapsed = 0, frameDuration = 16.67) {
  if (!globeContext || !globeWidth || !globeHeight) return;

  globeContext.clearRect(0, 0, globeWidth, globeHeight);

  const radius = globeHeight * .98;
  const hub = { x: globeHubX, y: globeHubY };
  const pole = { x: -.818, y: -.52, z: .245 };
  const tangentOne = { x: .287, y: 0, z: .958 };
  const tangentTwo = { x: -.498, y: .854, z: .149 };
  const center = {
    x: hub.x - radius * pole.x,
    y: hub.y - radius * pole.y
  };
  const strumRadius = Math.min(globeWidth, globeHeight) * .14;

  globeRoutes.forEach(route => {
    const longitude = route.longitude + rotation;
    const longitudeCosine = Math.cos(longitude);
    const longitudeSine = Math.sin(longitude);
    const ringX = tangentOne.x * longitudeCosine + tangentTwo.x * longitudeSine;
    const ringY = tangentOne.y * longitudeCosine + tangentTwo.y * longitudeSine;
    const ringZ = tangentOne.z * longitudeCosine + tangentTwo.z * longitudeSine;
    const cycleProgress = ((elapsed + route.cycleOffset) % route.cycle) / route.cycle;
    let drawProgress = 0;
    let lifecycleOpacity = 0;
    route.strumEnergy *= Math.pow(.96, frameDuration / 16.67);

    if (cycleProgress < .34) {
      const communicationProgress = cycleProgress / .34;
      drawProgress = communicationProgress * communicationProgress * (3 - 2 * communicationProgress);
      lifecycleOpacity = 1;
    } else if (cycleProgress < .46) {
      drawProgress = 1;
      lifecycleOpacity = 1;
    } else if (cycleProgress < .60) {
      drawProgress = 1;
      lifecycleOpacity = 1 - (cycleProgress - .46) / .14;
    }

    function projectPoint(theta) {
      const thetaCosine = Math.cos(theta);
      const thetaSine = Math.sin(theta);
      const point = {
        x: pole.x * thetaCosine + ringX * thetaSine,
        y: pole.y * thetaCosine + ringY * thetaSine,
        z: pole.z * thetaCosine + ringZ * thetaSine
      };
      return {
        x: center.x + radius * point.x,
        y: center.y + radius * point.y,
        z: point.z
      };
    }

    const destination = projectPoint(route.length);
    const depthOpacity = Math.max(.12, Math.min(1, (destination.z + 1) * .54));

    if (drawProgress > .001) {
      const visibleSteps = Math.max(2, Math.ceil(28 * drawProgress));
      const routePoints = [];
      let closestPointerDistance = Infinity;

      for (let step = 0; step <= visibleSteps; step += 1) {
        const progress = Math.min(step / 28, drawProgress);
        const projected = projectPoint(route.length * progress);
        const pointerDistance = Math.hypot(projected.x - globePointer.x, projected.y - globePointer.y);
        closestPointerDistance = Math.min(closestPointerDistance, pointerDistance);
        routePoints.push({ ...projected, progress });
      }

      if (globePointer.energy > .01 && closestPointerDistance < strumRadius) {
        const proximity = 1 - closestPointerDistance / strumRadius;
        const impulse = globePointer.energy * proximity * proximity;
        route.strumEnergy = Math.min(1, Math.max(route.strumEnergy, impulse));
        route.strumNormalX = globePointer.normalX;
        route.strumNormalY = globePointer.normalY;
      }

      const oscillation = Math.sin(globePointer.phase) * 11 * route.strumEnergy;
      globeContext.beginPath();

      routePoints.forEach((point, step) => {
        const anchoredCurve = Math.sin(Math.PI * Math.min(1, point.progress / Math.max(drawProgress, .001)));
        const projectedX = point.x + route.strumNormalX * oscillation * anchoredCurve;
        const projectedY = point.y + route.strumNormalY * oscillation * anchoredCurve;

        if (step === 0) globeContext.moveTo(projectedX, projectedY);
        else globeContext.lineTo(projectedX, projectedY);
      });

      globeContext.strokeStyle = `rgba(207, 226, 232, ${route.opacity * depthOpacity * lifecycleOpacity})`;
      globeContext.lineWidth = route.width;
      globeContext.stroke();
    }

    if (route.hasDot) {
      const arrivalGlow = drawProgress > .94 ? lifecycleOpacity * .55 : 0;
      globeContext.beginPath();
      globeContext.arc(destination.x, destination.y, 1 + route.width * .65, 0, Math.PI * 2);
      globeContext.fillStyle = `rgba(231, 240, 242, ${Math.min(.9, (.1 + arrivalGlow) * depthOpacity)})`;
      globeContext.fill();
    }
  });
}

function startGlobeRotation() {
  if (!globe || !globeCanvas || !globeContext || globeAnimationFrame) return;

  resizeGlobeCanvas();
  if (reduceMotion) {
    drawGlobe(0);
    return;
  }

  globeAnimationStart = performance.now();
  globeAnimationLastFrame = globeAnimationStart;

  function rotateGlobe(currentTime) {
    const elapsed = currentTime - globeAnimationStart;
    const frameDuration = Math.min(currentTime - globeAnimationLastFrame, 50);
    const rotation = (elapsed / 180000) * Math.PI * 2;
    globeAnimationLastFrame = currentTime;
    globePointer.x += (globePointer.targetX - globePointer.x) * .34;
    globePointer.y += (globePointer.targetY - globePointer.y) * .34;
    globePointer.phase += frameDuration * .019;
    globePointer.energy *= Math.pow(.965, frameDuration / 16.67);
    drawGlobe(rotation, elapsed, frameDuration);
    globeAnimationFrame = requestAnimationFrame(rotateGlobe);
  }

  globeAnimationFrame = requestAnimationFrame(rotateGlobe);
}

function stopGlobeRotation() {
  if (!globeAnimationFrame) return;
  cancelAnimationFrame(globeAnimationFrame);
  globeAnimationFrame = undefined;
  globeAnimationStart = undefined;
  globeAnimationLastFrame = undefined;
  globePointer.energy = 0;
  globePointer.lastClientX = undefined;
  globePointer.lastClientY = undefined;
  globeRoutes.forEach(route => {
    route.strumEnergy = 0;
  });
}

if (globeCanvas) {
  globeCanvas.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

    const bounds = globeCanvas.getBoundingClientRect();
    globePointer.targetX = event.clientX - bounds.left;
    globePointer.targetY = event.clientY - bounds.top;

    if (globePointer.lastClientX === undefined || globePointer.lastClientY === undefined) {
      globePointer.x = globePointer.targetX;
      globePointer.y = globePointer.targetY;
    } else {
      const movementX = event.clientX - globePointer.lastClientX;
      const movementY = event.clientY - globePointer.lastClientY;
      const movement = Math.hypot(movementX, movementY);

      if (movement > .5) {
        globePointer.normalX = -movementY / movement;
        globePointer.normalY = movementX / movement;
        globePointer.energy = Math.min(1, globePointer.energy + movement / 24);
      }
    }

    globePointer.lastClientX = event.clientX;
    globePointer.lastClientY = event.clientY;
  });

  globeCanvas.addEventListener('pointerleave', () => {
    globePointer.lastClientX = undefined;
    globePointer.lastClientY = undefined;
  });
}

if (globe && 'ResizeObserver' in window) {
  const globeResizeObserver = new ResizeObserver(() => {
    resizeGlobeCanvas();
    if (reduceMotion) drawGlobe(0);
  });
  globeResizeObserver.observe(globe);
}

function animateCounter(counter) {
  const target = Number(counter.dataset.counter);

  if (reduceMotion) {
    counter.textContent = target.toLocaleString();
    return;
  }

  counter.textContent = '0';
  const duration = 900;
  const startTime = performance.now();

  function updateCounter(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    counter.textContent = Math.round(target * easedProgress).toLocaleString();

    if (progress < 1) requestAnimationFrame(updateCounter);
  }

  requestAnimationFrame(updateCounter);
}

function animateTeamMeasure() {
  if (!teamMeasure || teamMeasure.dataset.animated) return;

  teamMeasure.dataset.animated = 'true';
  const number = teamMeasure.querySelector('.team-number');
  const unit = teamMeasure.querySelector('.team-unit');

  function showFinalState() {
    number.textContent = '1';
    unit.textContent = 'team';
  }

  if (reduceMotion) {
    showFinalState();
    return;
  }

  window.setTimeout(() => {
    teamMeasure.classList.add('is-switching');
    window.setTimeout(() => {
      showFinalState();
      teamMeasure.classList.remove('is-switching');
    }, 700);
  }, 1400);
}

const statsPanel = document.querySelector('.stats');
if (statsPanel && counters.length) {
  const counterObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    counters.forEach(animateCounter);
    animateTeamMeasure();
    counterObserver.disconnect();
  }, { threshold: .3 });

  counterObserver.observe(statsPanel);
}

if (globe) {
  const globeObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) startGlobeRotation();
    else stopGlobeRotation();
  }, { threshold: .05 });

  globeObserver.observe(globe);
}

document.getElementById('contact-form').addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('form-note').textContent = 'This prototype form is not connected, so your information was not sent. Connect a form endpoint to accept submissions.';
});
