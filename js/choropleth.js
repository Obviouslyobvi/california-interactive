/**
 * Choropleth - color scales, styling, and legend
 */
const Choropleth = (function () {
  const SCALES = {
    population: {
      colors: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'],
      label: 'Total Population',
    },
    income: {
      colors: ['#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#99000d'],
      label: 'Avg Median Household Income',
    },
  };

  let currentMetric = 'population';
  let colorScale = null;
  let breaks = [];

  function computeScale(geojson, metric) {
    const prop = metric === 'population' ? 'totalPopulation' : 'avgMedianIncome';
    const values = geojson.features
      .map((f) => f.properties[prop])
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    if (values.length === 0) return;

    const min = values[0];
    const max = values[values.length - 1];

    colorScale = chroma.scale(SCALES[metric].colors).domain([min, max]);

    // Build legend breaks (7 steps)
    const step = (max - min) / 6;
    breaks = [];
    for (let i = 0; i < 7; i++) {
      breaks.push(Math.round(min + step * i));
    }
  }

  function getColor(value) {
    if (!colorScale || !value) return '#ddd';
    return colorScale(value).hex();
  }

  function getPropertyName() {
    return currentMetric === 'population' ? 'totalPopulation' : 'avgMedianIncome';
  }

  function regionStyle(feature) {
    const value = feature.properties[getPropertyName()];
    return {
      fillColor: getColor(value),
      weight: 1.5,
      opacity: 1,
      color: '#fff',
      fillOpacity: 0.75,
    };
  }

  function highlightStyle() {
    return {
      weight: 3,
      color: '#333',
      fillOpacity: 0.9,
    };
  }

  function resetStyle(layer) {
    layer.setStyle(regionStyle(layer.feature));
  }

  function setMetric(metric) {
    currentMetric = metric;
  }

  function getMetric() {
    return currentMetric;
  }

  function formatValue(value) {
    if (currentMetric === 'income') {
      return '$' + Number(value).toLocaleString();
    }
    return Number(value).toLocaleString();
  }

  function createLegend(map) {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'legend');
      updateLegendContent(div);
      return div;
    };

    legend.update = function () {
      if (legend._container) {
        updateLegendContent(legend._container);
      }
    };

    function updateLegendContent(div) {
      const title = SCALES[currentMetric].label;
      let html = `<h4>${title}</h4><div class="legend-scale">`;
      for (let i = breaks.length - 1; i >= 0; i--) {
        const color = getColor(breaks[i]);
        const label = formatValue(breaks[i]);
        html += `<div class="legend-item">
          <span class="legend-color" style="background:${color}"></span>
          <span>${label}</span>
        </div>`;
      }
      html += '</div>';
      div.innerHTML = html;
    }

    return legend;
  }

  function createToggle(map, onChange) {
    const toggle = L.control({ position: 'topright' });

    toggle.onAdd = function () {
      const div = L.DomUtil.create('div', 'metric-toggle');
      div.innerHTML = `
        <button data-metric="population" class="active">Population</button>
        <button data-metric="income">Income</button>
      `;

      L.DomEvent.disableClickPropagation(div);

      div.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          div.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          const metric = btn.dataset.metric;
          setMetric(metric);
          onChange(metric);
        });
      });

      return div;
    };

    return toggle;
  }

  return {
    computeScale,
    getColor,
    getPropertyName,
    regionStyle,
    highlightStyle,
    resetStyle,
    setMetric,
    getMetric,
    formatValue,
    createLegend,
    createToggle,
  };
})();
