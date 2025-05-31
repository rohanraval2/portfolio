import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// Global variables for scales and data
let xScale, yScale;
let commits;
let commitProgress = 100;
let timeScale;
let commitMaxTime;
let filteredCommits;

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
      ...row,
      line: Number(row.line),
      depth: Number(row.depth),
      length: Number(row.length),
      date: new Date(row.date + 'T00:00' + row.timezone),
      datetime: new Date(row.datetime),
    }));
  
    return data;
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d)
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, y0] = selection[0];
  const [x1, y1] = selection[1];
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  if (countElement) {
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  }

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');
  
  if (!container) return;

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);

  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  // Update DOM with breakdown
  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
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

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: false,
        writable: false,
        enumerable: false
      });

      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime); // Sort by datetime ascending
}

function renderCommitInfo(data, commits) {
  // Create the dl element
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
  // Add total LOC
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);
  
  // Add total commits
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);
  
  // Calculate number of unique files
  const uniqueFiles = new Set(data.map(d => d.file)).size;
  dl.append('dt').text('Number of files');
  dl.append('dd').text(uniqueFiles);
  
  // Calculate maximum file length (in lines)
  const fileLineCounts = d3.rollup(data, v => v.length, d => d.file);
  const maxFileLines = d3.max(Array.from(fileLineCounts.values()));
  dl.append('dt').text('Max file length');
  dl.append('dd').text(maxFileLines);
  
  // Calculate longest line length
  const maxLineLength = d3.max(data, d => d.length);
  dl.append('dt').text('Longest line');
  dl.append('dd').text(maxLineLength);
  
  // Calculate maximum depth
  const maxDepth = d3.max(data, d => d.depth);
  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(maxDepth);
  
  // Calculate time of day most work is done
  const hourCounts = d3.rollup(commits, v => v.length, d => Math.floor(d.hourFrac));
  const busyHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  const timeOfDay = busyHour < 12 ? 'morning' : busyHour < 17 ? 'afternoon' : busyHour < 21 ? 'evening' : 'night';
  dl.append('dt').text('Most active time');
  dl.append('dd').text(timeOfDay);
}

// Function to render tooltip content
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  
  // Add additional elements if present in HTML
  const time = document.getElementById('commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');
  
  if (time) time.textContent = commit.time;
  if (author) author.textContent = commit.author;
  if (lines) lines.textContent = commit.totalLines;
}

// Function to update tooltip visibility
function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  
  if (isVisible) {
    tooltip.classList.add('visible');
    tooltip.hidden = false;
  } else {
    tooltip.classList.remove('visible');
    // Use a timeout to allow the CSS transition to complete before hiding
    setTimeout(() => {
      if (!tooltip.classList.contains('visible')) {
        tooltip.hidden = true;
      }
    }, 200);
  }
}

// Function to update tooltip position
function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  
  const x = event.pageX || event.clientX;
  const y = event.pageY || event.clientY;
  
  // Position tooltip near the cursor
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function renderScatterPlot(data, commits) {
  const width = 1600;
  const height = 900;
  const margin = { top: 30, right: 30, bottom: 50, left: 50 };
  
  // Calculate usable area first
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  
  // Create SVG container
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // Define scales with proper ranges from the beginning - now assigning to global variables
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);
    
  // Calculate the range of edited lines across all commits
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  
  // Create a square root scale for the radius to ensure area is proportional to line count
  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 20]); // Adjusted range for appropriate dot sizes

  // Add gridlines BEFORE the axes
  const gridlines = svg
  .append('g')
  .attr('class', 'gridlines')
  .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
  .axisLeft(yScale)
  .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  // Add X axis
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  // Add Y axis
  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  // Sort commits by total lines in descending order so smaller dots are drawn on top
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  // Add dots with tooltip event handlers
  const dots = svg.append('g').attr('class', 'dots');
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .style('--r', (d) => rScale(d.totalLines))
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget)
        .style('fill-opacity', 1)
        .attr('stroke', 'var(--color-accent)')
        .attr('stroke-width', 2);
      
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget)
        .style('fill-opacity', 0.7)
        .attr('stroke', 'none');
      
      updateTooltipVisibility(false);
    });
    createBrushSelector(svg);
}

function updateScatterPlot(data, commits) {
  const width = 1600;
  const height = 900;
  const margin = { top: 30, right: 30, bottom: 50, left: 50 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');

  xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  // Clear and update the x-axis
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');

  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  
  const circles = dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id);
    
  // Handle entering circles
  const enteringCircles = circles
    .enter()
    .append('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', 0) // Start with radius 0
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7);
    
  // Handle updating circles (both existing and new)
  circles
    .merge(enteringCircles)
    .transition()
    .duration(200)
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines));
    
  // Handle exiting circles
  circles
    .exit()
    .transition()
    .duration(200)
    .attr('r', 0)
    .remove();
    
  // Add event handlers to all circles
  dots.selectAll('circle')
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget)
        .style('fill-opacity', 1)
        .attr('stroke', 'var(--color-accent)')
        .attr('stroke-width', 2);
      
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget)
        .style('fill-opacity', 0.7)
        .attr('stroke', 'none');
      
      updateTooltipVisibility(false);
    });
}

