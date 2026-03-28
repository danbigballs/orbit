// ORBIT V2 — PWA
// Rotate your phone to tune between the 6 nearest radio stations

(function () {
    'use strict';

    // --- State ---
    let stations = [];
    let closestStations = [];
    let currentSegment = -1;
    let lastSegment = -1;
    let skipSet = new Set(); // indices of stations already shown
    let userLat = null;
    let userLon = null;
    let audioEl = null;
    let hls = null;
    let map = null;
    let mapVisible = false;
    let userMarker = null;
    let stationMarkers = [];
    let allStationMarkers = [];
    let radiusCircle = null;
    let connectionLines = [];
    let headingCone = null;
    let currentHeading = 0;
    let listVisible = false;
    let flightMode = false;
    let mapInitialised = false;
    let locked = false;
    let muted = false;

    // --- Constants ---
    const SEGMENT_COUNT = 6;
    const SEGMENT_WIDTH = 360 / SEGMENT_COUNT; // 60 degrees
    const DEAD_ZONE = 5; // degrees on each side of boundary

    // --- DOM refs ---
    const startScreen = document.getElementById('start-screen');
    const tunerScreen = document.getElementById('tuner-screen');
    const startBtn = document.getElementById('start-btn');
    const stationNameEl = document.getElementById('station-name');
    const dialSvg = document.getElementById('dial');
    const gpsStatus = document.getElementById('gps-status');
    const headingDisplay = document.getElementById('heading-display');
    const mapBtn = document.getElementById('map-btn');
    const shakeBtn = document.getElementById('shake-btn');
    const lockBtn = document.getElementById('lock-btn');
    const mapContainer = document.getElementById('map-container');
    const debugEl = document.getElementById('debug');
    const muteBtn = document.getElementById('mute-btn');
    const flightBtn = document.getElementById('flight-btn');
    const listBtn = document.getElementById('list-btn');
    const listContainer = document.getElementById('list-container');
    const listClose = document.getElementById('list-close');
    const listCount = document.getElementById('list-count');
    const stationListEl = document.getElementById('station-list');

    // --- Init ---
    startBtn.addEventListener('click', start);

    function start() {
        startScreen.style.display = 'none';
        tunerScreen.style.display = 'block';
        // Create audio element and unlock on user gesture (iOS requires this)
        audioEl = new Audio();
        audioEl.setAttribute('playsinline', '');
        // Play a silent source to permanently unlock audio playback
        audioEl.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        audioEl.play().then(() => { audioEl.pause(); audioEl.src = ''; }).catch(() => {});
        // Request gyro/motion permissions synchronously in click handler (iOS requires user gesture)
        initGyro();
        loadStations();
    }

    // --- Station Data ---
    async function loadStations() {
        const resp = await fetch('stations.json');
        stations = await resp.json();
        stationNameEl.textContent = `Loaded ${stations.length} stations`;
        initGPS();
        initDial();
        initShake();
    }

    // --- GPS ---
    function initGPS() {
        if (!navigator.geolocation) {
            gpsStatus.textContent = 'GPS: not available';
            return;
        }
        navigator.geolocation.watchPosition(
            (pos) => {
                if (flightMode) return;
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;
                gpsStatus.textContent = `GPS: ${userLat.toFixed(3)}, ${userLon.toFixed(3)}`;
                if (closestStations.length === 0) {
                    loadClosest6();
                }
            },
            (err) => {
                gpsStatus.textContent = `GPS: ${err.message}`;
            },
            { enableHighAccuracy: true, maximumAge: 10000 }
        );
    }

    // --- Haversine ---
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const toRad = (d) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.asin(Math.sqrt(a));
    }

    // --- Find Closest Stations ---
    function loadClosest6() {
        if (userLat === null) return;

        const withDist = stations
            .map((s, i) => ({ station: s, index: i, dist: haversine(userLat, userLon, s.lat, s.lon) }))
            .filter((s) => !skipSet.has(s.index))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, SEGMENT_COUNT);

        if (withDist.length === 0) {
            // Reset skip set and try again
            skipSet.clear();
            loadClosest6();
            return;
        }

        closestStations = withDist.map((s) => s.station);
        withDist.forEach((s) => skipSet.add(s.index));

        currentSegment = -1;
        lastSegment = -1;
        debugEl.textContent = closestStations.map((s, i) => `${i}: ${s.name} (${withDist[i].dist.toFixed(1)}km)`).join('\n');

        if (mapVisible) updateMap();

        // Auto-tune to first station so sound starts immediately
        tuneToSegment(0);
    }

    // --- Load Next 6 (shake replacement) ---
    function loadNext6() {
        if (userLat === null) return;
        if (audioEl) { audioEl.pause(); audioEl.src = ''; }
        if (hls) { hls.destroy(); hls = null; }
        navigator.vibrate && navigator.vibrate([100, 50, 100]);
        loadClosest6();
    }

    function initShake() {
        // On-screen button as fallback (shake detection added below)
        shakeBtn.addEventListener('click', loadNext6);

        // Shake detection via accelerometer
        if (window.DeviceMotionEvent) {
            let shakeThreshold = 25;
            let lastShakeTime = 0;
            let shakeCooldown = 3000; // ms

            window.addEventListener('devicemotion', (e) => {
                const acc = e.accelerationIncludingGravity;
                if (!acc) return;
                const force = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
                const now = Date.now();
                if (force > shakeThreshold && now - lastShakeTime > shakeCooldown) {
                    lastShakeTime = now;
                    loadNext6();
                }
            });
        }
    }

    // --- Gyro / Compass ---
    function initGyro() {
        // iOS requires permission request from user gesture (already inside start button click)
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then((state) => {
                    if (state === 'granted') {
                        window.addEventListener('deviceorientation', handleOrientation);
                    }
                })
                .catch(console.error);
            // Also request motion for shake
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                DeviceMotionEvent.requestPermission().catch(console.error);
            }
        } else {
            window.addEventListener('deviceorientation', handleOrientation);
        }
    }

    // --- Mute ---
    muteBtn.addEventListener('click', () => {
        muted = !muted;
        if (audioEl) audioEl.muted = muted;
        muteBtn.textContent = muted ? '🔇' : '🔊';
        muteBtn.classList.toggle('muted', muted);
    });

    // --- Flight Mode ---
    flightBtn.addEventListener('click', () => {
        flightMode = !flightMode;
        flightBtn.classList.toggle('active', flightMode);
        gpsStatus.textContent = flightMode
            ? `FLY: ${userLat.toFixed(3)}, ${userLon.toFixed(3)}`
            : `GPS: ${userLat.toFixed(3)}, ${userLon.toFixed(3)}`;
    });

    // --- Lock ---
    lockBtn.addEventListener('click', () => {
        locked = !locked;
        lockBtn.textContent = locked ? '🔒' : '🔓';
        lockBtn.classList.toggle('locked', locked);
        navigator.vibrate && navigator.vibrate(30);
    });

    function handleOrientation(e) {
        let heading = e.webkitCompassHeading ?? (360 - (e.alpha || 0));
        if (heading < 0) heading += 360;

        currentHeading = heading;
        headingDisplay.textContent = `${Math.round(heading)}°`;

        if (mapVisible) updateHeadingCone();

        if (locked || closestStations.length === 0) return;

        const segment = getSegmentFromHeading(heading);
        if (segment !== -1 && segment !== currentSegment) {
            currentSegment = segment;
            tuneToSegment(segment);
        }
    }

    function getSegmentFromHeading(heading) {
        const raw = Math.floor(heading / SEGMENT_WIDTH) % SEGMENT_COUNT;

        // Dead zone check: if within DEAD_ZONE degrees of a boundary, keep last segment
        const lowerBound = raw * SEGMENT_WIDTH + DEAD_ZONE;
        const upperBound = (raw + 1) * SEGMENT_WIDTH - DEAD_ZONE;

        if (heading >= lowerBound && heading < upperBound) {
            lastSegment = raw;
            return raw;
        }

        // In dead zone — return last known segment
        return lastSegment;
    }

    // --- Dial UI (SVG circle with 6 segments) ---
    const DIAL_CX = 140, DIAL_CY = 140;
    const DIAL_OUTER = 130, DIAL_INNER = 90;
    const DIAL_GAP = 3; // degrees gap between segments

    function polarToXY(cx, cy, r, angleDeg) {
        const rad = (angleDeg - 90) * Math.PI / 180; // -90 so 0° is top
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function arcPath(startDeg, endDeg) {
        const o1 = polarToXY(DIAL_CX, DIAL_CY, DIAL_OUTER, startDeg);
        const o2 = polarToXY(DIAL_CX, DIAL_CY, DIAL_OUTER, endDeg);
        const i1 = polarToXY(DIAL_CX, DIAL_CY, DIAL_INNER, endDeg);
        const i2 = polarToXY(DIAL_CX, DIAL_CY, DIAL_INNER, startDeg);
        const large = (endDeg - startDeg) > 180 ? 1 : 0;
        return [
            `M ${o1.x} ${o1.y}`,
            `A ${DIAL_OUTER} ${DIAL_OUTER} 0 ${large} 1 ${o2.x} ${o2.y}`,
            `L ${i1.x} ${i1.y}`,
            `A ${DIAL_INNER} ${DIAL_INNER} 0 ${large} 0 ${i2.x} ${i2.y}`,
            'Z'
        ].join(' ');
    }

    function initDial() {
        dialSvg.innerHTML = '';
        for (let i = 0; i < SEGMENT_COUNT; i++) {
            const startDeg = i * SEGMENT_WIDTH + DIAL_GAP / 2;
            const endDeg = (i + 1) * SEGMENT_WIDTH - DIAL_GAP / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', arcPath(startDeg, endDeg));
            path.setAttribute('class', 'segment');
            path.dataset.index = i;
            dialSvg.appendChild(path);
        }
    }

    function updateDial(activeIndex) {
        const segments = dialSvg.querySelectorAll('.segment');
        segments.forEach((s, i) => s.classList.toggle('active', i === activeIndex));
    }

    // --- Audio ---
    function tuneToSegment(segment) {
        if (segment < 0 || segment >= closestStations.length) return;

        const station = closestStations[segment];
        stationNameEl.textContent = station.name;
        updateDial(segment);
        if (mapVisible) updateMap();

        // Haptic
        navigator.vibrate && navigator.vibrate(30);

        playStation(station);
    }

    function playStation(station) {
        // Stop current
        if (hls) { hls.destroy(); hls = null; }
        audioEl.pause();
        audioEl.src = '';
        audioEl.onerror = null;

        // Upgrade http to https (mixed content blocked on HTTPS pages)
        let url = station.url;
        if (url.startsWith('http://')) url = url.replace('http://', 'https://');

        const isHLS = url.includes('.m3u8');

        audioEl.onerror = () => {
            stationNameEl.textContent = station.name + ' (stream unavailable)';
        };

        audioEl.muted = muted;

        if (isHLS && Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(audioEl);
            hls.on(Hls.Events.MANIFEST_PARSED, () => audioEl.play());
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    stationNameEl.textContent = station.name + ' (stream error)';
                    hls.destroy();
                    hls = null;
                }
            });
        } else {
            audioEl.src = url;
            audioEl.play().catch(() => {
                stationNameEl.textContent = station.name + ' (stream unavailable)';
            });
        }
    }

    // --- Map ---
    mapBtn.addEventListener('click', toggleMap);

    function toggleMap() {
        mapVisible = !mapVisible;
        mapContainer.style.display = mapVisible ? 'block' : 'none';
        if (mapVisible) {
            if (!map) {
                map = L.map('map').setView([userLat || 51.5, userLon || -0.1], 10);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OSM'
                }).addTo(map);
                map.on('click', (e) => {
                    if (!flightMode) return;
                    userLat = e.latlng.lat;
                    userLon = e.latlng.lng;
                    gpsStatus.textContent = `FLY: ${userLat.toFixed(3)}, ${userLon.toFixed(3)}`;
                    skipSet.clear();
                    loadClosest6();
                });
            }
            updateMap();
            setTimeout(() => map.invalidateSize(), 100);
        }
    }

    function initAllStationMarkers() {
        allStationMarkers.forEach((m) => map.removeLayer(m));
        allStationMarkers = [];
        stations.forEach((s) => {
            const marker = L.circleMarker([s.lat, s.lon], {
                radius: 3,
                fillColor: '#555',
                fillOpacity: 0.5,
                color: 'none',
                weight: 0
            }).addTo(map).bindPopup(s.name);
            allStationMarkers.push(marker);
        });
    }

    function updateMap() {
        if (!map || userLat === null) return;

        if (!mapInitialised) {
            map.setView([userLat, userLon], 10);
            mapInitialised = true;
        }

        // All stations (once)
        if (allStationMarkers.length === 0) initAllStationMarkers();

        // User marker
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker([userLat, userLon], {
            radius: 8, fillColor: '#4285f4', fillOpacity: 1, color: '#fff', weight: 2
        }).addTo(map).bindPopup('You');

        // Radius circle to furthest active station
        if (radiusCircle) map.removeLayer(radiusCircle);
        connectionLines.forEach((l) => map.removeLayer(l));
        connectionLines = [];

        if (closestStations.length > 0) {
            const distances = closestStations.map((s) => haversine(userLat, userLon, s.lat, s.lon));
            const maxDist = Math.max(...distances);
            radiusCircle = L.circle([userLat, userLon], {
                radius: maxDist * 1000,
                color: '#4285f4',
                fillColor: '#4285f4',
                fillOpacity: 0.05,
                weight: 1,
                dashArray: '6 4'
            }).addTo(map);
        }

        // Active 6 station markers + connection lines
        stationMarkers.forEach((m) => map.removeLayer(m));
        stationMarkers = [];
        closestStations.forEach((s, i) => {
            const isActive = i === currentSegment;

            // Line from user to station
            const line = L.polyline([[userLat, userLon], [s.lat, s.lon]], {
                color: isActive ? '#ff4444' : '#ffaa00',
                weight: isActive ? 2 : 1,
                opacity: isActive ? 0.8 : 0.3
            }).addTo(map);
            connectionLines.push(line);

            const dist = haversine(userLat, userLon, s.lat, s.lon);
            const marker = L.circleMarker([s.lat, s.lon], {
                radius: isActive ? 10 : 6,
                fillColor: isActive ? '#ff4444' : '#ffaa00',
                fillOpacity: 0.9,
                color: '#fff',
                weight: 1
            }).addTo(map).bindPopup(`${i + 1}. ${s.name} (${dist.toFixed(1)} km)`);
            marker.on('click', () => {
                currentSegment = i;
                tuneToSegment(i);
                updateMap();
            });
            stationMarkers.push(marker);
        });

        // Heading cone
        updateHeadingCone();

        // Only auto-zoom on flight mode relocation
        if (flightMode && radiusCircle) {
            map.fitBounds(radiusCircle.getBounds().pad(0.1));
        }
    }

    function updateHeadingCone() {
        if (!map || userLat === null) return;
        if (headingCone) map.removeLayer(headingCone);

        // Draw a cone showing the current segment (60 degrees wide)
        var segStart = currentSegment * SEGMENT_WIDTH;
        var segEnd = segStart + SEGMENT_WIDTH;
        // Also draw a thin line for exact heading

        // Cone radius scales to map — use distance to furthest station or fallback
        var coneDist = 0;
        if (closestStations.length > 0) {
            closestStations.forEach((s) => {
                var d = haversine(userLat, userLon, s.lat, s.lon);
                if (d > coneDist) coneDist = d;
            });
        }
        if (coneDist === 0) coneDist = 20; // 20km fallback

        // Build cone polygon points
        var points = [[userLat, userLon]];
        var steps = 20;
        for (var i = 0; i <= steps; i++) {
            var angle = segStart + (segEnd - segStart) * (i / steps);
            var rad = (angle - 90) * Math.PI / 180; // -90 so 0° is north
            // Approximate: 1 degree lat ~= 111km, 1 degree lon ~= 111km * cos(lat)
            var dLat = (coneDist / 111) * Math.cos(rad);
            var dLon = (coneDist / (111 * Math.cos(userLat * Math.PI / 180))) * Math.sin(rad);
            points.push([userLat + dLat, userLon + dLon]);
        }
        points.push([userLat, userLon]);

        headingCone = L.polygon(points, {
            color: '#ff4444',
            fillColor: '#ff4444',
            fillOpacity: 0.1,
            weight: 1,
            opacity: 0.4
        }).addTo(map);
    }

    // --- Station List ---
    listBtn.addEventListener('click', toggleList);
    listClose.addEventListener('click', toggleList);

    function toggleList() {
        listVisible = !listVisible;
        listContainer.style.display = listVisible ? 'block' : 'none';
        if (listVisible) renderList();
    }

    function renderList() {
        if (userLat === null || stations.length === 0) {
            stationListEl.innerHTML = '<li><span class="st-name">Waiting for GPS...</span></li>';
            return;
        }

        const sorted = stations
            .map((s, i) => ({ station: s, index: i, dist: haversine(userLat, userLon, s.lat, s.lon) }))
            .sort((a, b) => a.dist - b.dist);

        listCount.textContent = `${sorted.length} stations`;

        stationListEl.innerHTML = sorted.map((item) => {
            const isPlaying = closestStations.length > 0 &&
                currentSegment >= 0 &&
                closestStations[currentSegment] &&
                closestStations[currentSegment].name === item.station.name;
            const distStr = item.dist < 1
                ? `${(item.dist * 1000).toFixed(0)} m`
                : `${item.dist.toFixed(1)} km`;
            return `<li class="${isPlaying ? 'now-playing' : ''}" data-index="${item.index}">
                <span class="st-name">${isPlaying ? '>> ' : ''}${item.station.name}</span>
                <span class="st-dist">${distStr}</span>
            </li>`;
        }).join('');

        stationListEl.querySelectorAll('li').forEach((li) => {
            li.addEventListener('click', () => {
                const idx = parseInt(li.dataset.index);
                const station = stations[idx];
                playStation(station);
                stationNameEl.textContent = station.name;
                renderList();
            });
        });
    }

})();
