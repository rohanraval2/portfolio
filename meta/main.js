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

        Object.defineProperty(commitObj, 'lines', {
            value: lines,
            enumerable: false,
        });

        return commitObj;
    });
}

function renderCommitInfo(data, commits) {
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    dl.append('div').attr('class', 'stat').html(`
        <dt>Total <abbr title="Lines of Code">LOC</abbr></dt>
        <dd>${data.length}</dd>
    `);

    dl.append('div').attr('class', 'stat').html(`
        <dt>Commits</dt>
        <dd>${commits.length}</dd>
    `);

    const numFiles = d3.group(data, d => d.file).size;
    dl.append('div').attr('class', 'stat').html(`
        <dt>Files</dt>
        <dd>${numFiles}</dd>
    `);

    const fileLengths = d3.rollups(data, v => d3.max(v, d => d.line), d => d.file);
    const avgFileLength = d3.mean(fileLengths, d => d[1]);
    dl.append('div').attr('class', 'stat').html(`
        <dt>Avg File Lines</dt>
        <dd>${Math.round(avgFileLength)}</dd>
    `);

    const workByPeriod = d3.rollups(data, v => v.length, d =>
        new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' })
    );
    const maxPeriod = d3.greatest(workByPeriod, d => d[1])?.[0]?.split(' ').pop();
    dl.append('div').attr('class', 'stat').html(`
        <dt>Active Time</dt>
        <dd>${maxPeriod.charAt(0).toUpperCase() + maxPeriod.slice(1)}</dd>
    `);

    const dayOfWeek = d3.rollups(data, v => v.length, d =>
        new Date(d.datetime).toLocaleString('en', { weekday: 'long' })
    );
    const topDay = d3.greatest(dayOfWeek, d => d[1])?.[0];
    dl.append('div').attr('class', 'stat').html(`
        <dt>Top Day</dt>
        <dd>${topDay}</dd>
    `);
}

function renderTooltipContent(commit) {
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

function renderScatterPlot(data, commits) {
    const width = 1000, height = 600;
    const margin = { top: 10, right: 10, bottom: 30, left: 40 };
    const usableArea = {
        left: margin.left,
        right: width - margin.right,
        top: margin.top,
        bottom: height - margin.bottom,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    const svg = d3.select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    xScale = d3.scaleTime()
        .domain(d3.extent(commits, d => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

    yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

    const rScale = d3.scaleSqrt()
        .domain(d3.extent(commits, d => d.totalLines))
        .range([5, 40]);

    svg.append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

    svg.append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(d3.axisBottom(xScale));

    svg.append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(d3.axisLeft(yScale).tickFormat(d => `${d % 24}:00`));

    const getColor = hour => {
        if (hour >= 5 && hour < 12) return '#f4a261';  // Morning
        if (hour >= 12 && hour < 17) return '#e76f51'; // Afternoon
        if (hour >= 17 && hour < 21) return '#2a9d8f'; // Evening
        return '#264653';                              // Night
    };

    const dots = svg.append('g').attr('class', 'dots');

    dots.selectAll('circle')
        .data(d3.sort(commits, d => -d.totalLines))
        .join('circle')
        .attr('cx', d => xScale(d.datetime))
        .attr('cy', d => yScale(d.hourFrac))
        .attr('r', d => rScale(d.totalLines))
        .attr('fill', d => getColor(d.hourFrac))
        .attr('fill-opacity', 0.7)
        .on('mouseenter', (event, d) => {
            renderTooltipContent(d);
            updateTooltipPosition(event);
            updateTooltipVisibility(true);
        })
        .on('mousemove', updateTooltipPosition)
        .on('mouseleave', () => updateTooltipVisibility(false));

    svg.call(d3.brush().on('start brush end', (event) => {
        const sel = event.selection;
        d3.selectAll('circle').classed('selected', d => isCommitSelected(sel, d));
        renderSelectionCount(sel, commits);
        renderLanguageBreakdown(sel, commits);
    }));
    svg.selectAll('.dots, .overlay ~ *').raise();
}

function isCommitSelected(sel, commit) {
    if (!sel) return false;
    const [x0, x1] = sel.map(d => d[0]);
    const [y0, y1] = sel.map(d => d[1]);
    const cx = xScale(commit.datetime), cy = yScale(commit.hourFrac);
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
}

function renderSelectionCount(selection, commits) {
    const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
    document.getElementById('selection-count').textContent = `${selected.length || 'No'} commits selected`;
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
                <dt>${lang}</dt>
                <dd>${count} lines<br>(${pct})</dd>
            </div>
        `;
    }
}

// ✅ MAIN EXECUTION
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
