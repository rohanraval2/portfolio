import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    datetime: new Date(row.datetime),
  }));
  return data;
}

function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const first = lines[0];
    let obj = {
      id: commit,
      url: 'https://github.com/vis-society/lab-7/commit/' + commit,
      author: first.author,
      datetime: new Date(first.datetime),
      hourFrac: first.datetime.getHours() + first.datetime.getMinutes() / 60,
      totalLines: lines.length,
    };
    Object.defineProperty(obj, 'lines', { value: lines });
    return obj;
  });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);
}

function renderTooltipContent(commit) {
  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent = commit.datetime.toLocaleString();
}

function updateTooltipVisibility(v) {
  document.getElementById('commit-tooltip').hidden = !v;
}

function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  tip.style.left = `${event.clientX}px`;
  tip.style.top = `${event.clientY}px`;
}

function renderScatterPlot(data, commits) {
  const width = 1000, height = 600, margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usableArea = {
    left: margin.left,
    top: margin.top,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
    right: width - margin.right,
    bottom: height - margin.bottom,
  };

  const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  const yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Gridlines
  svg.append("g")
    .attr("class", "gridlines")
    .attr("transform", `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));

  const dots = svg.append('g').attr('class', 'dots');

  dots.selectAll("circle")
    .data(commits.sort((a, b) => b.totalLines - a.totalLines))
    .join("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.hourFrac))
    .attr("r", d => rScale(d.totalLines))
    .style("fill", "steelblue")
    .style("fill-opacity", 0.7)
    .on("mouseenter", (event, d) => {
      renderTooltipContent(d);
      updateTooltipPosition(event);
      updateTooltipVisibility(true);
      d3.select(event.currentTarget).style("fill-opacity", 1);
    })
    .on("mouseleave", (event) => {
      updateTooltipVisibility(false);
      d3.select(event.currentTarget).style("fill-opacity", 0.7);
    });

  // Axes
  svg.append("g").attr("transform", `translate(0,${usableArea.bottom})`).call(d3.axisBottom(xScale));
  svg.append("g").attr("transform", `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, '0') + ":00"));

  // Brush with scoped commits
  svg.call(d3.brush().on("start brush end", brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();

  function isCommitSelected(sel, commit) {
    if (!sel) return false;
    const [x0, y0] = sel[0], [x1, y1] = sel[1];
    const cx = xScale(commit.datetime), cy = yScale(commit.hourFrac);
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
  }

  function brushed(event) {
    const selection = event.selection;
    d3.selectAll("circle").classed("selected", d => isCommitSelected(selection, d));
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  function renderSelectionCount(selection) {
    const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
    document.getElementById("selection-count").textContent =
      `${selected.length || 'No'} commits selected`;
  }

  function renderLanguageBreakdown(selection) {
    const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : commits;
    const lines = selected.flatMap(d => d.lines);
    const breakdown = d3.rollup(lines, v => v.length, d => d.type);
    const container = document.getElementById("language-breakdown");
    container.innerHTML = '';
    for (const [lang, count] of breakdown) {
      const percent = d3.format('.1~%')(count / lines.length);
      container.innerHTML += `<dt>${lang}</dt><dd>${count} lines (${percent})</dd>`;
    }
  }
}

const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
