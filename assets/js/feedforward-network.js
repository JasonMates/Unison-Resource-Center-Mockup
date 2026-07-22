/**
 * Performance-budgeted feedforward neural-network background.
 *
 * The idle network is rendered once to an offscreen canvas. Pointer activity
 * can launch no more than three bright, end-to-end signals at once; animation
 * stops completely as soon as those signals finish.
 */
(() => {
  const network = document.querySelector('.feedforward-network');
  const canvas = network?.querySelector('.feedforward-network-canvas');
  const context = canvas?.getContext('2d');
  const interactionSurface = network?.closest('.different');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!network || !canvas || !context || !interactionSurface) return;

  const baseCanvas = document.createElement('canvas');
  const baseContext = baseCanvas.getContext('2d');
  if (!baseContext) return;

  const layerSizes = [36, 28, 20, 12];
  const desktopLayerXPositions = [.04, .36, .64, .96];
  const compactLayerXPositions = [0, .34, .66, 1];
  const routeCount = 72;
  // Interaction controls: change this value to tune the maximum spawn rate.
  const USER_SIGNALS_PER_SECOND = 12;
  const USER_SIGNAL_COOLDOWN = 1000 / USER_SIGNALS_PER_SECOND;
  const MAXIMUM_ACTIVE_USER_SIGNALS = 14;
  const USER_SIGNAL_BRIGHTNESS = 1;
  const AMBIENT_SIGNAL_INTERVAL = 85;
  const MAXIMUM_ACTIVE_AMBIENT_SIGNALS = 18;
  const USER_SIGNAL_COLORS = [
    '255, 238, 74',
    '255, 210, 92',
    '255, 184, 52',
    '255, 222, 138'
  ];
  const minimumPointerTravel = 12;
  const nodes = layerSizes.map((size, layerIndex) => Array.from({ length: size }, (_, nodeIndex) => ({
    layerIndex,
    nodeIndex,
    x: 0,
    y: 0
  })));

  const routes = Array.from({ length: routeCount }, (_, index) => {
    const opacityRandom = Math.abs(Math.sin((index + 3) * 17.381) * 29417.113) % 1;
    const widthRandom = Math.abs(Math.sin((index + 11) * 8.731) * 19341.719) % 1;
    const group = Math.floor(index / layerSizes[0]);
    return {
      nodeIndexes: [
        index % layerSizes[0],
        (index * 9 + group * 3) % layerSizes[1],
        (index * 7 + group * 5) % layerSizes[2],
        (index * 5 + group * 2) % layerSizes[3]
      ],
      opacity: .1 + opacityRandom * .4,
      lineWidth: .24 + widthRandom * .28
    };
  });

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let animationFrame;
  let isVisible = false;
  let lastSpawnTime = -Infinity;
  let lastPointerX;
  let lastPointerY;
  let signalSequence = 0;
  let activeSignals = [];
  let ambientTimer;

  function routeNodes(route) {
    return route.nodeIndexes.map((nodeIndex, layerIndex) => nodes[layerIndex][nodeIndex]);
  }

  function trace(targetContext, route, endProgress = 1) {
    const selectedNodes = routeNodes(route);
    const scaledProgress = Math.max(0, Math.min(1, endProgress)) * (selectedNodes.length - 1);
    const completeSegments = Math.floor(scaledProgress);
    const partialSegment = scaledProgress - completeSegments;

    targetContext.beginPath();
    targetContext.moveTo(selectedNodes[0].x, selectedNodes[0].y);
    for (let nodeIndex = 1; nodeIndex <= completeSegments; nodeIndex += 1) {
      targetContext.lineTo(selectedNodes[nodeIndex].x, selectedNodes[nodeIndex].y);
    }
    if (completeSegments < selectedNodes.length - 1 && partialSegment > 0) {
      const start = selectedNodes[completeSegments];
      const end = selectedNodes[completeSegments + 1];
      targetContext.lineTo(
        start.x + (end.x - start.x) * partialSegment,
        start.y + (end.y - start.y) * partialSegment
      );
    }
  }

  function drawNodes(targetContext) {
    nodes.forEach((layer, layerIndex) => {
      layer.forEach(node => {
        const radius = layerIndex === 0 || layerIndex === nodes.length - 1 ? 1.9 : 2.45;
        targetContext.beginPath();
        targetContext.arc(node.x, node.y, radius + 3.8, 0, Math.PI * 2);
        targetContext.fillStyle = 'rgba(207, 226, 232, .026)';
        targetContext.fill();
        targetContext.beginPath();
        targetContext.arc(node.x, node.y, radius, 0, Math.PI * 2);
        targetContext.fillStyle = 'rgba(225, 239, 242, .43)';
        targetContext.fill();
      });
    });
  }

  function renderBaseNetwork() {
    baseContext.clearRect(0, 0, width, height);
    drawNodes(baseContext);
  }

  function drawBaseToScreen() {
    context.clearRect(0, 0, width, height);
    context.drawImage(baseCanvas, 0, 0, baseCanvas.width, baseCanvas.height, 0, 0, width, height);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    pixelRatio = Math.min(devicePixelRatio || 1, width < 1360 ? 1 : 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    baseCanvas.width = canvas.width;
    baseCanvas.height = canvas.height;
    baseContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const frameInset = 3;
    const availableHeight = height - frameInset * 2;
    const compactLayout = width < 1360;
    const layerXPositions = compactLayout ? compactLayerXPositions : desktopLayerXPositions;
    nodes.forEach((layer, layerIndex) => {
      layer.forEach((node, nodeIndex) => {
        const verticalPosition = layer.length === 1 ? .5 : nodeIndex / (layer.length - 1);
        const jitterEnvelope = Math.sin(Math.PI * verticalPosition);
        const jitter = Math.sin((layerIndex + 2) * (nodeIndex + 3) * 2.17) * 2.5 * jitterEnvelope;
        node.x = width * layerXPositions[layerIndex];
        node.y = frameInset + availableHeight * verticalPosition + jitter;
      });
    });

    renderBaseNetwork();
    drawBaseToScreen();
  }

  function pointToSegmentDistance(pointX, pointY, startX, startY, endX, endY) {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (lengthSquared < .001) return Math.hypot(pointX - startX, pointY - startY);
    const projection = Math.max(0, Math.min(1,
      ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared
    ));
    const closestX = startX + segmentX * projection;
    const closestY = startY + segmentY * projection;
    return Math.hypot(pointX - closestX, pointY - closestY);
  }

  function distanceToRoute(route, x, y) {
    const selectedNodes = routeNodes(route);
    let closestDistance = Infinity;
    for (let index = 0; index < selectedNodes.length - 1; index += 1) {
      const start = selectedNodes[index];
      const end = selectedNodes[index + 1];
      closestDistance = Math.min(closestDistance, pointToSegmentDistance(x, y, start.x, start.y, end.x, end.y));
    }
    return closestDistance;
  }

  function chooseRoute(x, y) {
    const activeRoutes = new Set(activeSignals.map(signal => signal.route));
    const candidates = routes
      .filter(route => !activeRoutes.has(route))
      .map(route => ({ route, distance: distanceToRoute(route, x, y) }))
      .sort((first, second) => first.distance - second.distance)
      .slice(0, 6);
    if (!candidates.length) return null;
    const candidateIndex = signalSequence % candidates.length;
    signalSequence += 1;
    return candidates[candidateIndex].route;
  }

  function chooseAmbientRoute() {
    const activeRoutes = new Set(activeSignals.map(signal => signal.route));
    for (let offset = 0; offset < routes.length; offset += 1) {
      const route = routes[(signalSequence + offset * 17) % routes.length];
      if (!activeRoutes.has(route)) {
        signalSequence += 1;
        return route;
      }
    }
    return null;
  }

  function drawFrame(timestamp) {
    animationFrame = undefined;
    drawBaseToScreen();

    activeSignals = activeSignals.filter(signal => {
      const elapsed = timestamp - signal.startedAt;
      const isUserSignal = signal.source === 'user';
      const travelDuration = isUserSignal ? 540 : 840;
      const holdDuration = isUserSignal ? 120 : 90;
      const fadeDuration = isUserSignal ? 520 : 680;
      const totalDuration = travelDuration + holdDuration + fadeDuration;
      if (elapsed >= totalDuration) return false;

      let progress = 1;
      let opacity = 1;
      if (elapsed < travelDuration) {
        const travelProgress = Math.max(0, elapsed / travelDuration);
        progress = travelProgress * travelProgress * (3 - 2 * travelProgress);
      } else if (elapsed > travelDuration + holdDuration) {
        opacity = 1 - (elapsed - travelDuration - holdDuration) / fadeDuration;
      }

      trace(context, signal.route, progress);
      if (isUserSignal) {
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.strokeStyle = `rgba(${signal.color}, ${Math.max(0, opacity) * USER_SIGNAL_BRIGHTNESS * .24})`;
        context.lineWidth = signal.route.lineWidth + 3.4;
        context.stroke();
        context.strokeStyle = `rgba(${signal.color}, ${Math.max(0, opacity) * USER_SIGNAL_BRIGHTNESS})`;
        context.lineWidth = signal.route.lineWidth + 1.05;
        context.stroke();
        context.restore();
      } else {
        context.strokeStyle = `rgba(247, 252, 253, ${Math.max(0, opacity) * signal.route.opacity})`;
        context.lineWidth = signal.route.lineWidth + .62;
        context.stroke();
      }
      return true;
    });

    if (activeSignals.length && isVisible) animationFrame = requestAnimationFrame(drawFrame);
    else drawBaseToScreen();
  }

  function requestSignalFrame() {
    if (!animationFrame && isVisible) animationFrame = requestAnimationFrame(drawFrame);
  }

  function spawnSignal(clientX, clientY, force = false) {
    const activeUserSignals = activeSignals.filter(signal => signal.source === 'user').length;
    if (reduceMotion || !isVisible || activeUserSignals >= MAXIMUM_ACTIVE_USER_SIGNALS) return;
    const now = performance.now();
    if (!force && now - lastSpawnTime < USER_SIGNAL_COOLDOWN) return;
    const bounds = canvas.getBoundingClientRect();
    const route = chooseRoute(clientX - bounds.left, clientY - bounds.top);
    if (!route) return;
    const color = USER_SIGNAL_COLORS[Math.floor(Math.random() * USER_SIGNAL_COLORS.length)];
    activeSignals.push({ route, startedAt: now, source: 'user', color });
    lastSpawnTime = now;
    requestSignalFrame();
  }

  function scheduleAmbientSignal() {
    if (ambientTimer) clearTimeout(ambientTimer);
    ambientTimer = undefined;
    if (!isVisible || reduceMotion) return;

    ambientTimer = window.setTimeout(() => {
      ambientTimer = undefined;
      spawnAmbientSignal();
      scheduleAmbientSignal();
    }, AMBIENT_SIGNAL_INTERVAL);
  }

  function spawnAmbientSignal() {
    if (!isVisible || reduceMotion) return;
    const activeAmbientSignals = activeSignals.filter(signal => signal.source === 'ambient').length;
    if (activeAmbientSignals >= MAXIMUM_ACTIVE_AMBIENT_SIGNALS) return;
    const route = chooseAmbientRoute();
    if (!route) return;
    activeSignals.push({ route, startedAt: performance.now(), source: 'ambient' });
    requestSignalFrame();
  }

  interactionSurface.addEventListener('pointerenter', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    spawnSignal(event.clientX, event.clientY, true);
  }, { passive: true });

  interactionSurface.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    if (lastPointerX === undefined || lastPointerY === undefined) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      return;
    }
    const movement = Math.hypot(event.clientX - lastPointerX, event.clientY - lastPointerY);
    if (movement < minimumPointerTravel) return;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    spawnSignal(event.clientX, event.clientY);
  }, { passive: true });

  interactionSurface.addEventListener('pointerleave', () => {
    lastPointerX = undefined;
    lastPointerY = undefined;
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(network);
  } else {
    window.addEventListener('resize', resize);
  }

  new IntersectionObserver(entries => {
    isVisible = entries.some(entry => entry.isIntersecting);
    if (isVisible) {
      resize();
      requestSignalFrame();
      spawnAmbientSignal();
      scheduleAmbientSignal();
    } else if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
    if (!isVisible && ambientTimer) {
      clearTimeout(ambientTimer);
      ambientTimer = undefined;
    }
  }, { threshold: .05 }).observe(network);
})();
