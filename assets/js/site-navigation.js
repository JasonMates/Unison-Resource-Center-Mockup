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

  const desktopBreakpoint = 1050;
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
    menuButton.innerHTML = isOpen ? '&#10005;' : '&#9776;';
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
    dropdown.querySelector('summary')?.addEventListener('click', () => {
      closeDropdowns(dropdown);
    });

    dropdown.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') dropdown.removeAttribute('open');
    });

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
    if (window.innerWidth > desktopBreakpoint && navigation.classList.contains('open')) {
      setMenuState(false);
    }
  });
}());
