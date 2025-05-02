console.log("IT'S ALIVE!");

const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/"                     
  : "/portfolio/";

let pages = [
  { url: "", title: "Home" },
  { url: "resume/", title: "Resume" }, 
  { url: "contact/", title: "Contact" },
  { url: "projects/", title: "Projects" }, 
  { url: "https://github.com/rohanraval2", title: "GitHub" } 
];

let nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  url = !url.startsWith("http") ? BASE_PATH + url : url;
  let a = document.createElement("a");
  a.href = url;
  a.textContent = p.title;
  a.classList.toggle("current", a.host === location.host && a.pathname === location.pathname);
  a.toggleAttribute("target", a.host !== location.host);
  nav.append(a);
}

document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select id="theme-switch">
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
  `
);

function setColorScheme(scheme) {
  document.documentElement.style.setProperty('color-scheme', scheme);
  localStorage.colorScheme = scheme;
  document.querySelector('#theme-switch').value = scheme;
}

if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

document.querySelector('#theme-switch').addEventListener('input', (event) => {
  setColorScheme(event.target.value);
});

export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  containerElement.innerHTML = '';
  projects.forEach(project => {
    const article = document.createElement('article');
    article.innerHTML = `
      <${headingLevel}>${project.title}</${headingLevel}>
      <img src="${project.image}" alt="${project.title}">
      <div>
        <p>${project.description}</p>
        <p class="year">${project.year}</p>
      </div>
    `;
    containerElement.appendChild(article);
  });
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}
