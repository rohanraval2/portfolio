import { fetchJSON, renderProjects, fetchGitHubData } from 'portfolio/global.js';

const allProjects = await fetchJSON('./lib/projects.json');
const latestProjects = allProjects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h2');

const githubData = await fetchGitHubData('rohanraval2');
const profileStats = document.querySelector('#profile-stats');
if (profileStats) {
    profileStats.innerHTML = `
    <div class="stat">
      <span class="label">Followers</span>
      <span class="value">${githubData.followers}</span>
    </div>
    <div class="stat">
      <span class="label">Following</span>
      <span class="value">${githubData.following}</span>
    </div>
    <div class="stat">
      <span class="label">Public Repos</span>
      <span class="value">${githubData.public_repos}</span>
    </div>
    <div class="stat">
      <span class="label">Public Gists</span>
      <span class="value">${githubData.public_gists}</span>
    </div>
  `;
}
