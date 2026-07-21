/**
 * Feedforward neural-network background for the index "AI assisted" section.
 * Each animated route remains continuous from an input token through two hidden
 * layers to an output neuron, then fades as a complete path.
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
  const nodes = layerSizes.map((size, layerIndex) => Array.from({ length: size }, (_, nodeIndex) => ({
    layerIndex,
    nodeIndex,
    x: 0,
    y: 0
  })));

  const routeCount = 144;
  const routes = Array.from({ length: routeCount }, (_, index) => {
    const random = Math.abs(Math.sin((index + 3) * 17.381) * 29417.113) % 1;
    const secondaryRandom = Math.abs(Math.sin((index + 11) * 8.731) * 19341.719) % 1;
    const tertiaryRandom = Math.abs(Math.sin((index + 19) * 14.293) * 23817.417) % 1;
    const brightnessRandom = Math.abs(Math.sin((index + 29) * 11.947) * 26731.631) % 1;
    const group = Math.floor(index / layerSizes[0]);
    const travelDuration = 600 + secondaryRandom * 380;
    const holdDuration = 420;
    const fadeDuration = 2300 + random * 500;
    const resetDuration = 180 + tertiaryRandom * 360;
    const cycle = travelDuration + holdDuration + fadeDuration + resetDuration;
    return {
      nodeIndexes: [
        index % layerSizes[0],
        (index * 9 + group * 3) % layerSizes[1],
        (index * 7 + group * 5) % layerSizes[2],
        (index * 5 + group * 2) % layerSizes[3]
      ],
      opacity: .006 + brightnessRandom * .024,
      lineWidth: .28 + secondaryRandom * .30,
      signalBrightness: .12 + brightnessRandom * .76,
      cycle,
      cycleOffset: tertiaryRandom * cycle,
      travelDuration,
      holdDuration,
      fadeDuration,
      strumEnergy: 0
    };
  });

  let width = 0;
  let height = 0;
  let animationFrame;
  let animationStart;
  let lastFrame;
  let pixelRatio = 1;
  const pointer = {
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

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const maximumPixelRatio = width < 1360 ? 1 : 2;
    pixelRatio = Math.min(devicePixelRatio || 1, maximumPixelRatio);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    baseCanvas.width = canvas.width;
    baseCanvas.height = canvas.height;
    baseContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const frameInset = 3;
    const availableHeight = height - frameInset * 2;
    const layerXPositions = width < 1360 ? compactLayerXPositions : desktopLayerXPositions;
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
  }

  function routeNodes(route) {
    return route.nodeIndexes.map((nodeIndex, layerIndex) => nodes[layerIndex][nodeIndex]);
  }

  function routePoint(route, progress, displaced = true) {
    const selectedNodes = routeNodes(route);
    const scaledProgress = Math.min(progress, .999999) * (selectedNodes.length - 1);
    const segmentIndex = Math.min(selectedNodes.length - 2, Math.floor(scaledProgress));
    const segmentProgress = progress >= 1 ? 1 : scaledProgress - segmentIndex;
    const start = selectedNodes[segmentIndex];
    const end = selectedNodes[segmentIndex + 1];
    const tangentX = end.x - start.x;
    const tangentY = end.y - start.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const envelope = Math.sin(Math.PI * segmentProgress);
    const displacement = displaced
      ? Math.sin(pointer.phase + segmentIndex * .36) * 8 * route.strumEnergy * envelope
      : 0;
    return {
      x: start.x + tangentX * segmentProgress - tangentY / tangentLength * displacement,
      y: start.y + tangentY * segmentProgress + tangentX / tangentLength * displacement
    };
  }

  function trace(targetContext, route, endProgress = 1, displaced = true) {
    const shouldCurve = displaced && route.strumEnergy > .002;
    if (!shouldCurve) {
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
      return;
    }

    const steps = Math.max(8, Math.ceil(endProgress * 30));
    const start = routePoint(route, 0);
    targetContext.beginPath();
    targetContext.moveTo(start.x, start.y);
    for (let step = 1; step <= steps; step += 1) {
      const point = routePoint(route, endProgress * step / steps);
      targetContext.lineTo(point.x, point.y);
    }
  }

  function renderBaseNetwork() {
    baseContext.clearRect(0, 0, width, height);
    routes.forEach(route => {
      trace(baseContext, route, 1, false);
      baseContext.strokeStyle = `rgba(188, 219, 226, ${route.opacity})`;
      baseContext.lineWidth = route.lineWidth;
      baseContext.stroke();
    });
  }

  function pointToSegmentDistance(pointX, pointY, startX, startY, endX, endY) {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (lengthSquared < .001) return Math.hypot(pointX - startX, pointY - startY);
    const projection = Math.max(0, Math.min(1, ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared));
    return Math.hypot(pointX - (startX + segmentX * projection), pointY - (startY + segmentY * projection));
  }

  function excite(route) {
    if (pointer.energy <= .01 || pointer.sweepUntil <= performance.now()) return;
    let closestDistance = Infinity;
    for (let step = 0; step <= 36; step += 1) {
      const point = routePoint(route, step / 36, false);
      closestDistance = Math.min(closestDistance, pointToSegmentDistance(
        point.x,
        point.y,
        pointer.sweepStartX,
        pointer.sweepStartY,
        pointer.sweepEndX,
        pointer.sweepEndY
      ));
    }
    const interactionRadius = Math.min(48, height * .1);
    if (closestDistance >= interactionRadius) return;
    const proximity = 1 - closestDistance / interactionRadius;
    route.strumEnergy = Math.min(1, Math.max(route.strumEnergy, pointer.energy * proximity * proximity));
  }

  function draw(elapsed = 0, frameDuration = 16.67) {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.drawImage(baseCanvas, 0, 0, baseCanvas.width, baseCanvas.height, 0, 0, width, height);

    routes.forEach(route => {
      route.strumEnergy *= Math.pow(.955, frameDuration / 16.67);
      excite(route);
      if (route.strumEnergy > .002) {
        trace(context, route);
        context.strokeStyle = `rgba(188, 219, 226, ${route.opacity})`;
        context.lineWidth = route.lineWidth;
        context.stroke();
      }

      const localTime = (elapsed + route.cycleOffset) % route.cycle;
      let progress = 0;
      let opacity = 0;
      if (localTime < route.travelDuration) {
        const travelProgress = localTime / route.travelDuration;
        progress = travelProgress * travelProgress * (3 - 2 * travelProgress);
        opacity = 1;
      } else if (localTime < route.travelDuration + route.holdDuration) {
        progress = 1;
        opacity = 1;
      } else if (localTime < route.travelDuration + route.holdDuration + route.fadeDuration) {
        progress = 1;
        opacity = 1 - (localTime - route.travelDuration - route.holdDuration) / route.fadeDuration;
      }
      if (opacity > .01) {
        trace(context, route, progress);
        context.strokeStyle = `rgba(239, 247, 249, ${opacity * route.signalBrightness})`;
        context.lineWidth = route.lineWidth + .74;
        context.stroke();
      }
    });

    nodes.forEach((layer, layerIndex) => {
      const flow = reduceMotion ? .5 : .5 + Math.sin(elapsed / 4200 + layerIndex * .48) * .5;
      layer.forEach(node => {
        const radius = layerIndex === 0 || layerIndex === nodes.length - 1 ? 1.9 : 2.45;
        context.beginPath();
        context.arc(node.x, node.y, radius + 3.8, 0, Math.PI * 2);
        context.fillStyle = `rgba(207, 226, 232, ${.014 + flow * .022})`;
        context.fill();
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(225, 239, 242, ${.38 + flow * .08})`;
        context.fill();
      });
    });
  }

  function start() {
    if (animationFrame) return;
    resize();
    if (reduceMotion) {
      draw(4100);
      return;
    }
    animationStart = performance.now();
    lastFrame = animationStart;
    function animate(currentTime) {
      const frameDuration = Math.min(currentTime - lastFrame, 50);
      lastFrame = currentTime;
      pointer.phase += frameDuration * .018;
      pointer.energy *= Math.pow(.95, frameDuration / 16.67);
      draw(currentTime - animationStart, frameDuration);
      animationFrame = requestAnimationFrame(animate);
    }
    animationFrame = requestAnimationFrame(animate);
  }

  function stop() {
    if (!animationFrame) return;
    cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
    pointer.energy = 0;
    routes.forEach(route => { route.strumEnergy = 0; });
  }

  interactionSurface.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const bounds = canvas.getBoundingClientRect();
    if (pointer.lastClientX !== undefined && pointer.lastClientY !== undefined) {
      const movement = Math.hypot(event.clientX - pointer.lastClientX, event.clientY - pointer.lastClientY);
      if (movement > .5) {
        pointer.sweepStartX = pointer.lastClientX - bounds.left;
        pointer.sweepStartY = pointer.lastClientY - bounds.top;
        pointer.sweepEndX = event.clientX - bounds.left;
        pointer.sweepEndY = event.clientY - bounds.top;
        pointer.sweepUntil = performance.now() + 110;
        pointer.energy = Math.min(1, pointer.energy + movement / 20);
      }
    }
    pointer.lastClientX = event.clientX;
    pointer.lastClientY = event.clientY;
  }, { passive: true });
  interactionSurface.addEventListener('pointerleave', () => {
    pointer.lastClientX = undefined;
    pointer.lastClientY = undefined;
    pointer.sweepUntil = 0;
  });

  new ResizeObserver(() => {
    resize();
    if (reduceMotion || !animationFrame) draw(4100);
  }).observe(network);
  new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) start();
    else stop();
  }, { threshold: .05 }).observe(network);
})();
