/**
 * Main app - map initialization, layer management, interactions
 */
(function () {
  let map;
  let outlineLayer;
  let zip3Layer;
  let zip5Layer;
  let zip3LabelLayer;
  let legend;
  let data;

  const CA_CENTER = [37.2, -119.5];
  const CA_ZOOM = 6;

  async function init() {
    Panel.showLoading();

    // Initialize map
    map = L.map('map', {
      center: CA_CENTER,
      zoom: CA_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 18,
    }).addTo(map);

    // Load data
    try {
      data = await DataLoader.loadAll();
    } catch (err) {
      document.getElementById('panel-content').innerHTML = `
        <div style="color:#c0392b; padding:20px;">
          <h3>Error Loading Data</h3>
          <p>${err.message}</p>
          <p style="margin-top:12px; font-size:13px; color:#666;">
            Make sure <code>data/zip-data.csv</code> exists and the app is served via HTTP
            (not opened directly as a file). Run: <code>python3 -m http.server</code>
          </p>
        </div>
      `;
      console.error('Data load error:', err);
      return;
    }

    // California outline (always visible, with light fill for empty areas)
    outlineLayer = L.geoJSON(data.caOutline, {
      style: {
        fill: true,
        fillColor: '#f0ede6',
        fillOpacity: 0.6,
        weight: 2,
        color: '#888',
        opacity: 0.6,
      },
      interactive: false,
    }).addTo(map);

    // Compute initial choropleth scale
    Choropleth.computeScale(data.zip3GeoJSON, 'population');

    // ZIP3 choropleth layer
    zip3Layer = L.geoJSON(data.zip3GeoJSON, {
      style: Choropleth.regionStyle,
      onEachFeature: onEachZip3Feature,
    }).addTo(map);

    // ZIP3 labels
    addZip3Labels();

    // Legend
    legend = Choropleth.createLegend(map);
    legend.addTo(map);

    // Toggle control
    const toggle = Choropleth.createToggle(map, onMetricChange);
    toggle.addTo(map);

    // Fit bounds to California
    map.fitBounds(zip3Layer.getBounds(), { padding: [20, 20] });

    // Show overview panel
    Panel.showOverview(data.zip3Summary, data.zip5Details);
  }

  function addZip3Labels() {
    zip3LabelLayer = L.layerGroup();
    zip3Layer.eachLayer(function (layer) {
      const zip3 = layer.feature.properties.ZIP3;
      const center = layer.getBounds().getCenter();
      const label = L.divIcon({
        className: 'zip3-label',
        html: '<span>' + zip3 + '</span>',
        iconSize: [40, 20],
        iconAnchor: [20, 10],
      });
      L.marker(center, { icon: label, interactive: false }).addTo(zip3LabelLayer);
    });
    zip3LabelLayer.addTo(map);
  }

  function onEachZip3Feature(feature, layer) {
    const zip3 = feature.properties.ZIP3;
    const prop = Choropleth.getPropertyName();
    const value = feature.properties[prop];

    layer.bindTooltip(
      `<div class="region-tooltip">
        <strong>${zip3}</strong> - ${feature.properties.topTowns || 'Region ' + zip3}<br/>
        ${Choropleth.formatValue(value)}
      </div>`,
      { sticky: true }
    );

    layer.on({
      mouseover: function (e) {
        e.target.setStyle(Choropleth.highlightStyle());
        e.target.bringToFront();
        if (outlineLayer) outlineLayer.bringToFront();
      },
      mouseout: function (e) {
        Choropleth.resetStyle(e.target);
        e.target.closeTooltip();
      },
      click: function () {
        drillDown(zip3, layer);
      },
    });
  }

  function drillDown(zip3, clickedLayer) {
    // Hide ZIP3 labels
    if (zip3LabelLayer) map.removeLayer(zip3LabelLayer);

    // Remove ZIP3 layer interactions temporarily
    zip3Layer.eachLayer(function (layer) {
      layer.setStyle({
        fillOpacity: 0.2,
        weight: 0.5,
        color: '#ccc',
      });
      layer.off('mouseover mouseout');
      layer.unbindTooltip();
    });

    // Highlight the clicked region
    if (clickedLayer) {
      clickedLayer.setStyle({
        fillOpacity: 0.3,
        weight: 3,
        color: '#333',
        fillColor: '#4a90d9',
      });
      clickedLayer.bringToFront();
    }

    // Show ZIP5 boundaries for this region
    const zip5Features = {
      type: 'FeatureCollection',
      features: data.zip5GeoJSON.features.filter((f) => {
        const zcta = f.properties.ZCTA5CE10 || f.properties.ZCTA5CE20 || '';
        return zcta.substring(0, 3) === zip3;
      }),
    };

    // Inject individual ZIP data into ZIP5 features
    for (const feature of zip5Features.features) {
      const zcta = feature.properties.ZCTA5CE10 || feature.properties.ZCTA5CE20 || '';
      const detail = data.zip5Details.get(zcta);
      if (detail) {
        feature.properties.totalPopulation = detail.population;
        feature.properties.avgMedianIncome = detail.income;
        feature.properties.town = detail.town;
        feature.properties.county = detail.county;
      }
    }

    zip5Layer = L.geoJSON(zip5Features, {
      style: function (feature) {
        const prop = Choropleth.getPropertyName();
        const value = feature.properties[prop];
        return {
          fillColor: Choropleth.getColor(value),
          weight: 1,
          opacity: 1,
          color: '#fff',
          fillOpacity: 0.7,
        };
      },
      onEachFeature: function (feature, layer) {
        const zcta = feature.properties.ZCTA5CE10 || feature.properties.ZCTA5CE20 || '';
        const detail = data.zip5Details.get(zcta);
        if (detail) {
          layer.bindTooltip(
            `<div class="region-tooltip">
              <strong>${zcta}</strong> - ${detail.town}<br/>
              Pop: ${Number(detail.population).toLocaleString()}<br/>
              Income: $${Number(detail.income).toLocaleString()}
            </div>`,
            { sticky: true }
          );
        }

        layer.on({
          mouseover: function (e) {
            e.target.setStyle({ weight: 2.5, color: '#333', fillOpacity: 0.9 });
            e.target.bringToFront();
          },
          mouseout: function (e) {
            zip5Layer.resetStyle(e.target);
          },
        });
      },
    }).addTo(map);

    // Zoom to region
    if (zip5Layer.getLayers().length > 0) {
      map.fitBounds(zip5Layer.getBounds(), { padding: [40, 40] });
    } else if (clickedLayer) {
      map.fitBounds(clickedLayer.getBounds(), { padding: [40, 40] });
    }

    // Bring outline to front
    if (outlineLayer) outlineLayer.bringToFront();

    // Update panel
    Panel.showDrillDown(zip3, data.zip3Summary, data.zip5Details, resetToStateView);
  }

  function resetToStateView() {
    // Remove ZIP5 layer
    if (zip5Layer) {
      map.removeLayer(zip5Layer);
      zip5Layer = null;
    }

    // Restore ZIP3 layer
    zip3Layer.eachLayer(function (layer) {
      Choropleth.resetStyle(layer);

      // Re-add event handlers
      const feature = layer.feature;
      const zip3 = feature.properties.ZIP3;
      const prop = Choropleth.getPropertyName();
      const value = feature.properties[prop];

      layer.bindTooltip(
        `<div class="region-tooltip">
          <strong>${zip3}</strong> - ${feature.properties.topTowns || 'Region ' + zip3}<br/>
          ${Choropleth.formatValue(value)}
        </div>`,
        { sticky: true }
      );

      layer.on({
        mouseover: function (e) {
          e.target.setStyle(Choropleth.highlightStyle());
          e.target.bringToFront();
          if (outlineLayer) outlineLayer.bringToFront();
        },
        mouseout: function (e) {
          Choropleth.resetStyle(e.target);
          e.target.closeTooltip();
        },
        click: function () {
          drillDown(zip3, layer);
        },
      });
    });

    // Reset zoom
    map.fitBounds(zip3Layer.getBounds(), { padding: [20, 20] });

    // Show ZIP3 labels again
    if (zip3LabelLayer) zip3LabelLayer.addTo(map);

    // Bring outline to front
    if (outlineLayer) outlineLayer.bringToFront();

    // Update panel
    Panel.showOverview(data.zip3Summary, data.zip5Details);
  }

  function onMetricChange(metric) {
    if (metric !== 'outline') {
      Choropleth.computeScale(data.zip3GeoJSON, metric);
    }

    // Show/hide legend based on mode
    if (metric === 'outline') {
      if (legend._container) legend._container.style.display = 'none';
    } else {
      if (legend._container) legend._container.style.display = '';
      legend.update();
    }

    if (zip5Layer) {
      // In drill-down mode - restyle ZIP5 layer
      zip5Layer.eachLayer(function (layer) {
        if (metric === 'outline') {
          layer.setStyle({ fillColor: '#fff', fillOpacity: 0.3, color: '#333', weight: 1 });
        } else {
          const prop = Choropleth.getPropertyName();
          const value = layer.feature.properties[prop];
          layer.setStyle({
            fillColor: Choropleth.getColor(value),
            fillOpacity: 0.7,
            color: '#fff',
            weight: 1,
          });
        }
      });
    } else {
      // In state view - restyle ZIP3 layer and update tooltips
      zip3Layer.eachLayer(function (layer) {
        Choropleth.resetStyle(layer);

        const feature = layer.feature;
        const zip3 = feature.properties.ZIP3;

        layer.unbindTooltip();
        if (metric === 'outline') {
          layer.bindTooltip(
            `<div class="region-tooltip">
              <strong>${zip3}</strong> - ${feature.properties.topTowns || 'Region ' + zip3}
            </div>`,
            { sticky: true }
          );
        } else {
          const prop = Choropleth.getPropertyName();
          const value = feature.properties[prop];
          layer.bindTooltip(
            `<div class="region-tooltip">
              <strong>${zip3}</strong> - ${feature.properties.topTowns || 'Region ' + zip3}<br/>
              ${Choropleth.formatValue(value)}
            </div>`,
            { sticky: true }
          );
        }
      });
    }
  }

  // Start the app
  document.addEventListener('DOMContentLoaded', init);
})();