function updateFileDisplay(filteredCommits) {
  // Get lines from filtered commits and group by file
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length); // Sort by number of lines descending

  // Create color scale for different file types
  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  let filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      // This code only runs when the div is initially rendered
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt').call((dt) => {
            dt.append('code');
            dt.append('small');
          });
          div.append('dd');
        }),
    );

  // Update the file info
  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);

  // Create one div for each line of code
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

function generateStoryContent(commits) {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
        <p class="commit-date">
          On ${d.datetime.toLocaleString('en', {
            dateStyle: 'full',
            timeStyle: 'short',
          })},
          I made <a href="${d.url}" target="_blank" class="commit-link">${
            i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
          }</a>.
        </p>
        <p class="commit-details">
          I edited ${d.totalLines} lines across ${
            d3.rollups(
              d.lines,
              (D) => D.length,
              (d) => d.file,
            ).length
          } files.
        </p>
        <p class="commit-reflection">
          Then I looked over all I had made, and I saw that it was very good.
        </p>
      `,
    );
}

function onStepEnter(response) {
  // Remove active class from all steps
  d3.selectAll('#scatter-story .step').classed('active', false);
  
  // Add active class to current step
  d3.select(response.element).classed('active', true);
  
  // Get the commit data from the element
  const commit = response.element.__data__;
  
  // Update the visualization to show commits up to this point
  commitProgress = timeScale(commit.datetime);
  commitMaxTime = commit.datetime;
  
  // Filter commits up to this point
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  
  // Update visualizations
  updateScatterPlot(null, filteredCommits);
  
  // Update stats
  const statsContainer = document.getElementById('stats');
  statsContainer.innerHTML = '';
  const filteredData = filteredCommits.flatMap(commit => commit.lines);
  renderCommitInfo(filteredData, filteredCommits);
}

function setupScrollytelling() {
  const scroller = scrollama();
  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);
}

function generateFileStoryContent(commits) {
  d3.select('#files-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
        <p class="commit-date">
          After commit ${i + 1} on ${d.datetime.toLocaleString('en', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })},
          the codebase evolved.
        </p>
        <p class="commit-details">
          Files affected: ${
            d3.rollups(
              d.lines,
              (D) => D.length,
              (d) => d.file,
            ).length
          } files with ${d.totalLines} total lines.
        </p>
        <p class="commit-reflection">
          Watch how the file sizes grow and change over time.
        </p>
      `,
    );
}

function onFileStepEnter(response) {
  // Remove active class from all file steps
  d3.selectAll('#files-story .step').classed('active', false);
  
  // Add active class to current step
  d3.select(response.element).classed('active', true);
  
  // Get the commit data from the element
  const commit = response.element.__data__;
  
  // Filter commits up to this point
  const filteredCommits = commits.filter((d) => d.datetime <= commit.datetime);
  
  // Update file visualization
  updateFileDisplay(filteredCommits);
}

function setupFileScrollytelling() {
  const fileScroller = scrollama();
  fileScroller
    .setup({
      container: '#scrolly-2',
      step: '#scrolly-2 .step',
    })
    .onStepEnter(onFileStepEnter);
}

function setupViewToggle() {
  const toggleInputs = document.querySelectorAll('input[name="view"]');
  
  toggleInputs.forEach(input => {
    input.addEventListener('change', (event) => {
      const selectedView = event.target.value;
      
      // Hide all sections
      document.querySelectorAll('.scrolly-section').forEach(section => {
        section.classList.remove('active');
      });
      
      // Show selected section
      if (selectedView === 'commits') {
        document.getElementById('scrolly-1').classList.add('active');
      } else if (selectedView === 'files') {
        document.getElementById('scrolly-2').classList.add('active');
      }
      
      // Trigger scrollama resize to recalculate positions
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    });
  });
}

async function main() {
  const data = await loadData();
  commits = processCommits(data);
  
  // Initialize time scale
  timeScale = d3
      .scaleTime()
      .domain([
          d3.min(commits, (d) => d.datetime),
          d3.max(commits, (d) => d.datetime),
      ])
      .range([0, 100]);
  
  commitMaxTime = timeScale.invert(commitProgress);
  filteredCommits = commits;

  // Initialize the time display
  onTimeSliderChange();

  // Add event listener to the slider
  const slider = document.getElementById('commit-progress');
  if (slider) {
      slider.addEventListener('input', onTimeSliderChange);
  }

  renderScatterPlot(data, commits);
  updateFileDisplay(commits);
  renderCommitInfo(data, commits);
  setupScrollytelling();
  setupFileScrollytelling();
  setupViewToggle();
}

function onTimeSliderChange() {
    // Update progress and max time
    commitProgress = document.getElementById('commit-progress').value;
    commitMaxTime = timeScale.invert(commitProgress);
    
    // Update the time display
    const timeElement = document.getElementById('commit-time');
    if (timeElement) {
        timeElement.textContent = commitMaxTime.toLocaleString('en', {
            dateStyle: 'long',
            timeStyle: 'short'
        });
    }
    
    // Update filtered commits
    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    
    // Update the visualization
    updateScatterPlot(data, filteredCommits);
    updateFileDisplay(filteredCommits);
    renderCommitInfo(data, filteredCommits);
}

main();