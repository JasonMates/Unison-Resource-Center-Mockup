/**
 * Temporary Resources hero background.
 * Preserves the compressed input-to-output network previously used on index.html.
 */
(() => {
  const network = document.querySelector('.resource-hero-network');
  const canvas = network?.querySelector('.resource-hero-network-canvas');
  const context = canvas?.getContext('2d');
  const interactionSurface = network?.closest('.hero');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!network || !canvas || !context || !interactionSurface) return;

  let width = 0;
  let height = 0;
  let animationFrame;
  let animationStart;
  let lastFrame;
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

  const outputCount = 32;
  const outputs = Array.from({ length: outputCount }, (_, index) => {
    const random = Math.abs(Math.sin((index + 31) * 11.173) * 31841.297) % 1;
    const secondaryRandom = Math.abs(Math.sin((index + 43) * 19.417) * 21413.611) % 1;
    return {
      ratio: (index + .5) / outputCount,
      xJitter: (random - .5) * 18,
      yJitter: (secondaryRandom - .5) * 9
    };
  });

  const routeCount = 80;
  const routes = Array.from({ length: routeCount }, (_, index) => {
    const random = Math.abs(Math.sin((index + 3) * 17.381) * 29417.113) % 1;
    const secondaryRandom = Math.abs(Math.sin((index + 11) * 8.731) * 19341.719) % 1;
    const tertiaryRandom = Math.abs(Math.sin((index + 19) * 14.293) * 23817.417) % 1;
    return {
      startRatio: (index + .5) / routeCount,
      outputIndex: (index * 11) % outputCount,
      startXJitter: (secondaryRandom - .5) * 18,
      startYJitter: (tertiaryRandom - .5) * 6,
      pinchOffset: (random - .5) * 2,
      opacity: .14 + random * .22,
      lineWidth: .55 + secondaryRandom * .55,
      cycle: 6800 + random * 2100,
      cycleOffset: secondaryRandom * 8600,
      travelDuration: 1750 + tertiaryRandom * 550,
      active: index % 3 === 0 || index % 8 === 0,
      strumEnergy: 0,
      normalX: 0,
      normalY: 1
    };
  });

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(devicePixelRatio || 1, 2);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function cubicPoint(start, controlOne, controlTwo, end, progress) {
    const inverse = 1 - progress;
    return {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * progress * controlOne.x + 3 * inverse * progress ** 2 * controlTwo.x + progress ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * progress * controlOne.y + 3 * inverse * progress ** 2 * controlTwo.y + progress ** 3 * end.y
    };
  }

  function routePoint(route, progress) {
    const sideInset = Math.max(18, width * .035);
    const start = {
      x: sideInset + route.startXJitter,
      y: height * route.startRatio + route.startYJitter
    };
    const output = outputs[route.outputIndex];
    const end = {
      x: width - sideInset + output.xJitter,
      y: height * output.ratio + output.yJitter
    };
    const pinchY = height * .5 + route.pinchOffset;
    const pinchStart = { x: width * .48, y: pinchY };
    const pinchEnd = { x: width * .52, y: pinchY };

    if (progress <= .48) {
      return cubicPoint(start, { x: width * .25, y: start.y }, { x: width * .385, y: pinchY }, pinchStart, progress / .48);
    }
    if (progress < .52) {
      const pinchProgress = (progress - .48) / .04;
      return { x: pinchStart.x + (pinchEnd.x - pinchStart.x) * pinchProgress, y: pinchY };
    }
    return cubicPoint(pinchEnd, { x: width * .615, y: pinchY }, { x: width * .75, y: end.y }, end, (progress - .52) / .48);
  }

  function trace(route, startProgress = 0, endProgress = 1, steps = 40) {
    function displacedPoint(progress) {
      const point = routePoint(route, progress);
      let envelope = 0;
      if (progress < .48) envelope = Math.sin(Math.PI * progress / .48);
      else if (progress > .52) envelope = Math.sin(Math.PI * (progress - .52) / .48);
      const displacement = Math.sin(pointer.phase) * 9 * route.strumEnergy * envelope;
      return { x: point.x + route.normalX * displacement, y: point.y + route.normalY * displacement };
    }

    const firstPoint = displacedPoint(startProgress);
    context.beginPath();
    context.moveTo(firstPoint.x, firstPoint.y);
    for (let step = 1; step <= steps; step += 1) {
      const progress = startProgress + (endProgress - startProgress) * step / steps;
      const point = displacedPoint(progress);
      context.lineTo(point.x, point.y);
    }
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
    const radius = Math.min(52, height * .15);
    let closestDistance = Infinity;
    let closestProgress = 0;
    for (let step = 0; step <= 34; step += 1) {
      const progress = step / 34;
      const point = routePoint(route, progress);
      const distance = pointToSegmentDistance(point.x, point.y, pointer.sweepStartX, pointer.sweepStartY, pointer.sweepEndX, pointer.sweepEndY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestProgress = progress;
      }
    }
    if (closestDistance >= radius) return;
    const previous = routePoint(route, Math.max(0, closestProgress - .018));
    const next = routePoint(route, Math.min(1, closestProgress + .018));
    const tangentX = next.x - previous.x;
    const tangentY = next.y - previous.y;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    const proximity = 1 - closestDistance / radius;
    route.strumEnergy = Math.min(1, Math.max(route.strumEnergy, pointer.energy * proximity * proximity));
    route.normalX = -tangentY / tangentLength;
    route.normalY = tangentX / tangentLength;
  }

  function draw(elapsed = 0, frameDuration = 16.67) {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    routes.forEach((route, index) => {
      route.strumEnergy *= Math.pow(.955, frameDuration / 16.67);
      excite(route);
      trace(route, 0, .5, 30);
      context.strokeStyle = `rgba(188, 219, 226, ${route.opacity})`;
      context.lineWidth = route.lineWidth;
      context.stroke();
      if (index < outputCount) {
        trace(route, .5, 1, 30);
        context.stroke();
      }

      if (!route.active) return;
      const cycleTime = (elapsed + route.cycleOffset) % route.cycle;
      const holdDuration = 725;
      const fadeDuration = 900;
      let signalProgress = 0;
      let signalOpacity = 0;
      if (cycleTime < route.travelDuration) {
        const progress = cycleTime / route.travelDuration;
        signalProgress = progress * progress * (3 - 2 * progress);
        signalOpacity = 1;
      } else if (cycleTime < route.travelDuration + holdDuration) {
        signalProgress = 1;
        signalOpacity = 1;
      } else if (cycleTime < route.travelDuration + holdDuration + fadeDuration) {
        signalProgress = 1;
        signalOpacity = 1 - (cycleTime - route.travelDuration - holdDuration) / fadeDuration;
      }
      if (signalOpacity > .01) {
        trace(route, 0, signalProgress, 40);
        context.strokeStyle = `rgba(238, 247, 249, ${signalOpacity * .82})`;
        context.lineWidth = route.lineWidth + .85;
        context.stroke();
      }
    });

    context.fillStyle = 'rgba(224, 238, 241, .66)';
    routes.forEach(route => {
      const start = routePoint(route, 0);
      context.fillRect(start.x - 1, start.y - 1, 2, 2);
    });
    context.fillStyle = 'rgba(224, 238, 241, .72)';
    routes.slice(0, outputCount).forEach(route => {
      const end = routePoint(route, 1);
      context.fillRect(end.x - 1.3, end.y - 1.3, 2.6, 2.6);
    });
  }

  function start() {
    if (animationFrame) return;
    resize();
    if (reduceMotion) {
      draw(4200);
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
    if (reduceMotion || !animationFrame) draw(4200);
  }).observe(network);
  new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) start();
    else stop();
  }, { threshold: .05 }).observe(network);
})();
