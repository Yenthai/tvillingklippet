const toggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const header = document.querySelector(".site-header");
const navLinks = Array.from(document.querySelectorAll(".site-nav a"));

const syncHeaderState = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 18);
};

syncHeaderState();
window.addEventListener("scroll", syncHeaderState, { passive: true });

toggle?.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("menu-open");
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute("aria-label", isOpen ? "Stäng meny" : "Öppna meny");
});

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    document.body.classList.remove("menu-open");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-label", "Öppna meny");
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.body.classList.remove("menu-open");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Öppna meny");
});

const setActiveNavLink = (activeLink) => {
  navLinks.forEach((link) => {
    const isActive = link === activeLink;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", activeLink.hash ? "location" : "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
};

const galleryNavLink = navLinks.find((link) => link.getAttribute("href")?.endsWith("gallery.html"));

if (document.body.classList.contains("gallery-page")) {
  setActiveNavLink(galleryNavLink);
} else {
  const sectionLinks = navLinks.filter((link) => link.hash && link.getAttribute("href")?.startsWith("#"));
  const sectionMap = new Map(
    sectionLinks
      .map((link) => [document.querySelector(link.hash), link])
      .filter(([section]) => section)
  );
  const initialSectionLink = sectionLinks.find((link) => link.hash === window.location.hash) || sectionLinks[0];

  if (initialSectionLink) setActiveNavLink(initialSectionLink);

  if (sectionMap.size && "IntersectionObserver" in window) {
    const activeSections = new Map();

    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeSections.set(entry.target, entry.intersectionRatio);
          } else {
            activeSections.delete(entry.target);
          }
        });

        const currentSection = [...activeSections.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const currentLink = sectionMap.get(currentSection);
        if (currentLink) setActiveNavLink(currentLink);
      },
      { rootMargin: "-28% 0px -54% 0px", threshold: [0.08, 0.18, 0.32, 0.5] }
    );

    sectionMap.forEach((_, section) => navObserver.observe(section));
  } else if (sectionLinks.length) {
    setActiveNavLink(sectionLinks[0]);
  }
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealTargets = document.querySelectorAll(
  ".section-heading, .price-category, .about-portrait, .about-copy, .gallery-shell, .gallery-tile, .gallery-swipe-hint, .contact-hours-shell, .hours-poster-card, .contact-strip"
);

const lightbox = document.querySelector("[data-lightbox]");
const lightboxImage = document.querySelector("[data-lightbox-image]");
const lightboxClose = document.querySelector("[data-lightbox-close]");
const lightboxPrev = document.querySelector("[data-lightbox-prev]");
const lightboxNext = document.querySelector("[data-lightbox-next]");
const lightboxTiles = Array.from(document.querySelectorAll("[data-lightbox-src]"));
let lightboxIndex = 0;

const showLightboxImage = (nextIndex) => {
  if (!lightbox || !lightboxImage || !lightboxTiles.length) return;
  lightboxIndex = (nextIndex + lightboxTiles.length) % lightboxTiles.length;
  const tile = lightboxTiles[lightboxIndex];
  const tileImage = tile.querySelector("img");

  lightboxImage.src = tile.dataset.lightboxSrc;
  lightboxImage.alt = tileImage?.alt || "";
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
};

const closeLightbox = () => {
  if (!lightbox || !lightboxImage) return;
  lightbox.hidden = true;
  lightboxImage.src = "";
  document.body.classList.remove("lightbox-open");
};

lightboxTiles.forEach((tile, index) => {
  tile.addEventListener("click", () => showLightboxImage(index));
});

lightboxClose?.addEventListener("click", closeLightbox);
lightboxPrev?.addEventListener("click", () => showLightboxImage(lightboxIndex - 1));
lightboxNext?.addEventListener("click", () => showLightboxImage(lightboxIndex + 1));

lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});

window.addEventListener("keydown", (event) => {
  if (!lightbox || lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") showLightboxImage(lightboxIndex - 1);
  if (event.key === "ArrowRight") showLightboxImage(lightboxIndex + 1);
});

if (!prefersReducedMotion && "IntersectionObserver" in window) {
  document.body.classList.add("can-reveal");
  revealTargets.forEach((target) => target.classList.add("reveal"));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.16 }
  );

  revealTargets.forEach((target) => revealObserver.observe(target));
}
