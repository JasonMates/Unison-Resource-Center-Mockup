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

const cursorCards = [...document.querySelectorAll('[data-cursor-card]')];
cursorCards.forEach(card => {
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
    const borderX = halfWidth + pointerX * edgeScale;
    const borderY = halfHeight + pointerY * edgeScale;

    card.style.setProperty('--card-mouse-x', `${borderX}px`);
    card.style.setProperty('--card-mouse-y', `${borderY}px`);
  }, { passive: true });
});

const counters = [...document.querySelectorAll('[data-counter]')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const teamMeasure = document.querySelector('.team-measure');
const heroSection = document.querySelector('.hero');
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
  energy: 0,
  phase: 0,
  sweepStartX: 0,
  sweepStartY: 0,
  sweepEndX: 0,
  sweepEndY: 0,
  sweepUntil: 0,
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

  const titleAnchoredHub = textBounds
    ? textBounds.right - bounds.left + 28
    : globeWidth * .6;
  const responsiveHubLimit = globeWidth <= 760
    ? globeWidth * .56
    : globeWidth <= 1050
      ? globeWidth * .60
      : globeWidth - 18;

  globeHubX = Math.min(responsiveHubLimit, titleAnchoredHub);
  globeHubY = globeHeight * .485;
  globe.style.setProperty('--globe-hub-x', `${globeHubX}px`);
  globe.style.setProperty('--globe-hub-y', `${globeHubY}px`);
  globeCanvas.width = Math.round(globeWidth * pixelRatio);
  globeCanvas.height = Math.round(globeHeight * pixelRatio);
  globeContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function pointToSegmentDistance(pointX, pointY, startX, startY, endX, endY) {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared < .001) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const projection = Math.max(0, Math.min(1,
    ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / segmentLengthSquared
  ));
  const closestX = startX + segmentX * projection;
  const closestY = startY + segmentY * projection;
  return Math.hypot(pointX - closestX, pointY - closestY);
}

