# Unison website prototype

This is a static, multi-page website. It has no build step: open any HTML file
directly in a browser or serve this directory with a simple local web server.

## Project structure

```text
Unison Mockup/
|-- index.html
|-- Contact.html
|-- Resources.html
|-- CME.html
|-- Services.html
`-- assets/
    |-- css/
    |   |-- site-navigation.css
    |   |-- index.css
    |   |-- contact.css
    |   |-- resources.css
    |   |-- cme.css
    |   `-- services.css
    `-- js/
        |-- site-navigation.js
        |-- index.js
        |-- contact.js
        |-- resource-catalog.js
        |-- resources.js
        |-- cme.js
        `-- services.js
```

## Responsibilities

- HTML files contain document structure and page content.
- Each page has a matching stylesheet under `assets/css/`.
- `site-navigation.css` owns the shared tablet and mobile navigation layout.
- `site-navigation.js` owns behavior shared by every header: the mobile menu,
  dropdown dismissal, keyboard handling, focus containment, and responsive reset.
- Matching page scripts own only page-specific interactions.
- `resource-catalog.js` contains editable resource records. `resources.js` owns
  filtering, search, modal, and rendering behavior.

## Making changes

1. Change page content or semantics in the matching HTML file.
2. Change page presentation in its matching CSS file.
3. Put cross-page navigation behavior in `site-navigation.js` only.
4. Put page-specific behavior in the matching page script.
5. Preserve script order where data files precede the code that consumes them.

When changing a shared component such as the navigation or footer markup, update
all five HTML pages and test at desktop and mobile widths. There is deliberately
no client-side HTML include system: the pages remain usable when opened directly
from the filesystem.

## Accessibility checks

Before handing off a page, verify keyboard access, visible focus, reduced-motion
behavior, heading order, form labels, ARIA relationships, and color contrast.
Also test direct hash links on the Services page and modal focus behavior on the
Resources page.
