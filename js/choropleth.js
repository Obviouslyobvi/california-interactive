/**
 * Choropleth - color scales, styling, and legend
 * No external dependencies - uses built-in color interpolation
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
  let scaleColors = [];
  let scaleMin = 0;
  let scaleMax = 1;
  let breaks = [];

  // Parse hex color to [r, g, b]
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Convert [r, g, b] to hex
  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Interpolate across an array of colors given t in [0, 1]
  function interpolateColors(colors, t) {
    t = Math.max(0, Math.min(1, t));
    const n = colors.length - 1;
    const i = Math.min(Math.floor(t * n), n - 1);
    const f = t * n - i;
    const c1 = hexToRgb(colors[i]);
    const c2 = hexToRgb(colors[i + 1]);
    return rgbToHex(
      Math.round(c1[0] + (c2[0] - c1[0]) * f),
      Math.round(c1[1] + (c2[1] - c1[1]) * f),
      Math.round(c1[2] + (c2[2] - c1[2]) * f)
    );
  }

  function computeScale(geojson, metric) {
    const prop = metric === 'population' ? 'totalPopulation' : 'avgMedianIncome';
    const values = geojson.features
      .map((f) => f.properties[prop])
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    if (values.length === 0) return;

    scaleMin = values[0];
    scaleMax = values[values.length - 1];
    scaleColors = SCALES[metric].colors;

    // Build legend breaks (7 steps)
    const step = (scaleMax - scaleMin) / 6;
    breaks = [];
    for (let i = 0; i < 7; i++) {
      breaks.push(Math.round(scaleMin + step * i));
    }
  }

  function getColor(value) {
    if (!scaleColors.length || !value) return '#ddd';
    const t = (value - scaleMin) / (scaleMax - scaleMin);
    return interpolateColors(scaleColors, t);
  }

  function getPropertyName() {
    return currentMetric === 'population' ? 'totalPopulation' : 'avgMedianIncome';
  }

  function regionStyle(feature) {
    if (currentMetric === 'outline') {
      return {
        fillColor: '#d9d9d9',
        weight: 1.5,
        opacity: 1,
        color: '#333',
        fillOpacity: 0.5,
      };
    }
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
        <button data-metric="outline">Outline</button>
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
