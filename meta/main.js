import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let data = [];
let xScale;
let activeIndex = -1;

async function loadData() {
  const raw = await d3.csv('./loc.csv', (row) => ({
    commit: row.commit,
    url: 'https://github.com/rohanraval2', // change if needed
    author: row.author,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    file: row.file,
    language: row.language
  }));

  data = raw.sort((a, b) => d3.ascending(a.datetime, b.datetime));
  init();
}

function init() {
  drawChart();
  generateCommitItems();
  setupScrollSync();
  setupSliderSync();
  drawPie();
  updateLanguageBreakdown();
  updateFiles(data[data.length - 1]);
}

function drawChart() {
  const svg = d3.select("#chart").append("svg")
    .attr("width", "100%")
    .attr("height", 500);

  const width = document.querySelector("#chart").clientWidth;
  const height = 500;

  xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.datetime))
    .range([50, width - 50]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.line)])
    .range([height - 50, 50]);

  svg.append("g")
    .attr("transform", `translate(0, ${height - 50})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(50, 0)`)
    .call(d3.axisLeft(yScale));

  svg.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.line))
    .attr("r", 5)
    .attr("fill", "#e04080")
    .attr("class", "commit-point")
    .on("mouseover", (event, d) => {
      const tooltip = document.getElementById('commit-tooltip');
      document.getElementById('commit-link').href = d.url;
      document.getElementById('commit-link').textContent = d.commit;
      document.getElementById('commit-date').textContent = d.datetime.toLocaleString();
      tooltip.style.left = `${event.pageX + 10}px`;
      tooltip.style.top = `${event.pageY + 10}px`;
      tooltip.hidden = false;
    })
    .on("mouseout", () => {
      document.getElementById('commit-tooltip').hidden = true;
    });
}

function generateCommitItems() {
  const container = document.getElementById('items-container');
  container.innerHTML = '';

  data.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.dataset.index = i;

    const dateStr = d.datetime.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: 'numeric', minute: 'numeric'
    });

    item.innerHTML = `
      On ${dateStr}, I made <a href="${d.url}" target="_blank">another glorious commit</a>.
      I edited ${d.line} lines across ${d.depth} files.
    `;

    container.appendChild(item);
  });
}

function setupScrollSync() {
  const container = document.getElementById('scroll-container');
  const items = Array.from(document.querySelectorAll('#items-container .item'));

  container.addEventListener('scroll', () => {
    const scrollTop = container.scrollTop;
    const containerHeight = container.scrollHeight - container.clientHeight;
    const scrollRatio = scrollTop / containerHeight;

    const index = Math.round(scrollRatio * (data.length - 1));
    updateActiveCommit(index);
    updateSlider(index);
  });
}

function setupSliderSync() {
  const slider = document.getElementById('commit-slider');
  slider.max = data.length - 1;

  slider.addEventListener('input', () => {
    const index = +slider.value;
    updateActiveCommit(index);
    scrollToCommit(index);
  });
}

function updateActiveCommit(index) {
  if (index === activeIndex) return;

  document.querySelectorAll('#items-container .item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  d3.selectAll("#chart circle")
    .attr("fill", (d, i) => i === index ? "#ff6b6b" : "#e04080")
    .attr("r", (d, i) => i === index ? 8 : 5);

  const selectedTime = document.getElementById('selectedTime');
  selectedTime.textContent = data[index]?.datetime.toLocaleString();

  updateLanguageBreakdown(data[index]);
  updateFiles(data[index]);

  activeIndex = index;
}

function updateSlider(index) {
  document.getElementById('commit-slider').value = index;
}

function scrollToCommit(index) {
  const target = document.querySelector(`#items-container .item[data-index="${index}"]`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateLanguageBreakdown(commit = data[data.length - 1]) {
  const breakdown = d3.rollup(
    data.filter(d => d.commit === commit.commit),
    v => d3.sum(v, d => d.line),
    d => d.language
  );

  const dl = document.getElementById('language-breakdown');
  dl.innerHTML = '';
  breakdown.forEach((value, key) => {
    const dt = document.createElement('dt');
    dt.textContent = key;
    const dd = document.createElement('dd');
    dd.textContent = `${value} lines`;
    dl.appendChild(dt);
    dl.appendChild(dd);
  });

  dl.hidden = false;
}

function updateFiles(commit = data[data.length - 1]) {
  const container = document.querySelector('.files');
  container.innerHTML = '';

  Array.from({ length: commit.length }).forEach(() => {
    const dot = document.createElement('div');
    dot.className = 'line';
    dot.style.background = '#e04080';
    container.appendChild(dot);
  });
}

function drawPie() {
  const breakdown = d3.rollup(
    data,
    v => d3.sum(v, d => d.line),
    d => d.file
  );

  const pieData = Array.from(breakdown, ([file, lines]) => ({ file, lines }));

  const width = 300;
  const height = 300;
  const radius = Math.min(width, height) / 2;

  const pie = d3.pie()
    .value(d => d.lines);

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(radius - 10);

  const svg = d3.select("#projects-pie-plot").append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${width / 2}, ${height / 2})`);

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  const arcs = svg.selectAll("arc")
    .data(pie(pieData))
    .enter()
    .append("g");

  arcs.append("path")
    .attr("d", arc)
    .attr("fill", d => color(d.data.file));

  arcs.append("title")
    .text(d => `${d.data.file}: ${d.data.lines} lines`);
}

loadData();
