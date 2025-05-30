// Fully Merged main.js (Original + Lab 8 Features + Axes + Gridlines)

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let xScale, yScale;

async function loadData() {
  const data = await d3.csv('./loc.csv', (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const first = lines[0];
    const { author, date, time, timezone, datetime } = first;
    const commitObj = {
      id: commit,
      url: 'https://github.com/rohanraval2/portfolio/commit/' + commit,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };
    Object.defineProperty(commitObj, 'lines', { value: lines, enumerable: false });
    return commitObj;
  });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  dl.append('div').attr('class', 'stat').html(`<dt>Total <abbr title="Lines of Code">LOC</abbr></dt><dd>${data.length}</dd>`);
  dl.append('div').attr('class', 'stat').html(`<dt>Commits</dt><dd>${commits.length}</dd>`);
  const numFiles = d3.group(data, d => d.file).size;
  dl.append('div').attr('class', 'stat').html(`<dt>Files</dt><dd>${numFiles}</dd>`);
  const fileLengths = d3.rollups(data, v => d3.max(v, d => d.line), d => d.file);
  const avgFileLength = d3.mean(fileLengths, d => d[1]);
  dl.append('div').attr('class', 'stat').html(`<dt>Avg File Lines</dt><dd>${Math.round(avgFileLength)}</dd>`);
  const workByPeriod = d3.rollups(data, v => v.length, d => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' }));
  const maxPeriod = d3.greatest(workByPeriod, d => d[1])?.[0]?.split(' ').pop();
  dl.append('div').attr('class', 'stat').html(`<dt>Active Time</dt><dd>${maxPeriod}</dd>`);
  const dayOfWeek = d3.rollups(data, v => v.length, d => new Date(d.datetime).toLocaleString('en', { weekday: 'long' }));
  const topDay = d3.greatest(dayOfWeek, d => d[1])?.[0];
  dl.append('div').attr('class', 'stat').html(`<dt>Top Day</dt><dd>${topDay}</dd>`);
}

function updateTooltipContent(commit) {
  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent = commit.datetime.toLocaleString();
}

function updateTooltipVisibility(show) {
  document.getElementById('commit-tooltip').hidden = !show;
}

function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  tip.style.left = `${event.clientX + 10}px`;
  tip.style.top = `${event.clientY + 10}px`;
}

function isCommitSelected(sel, commit) {
  if (!sel) return false;
  const [x0, x1] = sel.map(d => d[0]);
  const [y0, y1] = sel.map(d => d[1]);
  const cx = xScale(commit.datetime), cy = yScale(commit.hourFrac);
  return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
}

function renderLanguageBreakdown(selection, commits) {
  const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
  const container = document.getElementById('language-breakdown');
  container.innerHTML = '';
  if (selected.length === 0) {
    container.setAttribute('hidden', 'true');
    return;
  }
  container.removeAttribute('hidden');
  const lines = selected.flatMap(d => d.lines);
  const breakdown = d3.rollup(lines, v => v.length, d => d.type);
  for (const [lang, count] of breakdown) {
    const pct = d3.format('.1~%')(count / lines.length);
    container.innerHTML += `
      <div class="stat">
        <dt>${lang}</dt><dd>${count} lines<br>(${pct})</dd>
      </div>`;
  }
}

function renderSelectionCount(selection, commits) {
  const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
  document.getElementById('selection-count').textContent = `${selected.length || 'No'} commits selected`;
}

