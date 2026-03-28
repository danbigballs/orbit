#!/usr/bin/env python3
"""Re-export slim stations.json from pipeline output."""
import json, sys, os

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(_SCRIPT_DIR, "..", "data", "output", "orbit_uk_full.json")
DST = os.path.join(_SCRIPT_DIR, "stations.json")

data = json.load(open(SRC))
stations = []
for s in data["stations"]:
    url = s["url"]
    if url.startswith("http://as-hls-ww-live.akamaized.net"):
        url = url.replace("http://", "https://", 1)
    stations.append({
        "name": s["name"],
        "url": url,
        "lat": s["lat"],
        "lon": s["lon"],
        "codec": s.get("codec", "MP3"),
    })

with open(DST, "w") as f:
    json.dump(stations, f)

print(f"Exported {len(stations)} stations to {DST}")
