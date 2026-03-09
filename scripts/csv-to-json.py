#!/usr/bin/env python3
"""
Convert fiduciaries CSV to JSON with coordinates from zip5 GeoJSON centroids.
Usage: python3 scripts/csv-to-json.py < data/fiduciaries.csv
"""
import json, csv, sys, os

# 1. Load zip5 GeoJSON and compute centroids
script_dir = os.path.dirname(os.path.abspath(__file__))
geo_path = os.path.join(script_dir, '..', 'data', 'ca-zip5-regions.geojson')

with open(geo_path) as f:
    geo = json.load(f)

centroids = {}
for feat in geo['features']:
    props = feat['properties']
    zip_code = props.get('ZCTA5CE10') or props.get('ZCTA5CE20') or ''
    if not zip_code:
        continue
    coords_list = []
    def extract(c):
        if isinstance(c[0], (int, float)):
            coords_list.append(c)
        else:
            for sub in c:
                extract(sub)
    extract(feat['geometry']['coordinates'])
    if not coords_list:
        continue
    avg_lat = sum(c[1] for c in coords_list) / len(coords_list)
    avg_lng = sum(c[0] for c in coords_list) / len(coords_list)
    centroids[zip_code] = (round(avg_lat, 5), round(avg_lng, 5))

print(f"Computed {len(centroids)} zip centroids", file=sys.stderr)

# 2. Parse CSV from stdin
reader = csv.DictReader(sys.stdin)
fiduciaries = []
unmatched = 0

for row in reader:
    last_name = row.get('LastName', '').strip()
    first_name = row.get('FirstName', '').strip()
    email = row.get('Email', '').strip()
    company = row.get('Company', '').strip()
    address = row.get('Address', '').strip()
    city = row.get('City', '').strip()
    state = row.get('State', '').strip()
    postal = row.get('PostalCode', '').strip()
    phone = row.get('Phone3', '') or row.get('Phone2', '') or row.get('Phone1', '')
    phone = (phone or '').strip()
    suite = row.get('Custom9', '').strip()

    # Clean postal code to 5 digits
    zip5 = postal.replace(' ', '').replace('-', ' ').split(' ')[0][:5] if postal else ''
    if not zip5 or len(zip5) < 5:
        continue

    coords = centroids.get(zip5)
    if not coords:
        unmatched += 1
        continue

    full_address = address
    if suite:
        full_address += ' ' + suite

    name = f"{first_name} {last_name}".strip()
    # Clean name - remove trailing commas
    name = name.strip(',').strip()

    fiduciaries.append({
        'name': name,
        'company': company,
        'address': full_address,
        'city': city,
        'state': state,
        'zip': zip5,
        'phone': phone,
        'email': email,
        'lat': coords[0],
        'lng': coords[1],
    })

print(f"Matched: {len(fiduciaries)}, Unmatched: {unmatched}", file=sys.stderr)

# 3. Write output
out_path = os.path.join(script_dir, '..', 'data', 'fiduciaries.json')
with open(out_path, 'w') as f:
    json.dump(fiduciaries, f)
print(f"Written to {out_path}", file=sys.stderr)