function drawGlobe(rotation, elapsed = 0, frameDuration = 16.67) {
  if (!globeContext || !globeWidth || !globeHeight) return;

  globeContext.clearRect(0, 0, globeWidth, globeHeight);

  const radius = globeWidth <= 760
    ? Math.min(globeHeight * .98, globeWidth * 1.05)
    : globeHeight * .98;
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
      let closestPointerStep = 0;
      const usePointerSweep = globePointer.sweepUntil > performance.now();

      for (let step = 0; step <= visibleSteps; step += 1) {
        const progress = Math.min(step / 28, drawProgress);
        const projected = projectPoint(route.length * progress);
        const pointerDistance = usePointerSweep
          ? pointToSegmentDistance(
            projected.x,
            projected.y,
            globePointer.sweepStartX,
            globePointer.sweepStartY,
            globePointer.sweepEndX,
            globePointer.sweepEndY
          )
          : Math.hypot(projected.x - globePointer.x, projected.y - globePointer.y);

        if (pointerDistance < closestPointerDistance) {
          closestPointerDistance = pointerDistance;
          closestPointerStep = step;
        }
        routePoints.push({ ...projected, progress });
      }

      if (globePointer.energy > .01 && closestPointerDistance < strumRadius) {
        const proximity = 1 - closestPointerDistance / strumRadius;
        const impulse = globePointer.energy * proximity * proximity;
        const tangentStart = routePoints[Math.max(0, closestPointerStep - 1)];
        const tangentEnd = routePoints[Math.min(routePoints.length - 1, closestPointerStep + 1)];
        const tangentX = tangentEnd.x - tangentStart.x;
        const tangentY = tangentEnd.y - tangentStart.y;
        const tangentLength = Math.hypot(tangentX, tangentY) || 1;
        route.strumEnergy = Math.min(1, Math.max(route.strumEnergy, impulse));
        route.strumNormalX = -tangentY / tangentLength;
        route.strumNormalY = tangentX / tangentLength;
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

if (heroSection && globeCanvas) {
  heroSection.addEventListener('pointermove', event => {
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
        globePointer.sweepStartX = globePointer.lastClientX - bounds.left;
        globePointer.sweepStartY = globePointer.lastClientY - bounds.top;
        globePointer.sweepEndX = globePointer.targetX;
        globePointer.sweepEndY = globePointer.targetY;
        globePointer.sweepUntil = performance.now() + 80;
        globePointer.energy = Math.min(1, globePointer.energy + movement / 24);
      }
    }

    globePointer.lastClientX = event.clientX;
    globePointer.lastClientY = event.clientY;
  });

  heroSection.addEventListener('pointerleave', () => {
    globePointer.lastClientX = undefined;
    globePointer.lastClientY = undefined;
    globePointer.sweepUntil = 0;
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

const transformer = document.querySelector('.ai-transformer');
const transformerCanvas = document.querySelector('.ai-transformer-canvas');
const transformerContext = transformerCanvas?.getContext('2d');
const transformerInteractionSurface = transformer?.closest('.different') || transformer;
let transformerWidth = 0;
let transformerHeight = 0;
let transformerAnimationFrame;
let transformerAnimationStart;
let transformerAnimationLastFrame;
const transformerPointer = {
  energy: 0,
  phase: 0,
  sweepStartX: 0,
  sweepStartY: 0,
  sweepEndX: 0,
  sweepEndY: 0,
  sweepUntil: 0,
  lastClientX: undefined,
  lastClientY: undefined
};

const transformerOutputCount = 32;
const transformerOutputs = Array.from({ length: transformerOutputCount }, (_, index) => {
  const random = Math.abs(Math.sin((index + 31) * 11.173) * 31841.297) % 1;
  const secondaryRandom = Math.abs(Math.sin((index + 43) * 19.417) * 21413.611) % 1;

  return {
    ratio: (index + .5) / transformerOutputCount,
    xJitter: (random - .5) * 18,
    yJitter: (secondaryRandom - .5) * 9
  };
});

const transformerRouteCount = 80;
const transformerRoutes = Array.from({ length: transformerRouteCount }, (_, index) => {
  const random = Math.abs(Math.sin((index + 3) * 17.381) * 29417.113) % 1;
  const secondaryRandom = Math.abs(Math.sin((index + 11) * 8.731) * 19341.719) % 1;
  const tertiaryRandom = Math.abs(Math.sin((index + 19) * 14.293) * 23817.417) % 1;

  return {
    startRatio: (index + .5) / transformerRouteCount,
    outputIndex: (index * 11) % transformerOutputCount,
    startXJitter: (secondaryRandom - .5) * 18,
    startYJitter: (tertiaryRandom - .5) * 6,
    pinchOffset: (random - .5) * 2,
    opacity: .14 + random * .22,
    width: .55 + secondaryRandom * .55,
    cycle: 6800 + random * 2100,
    cycleOffset: secondaryRandom * 8600,
    travelDuration: 1750 + tertiaryRandom * 550,
    active: index % 3 === 0 || index % 8 === 0,
    strumEnergy: 0,
    strumNormalX: 0,
    strumNormalY: 1
  };
});

function resizeTransformerCanvas() {
  if (!transformerCanvas || !transformerContext) return;

  const bounds = transformerCanvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  transformerWidth = bounds.width;
  transformerHeight = bounds.height;
  transformerCanvas.width = Math.round(transformerWidth * pixelRatio);
  transformerCanvas.height = Math.round(transformerHeight * pixelRatio);
  transformerContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function cubicPoint(start, controlOne, controlTwo, end, progress) {
  const inverse = 1 - progress;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * controlOne.x + 3 * inverse * progress ** 2 * controlTwo.x + progress ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * controlOne.y + 3 * inverse * progress ** 2 * controlTwo.y + progress ** 3 * end.y
  };
}

function transformerRoutePoint(route, progress) {
  const sideInset = Math.max(18, transformerWidth * .035);
  const verticalInset = 0;
  const usableHeight = transformerHeight;
  const start = {
    x: sideInset + route.startXJitter,
    y: verticalInset + usableHeight * route.startRatio + route.startYJitter
  };
  const output = transformerOutputs[route.outputIndex];
  const end = {
    x: transformerWidth - sideInset + output.xJitter,
    y: verticalInset + usableHeight * output.ratio + output.yJitter
  };
  const pinchY = transformerHeight * .5 + route.pinchOffset;
  const pinchStart = { x: transformerWidth * .48, y: pinchY };
  const pinchEnd = { x: transformerWidth * .52, y: pinchY };

  if (progress <= .48) {
    return cubicPoint(
      start,
      { x: transformerWidth * .25, y: start.y },
      { x: transformerWidth * .385, y: pinchStart.y },
      pinchStart,
      progress / .48
    );
  }

  if (progress < .52) {
    const pinchProgress = (progress - .48) / .04;
    return {
      x: pinchStart.x + (pinchEnd.x - pinchStart.x) * pinchProgress,
      y: pinchStart.y
    };
  }

  return cubicPoint(
    pinchEnd,
    { x: transformerWidth * .615, y: pinchEnd.y },
    { x: transformerWidth * .75, y: end.y },
    end,
    (progress - .52) / .48
  );
}

function traceTransformerRoute(route, startProgress = 0, endProgress = 1, steps = 54) {
  function displacedPoint(progress) {
    const point = transformerRoutePoint(route, progress);
    let anchorEnvelope = 0;

    if (progress < .48) anchorEnvelope = Math.sin(Math.PI * progress / .48);
    else if (progress > .52) anchorEnvelope = Math.sin(Math.PI * (progress - .52) / .48);

    const displacement = Math.sin(transformerPointer.phase) * 9 * route.strumEnergy * anchorEnvelope;
    return {
      x: point.x + route.strumNormalX * displacement,
      y: point.y + route.strumNormalY * displacement
    };
  }

  const firstPoint = displacedPoint(startProgress);
  transformerContext.beginPath();
  transformerContext.moveTo(firstPoint.x, firstPoint.y);

  for (let step = 1; step <= steps; step += 1) {
    const progress = startProgress + (endProgress - startProgress) * step / steps;
    const point = displacedPoint(progress);
    transformerContext.lineTo(point.x, point.y);
  }
}

function exciteTransformerRoute(route) {
  if (transformerPointer.energy <= .01 || transformerPointer.sweepUntil <= performance.now()) return;

  const interactionRadius = Math.min(52, transformerHeight * .15);
  let closestDistance = Infinity;
  let closestProgress = 0;

  for (let step = 0; step <= 34; step += 1) {
    const progress = step / 34;
    const point = transformerRoutePoint(route, progress);
    const distance = pointToSegmentDistance(
      point.x,
      point.y,
      transformerPointer.sweepStartX,
      transformerPointer.sweepStartY,
      transformerPointer.sweepEndX,
      transformerPointer.sweepEndY
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestProgress = progress;
    }
  }

  if (closestDistance >= interactionRadius) return;

  const previousPoint = transformerRoutePoint(route, Math.max(0, closestProgress - .018));
  const nextPoint = transformerRoutePoint(route, Math.min(1, closestProgress + .018));
  const tangentX = nextPoint.x - previousPoint.x;
  const tangentY = nextPoint.y - previousPoint.y;
  const tangentLength = Math.hypot(tangentX, tangentY) || 1;
  const proximity = 1 - closestDistance / interactionRadius;

  route.strumEnergy = Math.min(1, Math.max(route.strumEnergy, transformerPointer.energy * proximity * proximity));
  route.strumNormalX = -tangentY / tangentLength;
  route.strumNormalY = tangentX / tangentLength;
}

function drawTransformer(elapsed = 0, frameDuration = 16.67) {
  if (!transformerContext || !transformerWidth || !transformerHeight) return;

  transformerContext.clearRect(0, 0, transformerWidth, transformerHeight);

  transformerRoutes.forEach((route, index) => {
    route.strumEnergy *= Math.pow(.955, frameDuration / 16.67);
    exciteTransformerRoute(route);
    traceTransformerRoute(route, 0, .5, 30);
    transformerContext.strokeStyle = `rgba(188, 219, 226, ${route.opacity})`;
    transformerContext.lineWidth = route.width;
    transformerContext.stroke();

    if (index < transformerOutputCount) {
      traceTransformerRoute(route, .5, 1, 30);
      transformerContext.stroke();
    }

    if (!route.active) return;

    const cycleTime = (elapsed + route.cycleOffset) % route.cycle;
    const holdDuration = 725;
    const fadeDuration = 900;
    let signalProgress = 0;
    let signalOpacity = 0;

    if (cycleTime < route.travelDuration) {
      const travelProgress = cycleTime / route.travelDuration;
      signalProgress = travelProgress * travelProgress * (3 - 2 * travelProgress);
      signalOpacity = 1;
    } else if (cycleTime < route.travelDuration + holdDuration) {
      signalProgress = 1;
      signalOpacity = 1;
    } else if (cycleTime < route.travelDuration + holdDuration + fadeDuration) {
      signalProgress = 1;
      signalOpacity = 1 - (cycleTime - route.travelDuration - holdDuration) / fadeDuration;
    }

    if (signalOpacity > .01) {
      traceTransformerRoute(route, 0, signalProgress, 40);
      transformerContext.strokeStyle = `rgba(238, 247, 249, ${signalOpacity * .82})`;
      transformerContext.lineWidth = route.width + .85;
      transformerContext.stroke();
    }
  });

  transformerRoutes.forEach(route => {
    const start = transformerRoutePoint(route, 0);
    transformerContext.fillStyle = 'rgba(224, 238, 241, .66)';
    transformerContext.fillRect(start.x - 1, start.y - 1, 2, 2);
  });

  transformerRoutes.slice(0, transformerOutputCount).forEach(route => {
    const end = transformerRoutePoint(route, 1);
    transformerContext.fillStyle = 'rgba(224, 238, 241, .72)';
    transformerContext.fillRect(end.x - 1.3, end.y - 1.3, 2.6, 2.6);
  });
}

function startTransformerAnimation() {
  if (!transformer || !transformerCanvas || !transformerContext || transformerAnimationFrame) return;

  resizeTransformerCanvas();
  if (reduceMotion) {
    drawTransformer(4200);
    return;
  }

  transformerAnimationStart = performance.now();
  transformerAnimationLastFrame = transformerAnimationStart;

  function animateTransformer(currentTime) {
    const frameDuration = Math.min(currentTime - transformerAnimationLastFrame, 50);
    transformerAnimationLastFrame = currentTime;
    transformerPointer.phase += frameDuration * .018;
    transformerPointer.energy *= Math.pow(.95, frameDuration / 16.67);
    drawTransformer(currentTime - transformerAnimationStart, frameDuration);
    transformerAnimationFrame = requestAnimationFrame(animateTransformer);
  }

  transformerAnimationFrame = requestAnimationFrame(animateTransformer);
}

function stopTransformerAnimation() {
  if (!transformerAnimationFrame) return;
  cancelAnimationFrame(transformerAnimationFrame);
  transformerAnimationFrame = undefined;
  transformerAnimationStart = undefined;
  transformerAnimationLastFrame = undefined;
  transformerPointer.energy = 0;
  transformerRoutes.forEach(route => {
    route.strumEnergy = 0;
  });
}

if (transformer && 'ResizeObserver' in window) {
  const transformerResizeObserver = new ResizeObserver(() => {
    resizeTransformerCanvas();
    if (reduceMotion || !transformerAnimationFrame) drawTransformer(4200);
  });
  transformerResizeObserver.observe(transformer);
}

if (transformer && transformerInteractionSurface) {
  transformerInteractionSurface.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;

    const bounds = transformerCanvas.getBoundingClientRect();
    const currentX = event.clientX - bounds.left;
    const currentY = event.clientY - bounds.top;

    if (transformerPointer.lastClientX !== undefined && transformerPointer.lastClientY !== undefined) {
      const movementX = event.clientX - transformerPointer.lastClientX;
      const movementY = event.clientY - transformerPointer.lastClientY;
      const movement = Math.hypot(movementX, movementY);

      if (movement > .5) {
        transformerPointer.sweepStartX = transformerPointer.lastClientX - bounds.left;
        transformerPointer.sweepStartY = transformerPointer.lastClientY - bounds.top;
        transformerPointer.sweepEndX = currentX;
        transformerPointer.sweepEndY = currentY;
        transformerPointer.sweepUntil = performance.now() + 110;
        transformerPointer.energy = Math.min(1, transformerPointer.energy + movement / 20);
      }
    }

    transformerPointer.lastClientX = event.clientX;
    transformerPointer.lastClientY = event.clientY;
  }, { passive: true });

  transformerInteractionSurface.addEventListener('pointerleave', () => {
    transformerPointer.lastClientX = undefined;
    transformerPointer.lastClientY = undefined;
    transformerPointer.sweepUntil = 0;
  });

  const transformerObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) startTransformerAnimation();
    else stopTransformerAnimation();
  }, { threshold: .05 });

  transformerObserver.observe(transformer);
}

document.getElementById('contact-form').addEventListener('submit', event => {
  event.preventDefault();
  document.getElementById('form-note').textContent = 'This prototype form is not connected, so your information was not sent. Connect a form endpoint to accept submissions.';
});
