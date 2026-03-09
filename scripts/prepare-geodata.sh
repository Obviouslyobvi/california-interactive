#!/bin/bash
# One-time script to generate GeoJSON files from Census ZCTA shapefile
# Requires: npm install -g mapshaper
# Source: https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip
# Alternative: https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ca_california_zip_codes_geo.min.json

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"

echo "=== California ZIP Code GeoJSON Generator ==="

# Option 1: From Census shapefile
if [ -f "cb_2020_us_zcta520_500k.shp" ]; then
  echo "Using Census shapefile..."

  mapshaper-xl 8gb cb_2020_us_zcta520_500k.shp \
    -filter 'ZCTA5CE20.substr(0,1)==="9" && parseInt(ZCTA5CE20)>=90001 && parseInt(ZCTA5CE20)<=96162' \
    -simplify dp 12% keep-shapes \
    -each 'ZIP3=ZCTA5CE20.substr(0,3)' \
    -o format=geojson "$DATA_DIR/ca-zip5-regions.geojson"

  mapshaper "$DATA_DIR/ca-zip5-regions.geojson" \
    -dissolve ZIP3 \
    -o format=geojson "$DATA_DIR/ca-zip3-regions.geojson"

  mapshaper "$DATA_DIR/ca-zip5-regions.geojson" \
    -dissolve \
    -o format=geojson "$DATA_DIR/ca-outline.geojson"

# Option 2: From GitHub GeoJSON (OpenDataDE)
elif [ -f "ca_california_zip_codes_geo.min.json" ]; then
  echo "Using GitHub GeoJSON source..."

  mapshaper-xl 8gb ca_california_zip_codes_geo.min.json \
    -simplify dp 12% keep-shapes \
    -each 'ZIP3=ZCTA5CE10.substr(0,3)' \
    -o format=geojson "$DATA_DIR/ca-zip5-regions.geojson"

  mapshaper "$DATA_DIR/ca-zip5-regions.geojson" \
    -dissolve ZIP3 \
    -o format=geojson "$DATA_DIR/ca-zip3-regions.geojson"

  mapshaper "$DATA_DIR/ca-zip5-regions.geojson" \
    -dissolve \
    -o format=geojson "$DATA_DIR/ca-outline.geojson"

else
  echo "Error: No source shapefile found."
  echo "Download one of:"
  echo "  1. https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip"
  echo "  2. https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/ca_california_zip_codes_geo.min.json"
  exit 1
fi

echo ""
echo "Generated files:"
ls -lh "$DATA_DIR"/*.geojson
echo ""
echo "Done!"
