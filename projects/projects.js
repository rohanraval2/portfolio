import { fetchJSON, renderProjects } from '/portfolio/global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('portfolio/lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');
let selectedIndex = -1;
let query = '';

renderProjects(projects, projectsContainer, 'h2');
renderPieChart(projects);

searchInput.addEventListener('input', (event) => {
  query = event.target.value.toLowerCase();
  let filteredProjects = filterProjects(projects, query);
  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
});

function filterProjects(data, q) {
  return data.filter((project) => {
    const values = Object.values(project).join(' ').toLowerCase();
    return values.includes(q);
  });
}

function renderPieChart(projectList) {
  const rolledData = d3.rollups(projectList, v => v.length, d => d.year);
  const data = rolledData.map(([year, count]) => ({ label: year, value: count }));
  const colors = d3.scaleOrdinal(d3.schemeTableau10);
  const sliceGenerator = d3.pie().value(d => d.value);
  const arcData = sliceGenerator(data);
  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);

  const svg = d3.select('svg#projects-pie-plot');
  svg.selectAll('path').remove();

  arcData.forEach((d, i) => {
    svg.append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', colors(i))
      .attr('class', selectedIndex === i ? 'selected' : '')
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
        updateSelection(data, arcData, arcGenerator, colors, projectList);
      });
  });

  const legend = d3.select('.legend');
  legend.selectAll('li').remove();

  data.forEach((d, i) => {
    legend.append('li')
      .attr('style', `--color: ${colors(i)}`)
      .attr('class', selectedIndex === i ? 'selected' : '')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
        updateSelection(data, arcData, arcGenerator, colors, projectList);
      });
  });
}

function updateSelection(data, arcData, arcGenerator, colors, fullProjectList) {
  const svg = d3.select('svg#projects-pie-plot');
  const legend = d3.select('.legend');

  svg.selectAll('path').remove();
  arcData.forEach((d, i) => {
    svg.append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', colors(i))
      .attr('class', selectedIndex === i ? 'selected' : '')
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;
        updateSelection(data, arcData, arcGenerator, colors, fullProjectList);
      });
  });

  legend.selectAll('li').attr('class', (_, i) => (selectedIndex === i ? 'selected' : ''));

  const visibleProjects = (selectedIndex === -1)
    ? filterProjects(fullProjectList, query)
    : filterProjects(
        fullProjectList.filter(p => p.year === data[selectedIndex].label),
        query
      );

  renderProjects(visibleProjects, projectsContainer, 'h2');
}
