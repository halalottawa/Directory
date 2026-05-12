#!/bin/bash
npx tsx geocode_all.ts > geocode2.log 2>&1 &
echo "Started geocoding loop in background."
