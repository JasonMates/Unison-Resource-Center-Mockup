/**
 * Shared site navigation controller.
 *
 * Owns the mobile menu, dropdown dismissal, focus management, and Escape-key
 * behavior used by every page. Page-specific interactions belong in their own
 * scripts and should not be added here.
 */
(function initializeSiteNavigation() {
  'use strict';

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.nav-links');
  const mainContent = document.querySelector('main');
  const pageFooter = document.querySelector('footer');

  if (!menuButton || !navigation || !mainContent || !pageFooter) return;

  const compactNavigationQuery = matchMedia(
    '(max-width: 1180px), (hover: none) and (pointer: coarse)'
  );
  const desktopHoverQuery = matchMedia(
    '(min-width: 1181px) and (hover: hover) and (pointer: fine)'
  );
  const navDropdowns = [...navigation.querySelectorAll('.nav-dropdown')];

  function closeDropdowns(except = null) {
    navDropdowns
      .filter(dropdown => dropdown !== except)
      .forEach(dropdown => dropdown.removeAttribute('open'));
  }

  function setMenuState(isOpen, { returnFocus = false } = {}) {
    navigation.classList.toggle('open', isOpen);
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-open', isOpen);
    mainContent.inert = isOpen;
    pageFooter.inert = isOpen;

    if (isOpen) {
      requestAnimationFrame(() => navigation.querySelector('a, summary')?.focus());
      return;
    }

    closeDropdowns();
    if (returnFocus) menuButton.focus();
  }

  function trapMobileMenuFocus(event) {
    if (event.key !== 'Tab' || !navigation.classList.contains('open')) return;

    const focusableElements = [menuButton, ...navigation.querySelectorAll('a, summary')]
      .filter(element => element.offsetParent !== null);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  menuButton.addEventListener('click', () => {
    setMenuState(!navigation.classList.contains('open'));
  });

  navigation.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenuState(false));
  });

  navDropdowns.forEach(dropdown => {
    const summary = dropdown.querySelector('summary');
    let closeTimer;

    function cancelScheduledClose() {
      window.clearTimeout(closeTimer);
    }

    function scheduleClose() {
      cancelScheduledClose();
      closeTimer = window.setTimeout(() => {
        if (!dropdown.matches(':hover') && !dropdown.contains(document.activeElement)) {
          dropdown.removeAttribute('open');
        }
      }, 220);
    }

    summary?.addEventListener('click', event => {
      // Mouse users get hover-driven menus. Keyboard-generated clicks retain
      // native <details> behavior, and compact/touch navigation remains tappable.
      if (desktopHoverQuery.matches && event.detail > 0) {
        event.preventDefault();
        return;
      }

      closeDropdowns(dropdown);
    });

    dropdown.addEventListener('pointerenter', event => {
      cancelScheduledClose();
      if (event.pointerType !== 'mouse' || !desktopHoverQuery.matches) return;
      closeDropdowns(dropdown);
      dropdown.setAttribute('open', '');
    });

    dropdown.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') scheduleClose();
    });

    dropdown.addEventListener('focusin', cancelScheduledClose);

    dropdown.addEventListener('focusout', () => {
      requestAnimationFrame(() => {
        if (!dropdown.contains(document.activeElement)) dropdown.removeAttribute('open');
      });
    });
  });

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.nav-dropdown')) closeDropdowns();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const openDropdown = navigation.querySelector('details[open]');
      if (openDropdown) {
        openDropdown.removeAttribute('open');
        openDropdown.querySelector('summary')?.focus();
      } else if (navigation.classList.contains('open')) {
        setMenuState(false, { returnFocus: true });
      }
    }

    trapMobileMenuFocus(event);
  });

  window.addEventListener('resize', () => {
    if (!compactNavigationQuery.matches && navigation.classList.contains('open')) {
      setMenuState(false);
    }
  });
}());
