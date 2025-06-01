import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let data = [];
let xScale;
let activeIndex = -1;

async function loadData() {
  const raw = await d3.csv('./loc.csv', (row) => ({
    commit: row.commit,
    url: 'https://github.com/rohanraval2', // update as needed
    author: row.author,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
  }));
  data = raw.sort((a, b) => d3.ascending(a.datetime, b.datetime));
  init();
}

function init() {
  drawChart();
  generateCommitItems();
  setupScrollSync();
  setupSliderSync();
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

  // Axes
  svg.append("g")
    .attr("transform", `translate(0, ${height - 50})`)
    .call(d3.axisBottom(xScale));

  svg.append("g")
    .attr("transform", `translate(50, 0)`)
    .call(d3.axisLeft(yScale));

  // Points
  svg.selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.line))
    .attr("r", 5)
    .attr("fill", "#e04080")
    .attr("class", "commit-point");
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

  // Update list
  document.querySelectorAll('#items-container .item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  // Update chart
  d3.selectAll("#chart circle")
    .attr("fill", (d, i) => i === index ? "#ff6b6b" : "#e04080")
    .attr("r", (d, i) => i === index ? 8 : 5);

  // Update slider text
  const selectedTime = document.getElementById('selectedTime');
  selectedTime.textContent = data[index]?.datetime.toLocaleString();

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

loadData();