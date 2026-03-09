/**
 * Panel - side panel rendering for overview and drill-down
 */
const Panel = (function () {
  const contentEl = () => document.getElementById('panel-content');
  const titleEl = () => document.getElementById('panel-title');
  const backBtn = () => document.getElementById('back-btn');

  let sortColumn = null;
  let sortAsc = true;

  function fmt(n) {
    return Number(n).toLocaleString();
  }

  function fmtCurrency(n) {
    return '$' + Number(n).toLocaleString();
  }

  function showLoading() {
    contentEl().innerHTML = `
      <div id="loading-spinner">
        <div class="spinner"></div>
        <p>Loading data...</p>
      </div>
    `;
  }

  function showOverview(zip3Summary, zip5Details) {
    titleEl().textContent = 'California ZIP Code Explorer';
    backBtn().classList.add('hidden');

    let totalPop = 0;
    let totalZips = 0;
    let totalIncome = 0;
    let regionCount = 0;

    for (const [, s] of zip3Summary) {
      totalPop += s.totalPopulation;
      totalZips += s.zipCount;
      totalIncome += s.avgMedianIncome;
      regionCount++;
    }

    const avgIncome = regionCount > 0 ? Math.round(totalIncome / regionCount) : 0;

    contentEl().innerHTML = `
      <div class="overview-stats">
        <div class="stat-card">
          <div class="stat-label">3-Digit ZIP Regions</div>
          <div class="stat-value">${fmt(regionCount)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total ZIP Codes</div>
          <div class="stat-value">${fmt(totalZips)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Population</div>
          <div class="stat-value">${fmt(totalPop)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Median Household Income</div>
          <div class="stat-value">${fmtCurrency(avgIncome)}</div>
        </div>
      </div>
      <div class="instructions">
        Click any colored region on the map to explore its ZIP codes.
        Use the toggle in the top-right to switch between Population and Income views.
      </div>
    `;
  }

  function showDrillDown(zip3, zip3Summary, zip5Details, onBack) {
    const summary = zip3Summary.get(zip3);
    const regionName = summary ? summary.towns.slice(0, 2).join(', ') : '';

    titleEl().textContent = `Region ${zip3}`;
    if (regionName) {
      titleEl().textContent += ` - ${regionName}`;
    }

    backBtn().classList.remove('hidden');
    backBtn().onclick = onBack;

    // Gather all 5-digit ZIPs in this region
    const zips = [];
    for (const [code, detail] of zip5Details) {
      if (detail.zip3 === zip3 || code.startsWith(zip3)) {
        zips.push(detail);
      }
    }

    const totalPop = zips.reduce((sum, z) => sum + z.population, 0);
    const avgInc = zips.length > 0
      ? Math.round(zips.reduce((sum, z) => sum + z.income, 0) / zips.length)
      : 0;

    sortColumn = null;
    sortAsc = true;

    contentEl().innerHTML = `
      <div class="region-summary">
        <div class="stat-card">
          <div class="stat-label">ZIP Codes</div>
          <div class="stat-value">${fmt(zips.length)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Population</div>
          <div class="stat-value">${fmt(totalPop)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Avg Median Income</div>
          <div class="stat-value">${fmtCurrency(avgInc)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Primary County</div>
          <div class="stat-value" style="font-size:14px">${getMostCommon(zips.map(z => z.county))}</div>
        </div>
      </div>
      <div class="zip-table-container">
        <table class="zip-table" id="zip-detail-table">
          <thead>
            <tr>
              <th data-col="zip">ZIP</th>
              <th data-col="town">Town</th>
              <th data-col="county">County</th>
              <th data-col="population" class="num">Population</th>
              <th data-col="income" class="num">Income</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;

    renderTableRows(zips);

    // Add sort handlers
    contentEl().querySelectorAll('.zip-table th').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortColumn === col) {
          sortAsc = !sortAsc;
        } else {
          sortColumn = col;
          sortAsc = true;
        }

        contentEl().querySelectorAll('.zip-table th').forEach((h) => {
          h.classList.remove('sorted-asc', 'sorted-desc');
        });
        th.classList.add(sortAsc ? 'sorted-asc' : 'sorted-desc');

        const sorted = [...zips].sort((a, b) => {
          let va = a[col];
          let vb = b[col];
          if (typeof va === 'string') {
            va = va.toLowerCase();
            vb = (vb || '').toLowerCase();
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
          }
          return sortAsc ? va - vb : vb - va;
        });
        renderTableRows(sorted);
      });
    });
  }

  function renderTableRows(zips) {
    const tbody = document.querySelector('#zip-detail-table tbody');
    if (!tbody) return;

    tbody.innerHTML = zips
      .map(
        (z) => `
        <tr>
          <td>${z.zip}</td>
          <td>${z.town}</td>
          <td>${z.county}</td>
          <td class="num">${fmt(z.population)}</td>
          <td class="num">${fmtCurrency(z.income)}</td>
        </tr>
      `
      )
      .join('');
  }

  function getMostCommon(arr) {
    const counts = {};
    let maxCount = 0;
    let maxItem = '';
    for (const item of arr) {
      if (!item) continue;
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] > maxCount) {
        maxCount = counts[item];
        maxItem = item;
      }
    }
    return maxItem;
  }

  return { showLoading, showOverview, showDrillDown };
})();
