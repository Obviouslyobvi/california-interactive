/**
 * Build fiduciaries.json with coordinates from zip5 GeoJSON centroids
 * Run: node scripts/build-fiduciaries.js
 */
const fs = require('fs');
const path = require('path');

// 1. Compute centroids from zip5 GeoJSON
const geoPath = path.join(__dirname, '..', 'data', 'ca-zip5-regions.geojson');
const geo = JSON.parse(fs.readFileSync(geoPath, 'utf8'));

const centroids = {};
for (const f of geo.features) {
  const zip = f.properties.ZCTA5CE10 || f.properties.ZCTA5CE20 || '';
  if (!zip) continue;

  const coords = [];
  function extract(c) {
    if (typeof c[0] === 'number') { coords.push(c); return; }
    for (const sub of c) extract(sub);
  }
  extract(f.geometry.coordinates);
  if (coords.length === 0) continue;

  let sumLat = 0, sumLng = 0;
  for (const [lng, lat] of coords) { sumLat += lat; sumLng += lng; }
  centroids[zip] = [+(sumLat / coords.length).toFixed(5), +(sumLng / coords.length).toFixed(5)];
}

console.log('Zip centroids computed:', Object.keys(centroids).length);

// 2. Parse fiduciaries CSV
const csvPath = path.join(__dirname, '..', 'data', 'fiduciaries.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');
const lines = csvText.split('\n');

// Simple CSV parser that handles quoted fields
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const headers = parseCSVLine(lines[0]);
const idxLastName = headers.indexOf('LastName');
const idxFirstName = headers.indexOf('FirstName');
const idxEmail = headers.indexOf('Email');
const idxCompany = headers.indexOf('Company');
const idxAddress = headers.indexOf('Address');
const idxCity = headers.indexOf('City');
const idxState = headers.indexOf('State');
const idxPostalCode = headers.indexOf('PostalCode');
const idxPhone1 = headers.indexOf('Phone1');
const idxPhone2 = headers.indexOf('Phone2');
const idxPhone3 = headers.indexOf('Phone3');
const idxCustom5 = headers.indexOf('Custom5');
const idxCustom9 = headers.indexOf('Custom9');

const fiduciaries = [];
const unmatched = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const fields = parseCSVLine(line);
  const lastName = fields[idxLastName] || '';
  const firstName = fields[idxFirstName] || '';
  const email = fields[idxEmail] || '';
  const company = fields[idxCompany] || '';
  const address = fields[idxAddress] || '';
  const city = fields[idxCity] || '';
  const state = fields[idxState] || '';
  const postalCode = fields[idxPostalCode] || '';
  const phone = fields[idxPhone3] || fields[idxPhone2] || fields[idxPhone1] || '';
  const suite = fields[idxCustom9] || '';

  // Clean postal code to 5 digits
  const zip5 = String(postalCode).replace(/\s/g, '').substring(0, 5);
  if (!zip5 || zip5.length < 5) continue;

  // Find coordinates
  const coords = centroids[zip5];
  if (!coords) {
    unmatched.push({ name: firstName + ' ' + lastName, zip: zip5, city });
    continue;
  }

  // Build full address
  let fullAddress = address;
  if (suite) fullAddress += ' ' + suite;

  fiduciaries.push({
    name: (firstName + ' ' + lastName).trim(),
    company: company || '',
    address: fullAddress,
    city,
    state,
    zip: zip5,
    phone,
    email,
    lat: coords[0],
    lng: coords[1],
  });
}

console.log('Fiduciaries with coordinates:', fiduciaries.length);
console.log('Unmatched (no zip centroid):', unmatched.length);
if (unmatched.length > 0) {
  console.log('Unmatched samples:', unmatched.slice(0, 5));
}

// 3. Write output
const outPath = path.join(__dirname, '..', 'data', 'fiduciaries.json');
fs.writeFileSync(outPath, JSON.stringify(fiduciaries, null, 2));
console.log('Written to', outPath);
