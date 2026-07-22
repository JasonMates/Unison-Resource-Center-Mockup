/**
 * Vertical, continuously rotating carousel for the Who we are section.
 *
 * Six panels occupy measured slots inside the mask and two remain buffered
 * below it. Hovering redistributes slot height without changing the gutter.
 * Activating a panel rotates the queue entirely along the vertical axis.
 */
(function initializeVerticalCarousel() {
  'use strict';

  const carousel = document.querySelector('[data-vertical-carousel]');
  const track = carousel?.querySelector('.about-carousel-track');
  if (!carousel || !track) return;

  const panels = [...track.querySelectorAll('[data-carousel-panel]')];
  const previousButton = carousel.querySelector('[data-carousel-previous]');
  const nextButton = carousel.querySelector('[data-carousel-next]');
  const status = carousel.querySelector('[data-carousel-status]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safariFrameFallback = /Apple Computer/.test(navigator.vendor)
    && /Safari/.test(navigator.userAgent)
    && !/(CriOS|FxiOS|EdgiOS|OPiOS)/.test(navigator.userAgent);
  const visibleCount = Math.min(6, panels.length);
  const gutter = 6;
  const tailHeights = [52, 30, 20, 14, 10];
  let queue = [...panels];
  let isAnimating = false;
  let previewedPanel = null;
  let gestureStartY;
  let suppressClick = false;

  function getGeometry(order, previewPanel = null) {
    const trackHeight = track.clientHeight;
    const heights = order.map((_, position) => {
      if (position === 0) {
        const visibleTail = tailHeights.slice(0, visibleCount - 1)
          .reduce((total, height) => total + height, 0);
        return Math.max(190, trackHeight - visibleTail - gutter * (visibleCount - 1));
      }
      return tailHeights[position - 1] === undefined ? 10 : tailHeights[position - 1];
    });

    const previewIndex = order.indexOf(previewPanel);
    if (previewIndex >= 0 && previewIndex < visibleCount) {
      if (previewIndex === 0) {
        heights[0] += 12;
        if (heights[1] !== undefined) heights[1] -= 7;
        if (heights[2] !== undefined) heights[2] -= 5;
      } else {
        const expansion = Math.min(10, Math.max(6, heights[previewIndex] * .28));
        heights[previewIndex] += expansion;

        const before = previewIndex - 1;
        const after = previewIndex + 1;
        if (after < visibleCount) {
          heights[before] -= expansion * .58;
          heights[after] -= expansion * .42;
        } else {
          heights[before] -= expansion;
        }
      }
    }

    let top = 0;
    return new Map(order.map((panel, position) => {
      const slot = { top, height: heights[position], position };
      top += heights[position] + gutter;
      return [panel, slot];
    }));
  }

  function setPanelSlot(panel, slot) {
    panel.style.top = `${slot.top}px`;
    panel.style.height = `${slot.height}px`;
  }

  function waitForAnimation(animation, duration) {
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      if (typeof animation.addEventListener === 'function') {
        animation.addEventListener('finish', finish, { once: true });
        animation.addEventListener('cancel', finish, { once: true });
      }
      if (animation.finished && typeof animation.finished.then === 'function') {
        animation.finished.then(finish, finish);
      }
      window.setTimeout(finish, duration + 120);
    });
  }

  function runFrameAnimation(entries, duration, movementEnd) {
    return new Promise(resolve => {
      let animationStart;

      entries.forEach(({ element, end }) => {
        element.style.top = `${end.top}px`;
        element.style.height = `${end.height}px`;
        element.style.transformOrigin = 'center top';
        element.style.willChange = 'transform';
      });

      function renderFrame(timestamp) {
        if (animationStart === undefined) animationStart = timestamp;
        const timelineProgress = Math.min(1, (timestamp - animationStart) / duration);
        const movementProgress = Math.min(1, timelineProgress / movementEnd);
        const easedProgress = 1 - Math.pow(1 - movementProgress, 3);

        entries.forEach(({ element, start, end }) => {
          const currentTop = start.top + (end.top - start.top) * easedProgress;
          const currentHeight = start.height + (end.height - start.height) * easedProgress;
          const translateY = currentTop - end.top;
          const scaleY = currentHeight / Math.max(end.height, 1);
          element.style.transform = `translate3d(0, ${translateY}px, 0) scaleY(${scaleY})`;
        });

        if (timelineProgress < 1) requestAnimationFrame(renderFrame);
        else {
          entries.forEach(({ element }) => {
            element.style.transform = 'none';
            element.style.willChange = '';
          });
          resolve();
        }
      }

      requestAnimationFrame(renderFrame);
    });
  }

  function applyGeometry(previewPanel = previewedPanel) {
    const geometry = getGeometry(queue, previewPanel);
    panels.forEach(panel => setPanelSlot(panel, geometry.get(panel)));
  }

  function announceCurrentPanel() {
    if (!status) return;
    const panel = queue[0];
    const originalIndex = panels.indexOf(panel);
    status.textContent = `Item ${originalIndex + 1} of ${panels.length}: ${panel.dataset.title}`;
  }

  function syncQueue({ announce = true } = {}) {
    queue.forEach((panel, position) => {
      panel.dataset.position = String(position);
      panel.dataset.distance = String(position);
      panel.setAttribute('aria-pressed', String(position === 0));
      panel.tabIndex = position < visibleCount ? 0 : -1;
      if (position === 0) panel.setAttribute('aria-current', 'true');
      else panel.removeAttribute('aria-current');
      if (position < visibleCount) panel.removeAttribute('aria-hidden');
      else panel.setAttribute('aria-hidden', 'true');
    });

    if (announce) announceCurrentPanel();
  }

  function clearPreview({ update = true } = {}) {
    previewedPanel = null;
    panels.forEach(panel => panel.classList.remove('is-previewed', 'is-preview-neighbor'));
    if (update && !isAnimating) applyGeometry(null);
  }

  function previewPanel(panel) {
    if (isAnimating || queue.indexOf(panel) >= visibleCount) return;
    clearPreview({ update: false });
    previewedPanel = panel;
    panel.classList.add('is-previewed');

    const position = queue.indexOf(panel);
    queue[position - 1]?.classList.add('is-preview-neighbor');
    if (position + 1 < visibleCount) queue[position + 1]?.classList.add('is-preview-neighbor');
    applyGeometry(panel);
  }

  function currentSlots() {
    const trackBounds = track.getBoundingClientRect();
    return new Map(panels.map(panel => {
      const bounds = panel.getBoundingClientRect();
      return [panel, {
        top: bounds.top - trackBounds.top,
        height: bounds.height
      }];
    }));
  }

  async function animateQueue(nextQueue, wrappedPanels, direction) {
    if (isAnimating) return;

    clearPreview({ update: false });
    const startSlots = currentSlots();
    const endSlots = getGeometry(nextQueue, null);

    if (reduceMotion || !Element.prototype.animate) {
      queue = nextQueue;
      queue.forEach(panel => track.append(panel));
      applyGeometry(null);
      syncQueue();
      return;
    }

    isAnimating = true;
    track.classList.add('is-queueing');
    const wrappedSet = new Set(wrappedPanels);
    const duration = 620;
    const movementEnd = .86;
    const exitSlots = new Map();
    const reentryClones = [];

    if (direction === 'forward') {
      // Keep every outgoing panel in the same six-pixel chain as the panel
      // beneath it. The chain is only recycled after it is fully above the
      // mask, so the visible gutter can never stretch or collapse.
      let nextTop = 0;
      [...wrappedPanels].reverse().forEach(panel => {
        const height = endSlots.get(panel).height;
        const top = nextTop - gutter - height;
        exitSlots.set(panel, { top, height });
        nextTop = top;
      });

      // Deep selections can return more panels than the permanent two-card
      // buffer contains. Mirror only those returning to a visible slot, place
      // them in a continuous chain below the final surviving panel, and swap
      // them back to their originals once the movement is complete.
      const survivingPanels = queue.filter(panel => !wrappedSet.has(panel));
      const lastSurvivor = survivingPanels[survivingPanels.length - 1];
      const lastSurvivorStart = startSlots.get(lastSurvivor);
      let reentryTop = lastSurvivorStart.top + lastSurvivorStart.height + gutter;

      wrappedPanels.forEach(panel => {
        const end = endSlots.get(panel);
        if (end.position >= visibleCount) return;

        const clone = panel.cloneNode(false);
        clone.removeAttribute('aria-current');
        clone.setAttribute('aria-hidden', 'true');
        clone.tabIndex = -1;
        clone.dataset.carouselClone = '';
        track.append(clone);
        reentryClones.push({
          clone,
          start: { top: reentryTop, height: end.height },
          end
        });
        reentryTop += end.height + gutter;
      });
    }

    if (safariFrameFallback) {
      const frameEntries = panels.map(panel => {
        const measuredStart = startSlots.get(panel);
        const measuredEnd = endSlots.get(panel);

        if (wrappedSet.has(panel) && direction === 'forward') {
          return { element: panel, start: measuredStart, end: exitSlots.get(panel) };
        }
        if (wrappedSet.has(panel) && direction === 'backward') {
          return {
            element: panel,
            start: { top: -measuredStart.height - gutter, height: measuredStart.height },
            end: measuredEnd
          };
        }
        return { element: panel, start: measuredStart, end: measuredEnd };
      });

      reentryClones.forEach(({ clone, start, end }) => {
        clone.style.top = `${start.top}px`;
        clone.style.height = `${start.height}px`;
        frameEntries.push({ element: clone, start, end });
      });

      await runFrameAnimation(frameEntries, duration, movementEnd);
      wrappedPanels.forEach(panel => { panel.style.visibility = 'hidden'; });
      queue = nextQueue;
      queue.forEach(panel => track.append(panel));
      applyGeometry(null);
      syncQueue();
      await new Promise(resolve => requestAnimationFrame(resolve));
      reentryClones.forEach(({ clone }) => clone.remove());
      wrappedPanels.forEach(panel => { panel.style.visibility = ''; });
      track.classList.remove('is-queueing');
      isAnimating = false;
      return;
    }

    const animations = panels.map(panel => {
      const start = startSlots.get(panel);
      const end = endSlots.get(panel);
      let keyframes;

      if (wrappedSet.has(panel) && direction === 'forward') {
        const exit = exitSlots.get(panel);
        keyframes = [
          { offset: 0, top: `${start.top}px`, height: `${start.height}px`, opacity: 1, easing: 'cubic-bezier(.2, .72, .2, 1)' },
          { offset: movementEnd, top: `${exit.top}px`, height: `${exit.height}px`, opacity: 1 },
          { offset: 1, top: `${exit.top}px`, height: `${exit.height}px`, opacity: 1 }
        ];
      } else if (wrappedSet.has(panel) && direction === 'backward') {
        const entryTop = -start.height - gutter;
        keyframes = [
          { offset: 0, top: `${entryTop}px`, height: `${start.height}px`, opacity: 1, easing: 'cubic-bezier(.2, .72, .2, 1)' },
          { offset: movementEnd, top: `${end.top}px`, height: `${end.height}px`, opacity: 1 },
          { offset: 1, top: `${end.top}px`, height: `${end.height}px`, opacity: 1 }
        ];
      } else {
        keyframes = [
          { offset: 0, top: `${start.top}px`, height: `${start.height}px`, easing: 'cubic-bezier(.2, .72, .2, 1)' },
          { offset: movementEnd, top: `${end.top}px`, height: `${end.height}px` },
          { offset: 1, top: `${end.top}px`, height: `${end.height}px` }
        ];
      }

      return panel.animate(keyframes, {
        duration,
        easing: 'linear',
        fill: 'both'
      });
    });

    reentryClones.forEach(({ clone, start, end }) => {
      clone.style.top = `${start.top}px`;
      clone.style.height = `${start.height}px`;
      animations.push(clone.animate([
        { offset: 0, top: `${start.top}px`, height: `${start.height}px`, easing: 'cubic-bezier(.2, .72, .2, 1)' },
        { offset: movementEnd, top: `${end.top}px`, height: `${end.height}px` },
        { offset: 1, top: `${end.top}px`, height: `${end.height}px` }
      ], {
        duration,
        easing: 'linear',
        fill: 'both'
      }));
    });

    await Promise.all(animations.map(animation => waitForAnimation(animation, duration)));
    queue = nextQueue;
    queue.forEach(panel => track.append(panel));
    applyGeometry(null);
    syncQueue();
    animations.forEach(animation => animation.cancel());
    reentryClones.forEach(({ clone }) => clone.remove());
    track.classList.remove('is-queueing');
    isAnimating = false;
  }

  function promotePanel(panel) {
    if (isAnimating) return;
    const selectedIndex = queue.indexOf(panel);
    if (selectedIndex < 0 || selectedIndex >= visibleCount) return;

    const rotationCount = selectedIndex === 0 ? 1 : selectedIndex;
    const wrappedPanels = queue.slice(0, rotationCount);
    const nextQueue = queue.slice(rotationCount).concat(wrappedPanels);
    animateQueue(nextQueue, wrappedPanels, 'forward');
  }

  function rotateBackward() {
    if (isAnimating) return;
    const wrappedPanel = queue[queue.length - 1];
    animateQueue([wrappedPanel, ...queue.slice(0, -1)], [wrappedPanel], 'backward');
  }

  panels.forEach(panel => {
    panel.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') previewPanel(panel);
    });
    panel.addEventListener('focus', () => previewPanel(panel));
    panel.addEventListener('click', event => {
      if (suppressClick) {
        event.preventDefault();
        suppressClick = false;
        return;
      }
      promotePanel(panel);
    });
  });

  track.addEventListener('pointerleave', () => clearPreview());
  track.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!track.contains(document.activeElement)) clearPreview();
    });
  });

  track.addEventListener('keydown', event => {
    const focusedPanel = event.target.closest('[data-carousel-panel]');
    if (!focusedPanel) return;
    const position = queue.indexOf(focusedPanel);
    let targetPosition;

    if (event.key === 'ArrowUp') targetPosition = Math.max(0, position - 1);
    else if (event.key === 'ArrowDown') targetPosition = Math.min(visibleCount - 1, position + 1);
    else if (event.key === 'Home') targetPosition = 0;
    else if (event.key === 'End') targetPosition = visibleCount - 1;
    else return;

    event.preventDefault();
    queue[targetPosition].focus();
  });

  carousel.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    gestureStartY = event.clientY;
    suppressClick = false;
  }, { passive: true });

  carousel.addEventListener('pointerup', event => {
    if (gestureStartY === undefined) return;
    const distance = event.clientY - gestureStartY;
    gestureStartY = undefined;
    if (Math.abs(distance) < 34) return;
    suppressClick = true;
    if (distance < 0) promotePanel(queue[0]);
    else rotateBackward();
  }, { passive: true });

  carousel.addEventListener('pointercancel', () => {
    gestureStartY = undefined;
  });

  previousButton?.addEventListener('click', rotateBackward);
  nextButton?.addEventListener('click', () => promotePanel(queue[0]));

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!isAnimating) applyGeometry(null);
    }).observe(track);
  } else {
    window.addEventListener('resize', () => {
      if (!isAnimating) applyGeometry(null);
    });
  }

  syncQueue({ announce: false });
  applyGeometry(null);
}());
