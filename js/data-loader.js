/**
 * Data loader - handles CSV parsing and GeoJSON loading
 */
const DataLoader = (function () {
  async function fetchJSON(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load ${url}: ${resp.status}`);
    return resp.json();
  }

  function parseCSV(url) {
    return new Promise((resolve, reject) => {
      Papa.parse(url, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err),
      });
    });
  }

  function buildLookups(rows) {
    const zip5Details = new Map();
    const zip3Summary = new Map();

    for (const row of rows) {
      // Try common column name variations
      const zipCode = row['ZIP Code'] || row['Zip Code'] || row['zip_code'] || row['ZIP'] || row['Zip'];
      if (!zipCode) continue;

      const zip = String(zipCode).padStart(5, '0');
      const zip3 = row['ZIP3 Region'] || row['ZIP3'] || zip.substring(0, 3);
      const town = row['Town'] || row['City'] || row['town'] || '';
      const county = row['Primary County'] || row['County'] || row['county'] || '';
      const metro = row['Metro'] || row['metro'] || '';
      const population = row['Total Population'] || row['Total population'] || row['Population'] || row['population'] || 0;
      const income = row['Median Household Income'] || row['Median HH Income'] || row['median_income'] || 0;

      zip5Details.set(zip, {
        zip,
        zip3: String(zip3),
        town,
        metro,
        county,
        population: Number(population) || 0,
        income: Number(income) || 0,
      });

      // Aggregate into ZIP3 summary
      const z3 = String(zip3);
      if (!zip3Summary.has(z3)) {
        zip3Summary.set(z3, {
          zip3: z3,
          totalPopulation: 0,
          totalIncome: 0,
          zipCount: 0,
          towns: [],
        });
      }
      const summary = zip3Summary.get(z3);
      summary.totalPopulation += Number(population) || 0;
      summary.totalIncome += Number(income) || 0;
      summary.zipCount += 1;
      if (town && !summary.towns.includes(town)) {
        summary.towns.push(town);
      }
    }

    // Calculate average income
    for (const [, summary] of zip3Summary) {
      summary.avgMedianIncome = summary.zipCount > 0
        ? Math.round(summary.totalIncome / summary.zipCount)
        : 0;
    }

    return { zip5Details, zip3Summary };
  }

  function injectDataIntoGeoJSON(geojson, zip3Summary) {
    for (const feature of geojson.features) {
      const zip3 = feature.properties.ZIP3;
      const summary = zip3Summary.get(zip3);
      if (summary) {
        feature.properties.totalPopulation = summary.totalPopulation;
        feature.properties.avgMedianIncome = summary.avgMedianIncome;
        feature.properties.zipCount = summary.zipCount;
        feature.properties.topTowns = summary.towns.slice(0, 3).join(', ');
      } else {
        feature.properties.totalPopulation = 0;
        feature.properties.avgMedianIncome = 0;
        feature.properties.zipCount = 0;
        feature.properties.topTowns = '';
      }
    }
  }

  async function loadAll() {
    const [zip3GeoJSON, zip5GeoJSON, caOutline, csvRows, fiduciaries] = await Promise.all([
      fetchJSON('data/ca-zip3-regions.geojson'),
      fetchJSON('data/ca-zip5-regions.geojson'),
      fetchJSON('data/ca-outline.geojson'),
      parseCSV('data/zip-data.csv'),
      fetchJSON('data/fiduciaries.json').catch(() => []),
    ]);

    const { zip5Details, zip3Summary } = buildLookups(csvRows);
    injectDataIntoGeoJSON(zip3GeoJSON, zip3Summary);

    return {
      zip3GeoJSON,
      zip5GeoJSON,
      caOutline,
      zip3Summary,
      zip5Details,
      fiduciaries,
    };
  }

  return { loadAll };
})();