function updateScatterPlot(data) {
  d3.select('#chart svg').remove();

  const svg = d3.select('#chart').append('svg')
    .attr('width', 1000)
    .attr('height', 600)
    .style('overflow', 'visible')
    .style('border', '2px solid #ccc');

  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usable = { left: margin.left, right: 1000 - margin.right, top: margin.top, bottom: 600 - margin.bottom, width: 1000 - margin.left - margin.right, height: 600 - margin.top - margin.bottom };

  xScale = d3.scaleTime().domain(d3.extent(data, d => d.datetime)).range([usable.left, usable.right]);
  yScale = d3.scaleLinear().domain([0, 24]).range([usable.bottom, usable.top]);

  const r = d3.scaleSqrt().domain(d3.extent(data, d => d.totalLines)).range([3, 20]);

  // Add Gridlines
  svg.append('g')
    .attr('class', 'grid y-grid')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(
      d3.axisLeft(yScale)
        .tickSize(-usable.width)
        .tickFormat('')
    )
    .selectAll('line')
    .attr('stroke', '#ccc')
    .attr('stroke-opacity', 0.3)
    .attr('shape-rendering', 'crispEdges');

  // Y Axis
  svg.append('g')
    .attr('transform', `translate(${usable.left}, 0)`)
    .attr('class', 'y-axis')
    .call(d3.axisLeft(yScale).ticks(8).tickFormat(d => `${d}:00`));

  // X Axis
  svg.append('g')
    .attr('transform', `translate(0, ${usable.bottom})`)
    .attr('class', 'x-axis')
    .call(d3.axisBottom(xScale));

  // Circles
  svg.selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => r(d.totalLines))
    .attr('fill', '#e76f51')
    .attr('fill-opacity', 0.7)
    .attr('stroke', '#333')
    .attr('stroke-width', 1)
    .attr('class', 'commit-dot')
    .on('mouseenter', (event, d) => {
      updateTooltipContent(d);
      updateTooltipPosition(event);
      updateTooltipVisibility(true);
    })
    .on('mousemove', updateTooltipPosition)
    .on('mouseleave', () => updateTooltipVisibility(false));

  svg.call(d3.brush().on('start brush end', (event) => {
    const sel = event.selection;
    d3.selectAll('circle').classed('selected', d => isCommitSelected(sel, d));
    renderSelectionCount(sel, data);
    renderLanguageBreakdown(sel, data);
  }));
}

function renderFiles(data) {
  const lines = data.flatMap(d => d.lines);
  const color = d3.scaleOrdinal(d3.schemeTableau10);
  const files = d3.groups(lines, d => d.file).map(([name, lines]) => ({ name, lines }));
  const container = d3.select('.files');
  container.selectAll('*').remove();
  container.selectAll('div')
    .data(files.sort((a, b) => d3.descending(a.lines.length, b.lines.length)))
    .enter()
    .append('div')
    .html(d => `<dt><code>${d.name}</code> <small>${d.lines.length} lines</small></dt>`)
    .append('dd')
    .selectAll('div')
    .data(d => d.lines)
    .enter()
    .append('div')
    .attr('class', 'line')
    .style('background', d => color(d.type));
}

function renderItems(startIndex, commits, visible = 8) {
  const container = d3.select('#items-container');
  container.selectAll('*').remove();
  const visibleCommits = commits.slice(startIndex, startIndex + visible);
  updateScatterPlot(visibleCommits);
  container.selectAll('div')
    .data(visibleCommits)
    .enter()
    .append('div')
    .attr('class', 'item')
    .html((d, i) => `
      <p>On ${d.datetime.toLocaleString('en', { dateStyle: 'full', timeStyle: 'short' })}, I made
      <a href="${d.url}" target="_blank">
      ${i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'}</a>.
      I edited ${d.totalLines} lines across
      ${d3.rollups(d.lines, v => v.length, d => d.file).length} files.</p>`)
    .style('position', 'absolute')
    .style('top', (_, idx) => `${idx * 80}px`);
}

// MAIN
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
updateScatterPlot(commits);
renderFiles(commits);
renderItems(0, commits);

const slider = d3.select('#commit-slider');
slider.on('input', function () {
  const percent = +this.value;
  const timeScale = d3.scaleTime().domain(d3.extent(commits, d => d.datetime)).range([0, 100]);
  const maxTime = timeScale.invert(percent);
  const filtered = commits.filter(d => d.datetime <= maxTime);
  d3.select('#selectedTime').text(maxTime.toLocaleString());
  updateScatterPlot(filtered);
  renderFiles(filtered);
});

const scrollContainer = d3.select('#scroll-container');
const spacer = d3.select('#spacer').style('height', `${(commits.length - 1) * 80}px`);
const itemsContainer = d3.select('#items-container');

scrollContainer.on('scroll', () => {
  const scrollTop = scrollContainer.property('scrollTop');
  let startIndex = Math.floor(scrollTop / 80);
  startIndex = Math.max(0, Math.min(startIndex, commits.length - 8));
  renderItems(startIndex, commits);
});
