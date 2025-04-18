console.log("IT'S ALIVE!")

const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/"                     // Local development
  : "/portfolio/";     // GitHub Pages repo name — CHANGE THIS!

// Pages to appear in the nav
let pages = [
  { url: "", title: "Home" },
  { url: "resume/", title: "Resume" }, 
  { url: "contact/", title: "Contact" },
  { url: "projects/", title: "Projects" }, 
  { url: "https://github.com/rohanraval2", title: "GitHub" } // external
];

// Create nav and add to top of body
let nav = document.createElement("nav");
document.body.prepend(nav);

// Loop through pages and add each as a link
for (let p of pages) {
  let url = p.url;

  // Prefix internal links with BASE_PATH
  url = !url.startsWith("http") ? BASE_PATH + url : url;

  // Create <a> tag
  let a = document.createElement("a");
  a.href = url;
  a.textContent = p.title;

  // Highlight current page
  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname
  );

  // Open external links in new tab
  a.toggleAttribute("target", a.host !== location.host);

  // Add link to nav
  nav.append(a);
}
