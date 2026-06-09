let map;
let userMarker;
let markersLayer = L.layerGroup();
let currentCoords = null;

// UI Elements
const locateBtn = document.getElementById('locate-btn');
const toggleList = document.getElementById('toggle-list');
const toggleMap = document.getElementById('toggle-map');
const listView = document.getElementById('list-view');
const mapView = document.getElementById('map-view');
const restaurantList = document.getElementById('restaurant-list');
const loader = document.getElementById('loader');
const errorMsg = document.getElementById('error-msg');

// View Toggle Logic
toggleList.addEventListener('click', () => {
    toggleList.classList.add('active');
    toggleMap.classList.remove('active');
    listView.classList.remove('hidden');
    mapView.classList.add('hidden');
});

toggleMap.addEventListener('click', () => {
    toggleMap.classList.add('active');
    toggleList.classList.remove('active');
    mapView.classList.remove('hidden');
    listView.classList.add('hidden');
    
    // Force Leaflet to recalculate size when unhidden
    if (map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
});

// Initialize Map
function initMap(lat, lon) {
    if (!map) {
        map = L.map('map').setView([lat, lon], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        markersLayer.addTo(map);
    } else {
        map.setView([lat, lon], 14);
    }

    if (userMarker) {
        userMarker.setLatLng([lat, lon]);
    } else {
        userMarker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'user-location-marker',
                html: '<div style="background:#2979ff;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>'
            })
        }).addTo(map).bindPopup("You are here");
    }
}

// Geolocation Trigger
locateBtn.addEventListener('click', () => {
    showError("");
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }
    
    loader.classList.remove('hidden');
    restaurantList.innerHTML = "";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            currentCoords = { lat, lon };
            
            initMap(lat, lon);
            fetchHalalRestaurants(lat, lon);
        },
        (error) => {
            loader.classList.add('hidden');
            showError(`Location access denied or failed: ${error.message}. Ensure you are using HTTPS.`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
});

// Fetch Data from OpenStreetMap Overpass API
async function fetchHalalRestaurants(lat, lon) {
    // Search radius in meters (5km)
    const radius = 5000; 
    
    // Overpass QL query looking for restaurant/fast_food tagged with halal
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"="restaurant"]["diet:halal"="yes"](around:${radius},${lat},${lon});
          node["amenity"="restaurant"]["cuisine"="halal"](around:${radius},${lat},${lon});
          node["amenity"="fast_food"]["diet:halal"="yes"](around:${radius},${lat},${lon});
          node["amenity"="fast_food"]["cuisine"="halal"](around:${radius},${lat},${lon});
          way["amenity"="restaurant"]["diet:halal"="yes"](around:${radius},${lat},${lon});
          way["amenity"="restaurant"]["cuisine"="halal"](around:${radius},${lat},${lon});
        );
        out center;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not OK");
        const data = await response.json();
        
        loader.classList.add('hidden');
        renderResults(data.elements);
    } catch (err) {
        loader.classList.add('hidden');
        showError("Failed to fetch restaurant data. OpenStreetMap API might be busy.");
        console.error(err);
    }
}

// Render Results to List and Map
function renderResults(elements) {
    markersLayer.clearLayers();
    restaurantList.innerHTML = "";

    if (elements.length === 0) {
        restaurantList.innerHTML = '<li class="placeholder">No Halal-certified locations found within 5km of your location on OpenStreetMap.</li>';
        return;
    }

    elements.forEach(el => {
        const name = el.tags.name || "Unnamed Halal Eatery";
        const cuisine = el.tags.cuisine || "Restaurant";
        const address = el.tags["addr:street"] ? `${el.tags["addr:house_number"] || ""} ${el.tags["addr:street"]}` : "Address not listed";
        
        // Get coordinates whether node or way center
        const itemLat = el.lat || (el.center && el.center.lat);
        const itemLon = el.lon || (el.center && el.center.lon);

        if (!itemLat || !itemLon) return;

        // Add to List View
        const li = document.createElement('li');
        li.className = 'restaurant-card';
        li.innerHTML = `
            <h3>${name}</h3>
            <p><strong>Cuisine:</strong> ${cuisine}</p>
            <p><strong>Address:</strong> ${address}</p>
        `;
        restaurantList.appendChild(li);

        // Add to Map View
        L.marker([itemLat, itemLon])
            .addTo(markersLayer)
            .bindPopup(`<b>${name}</b><br>${cuisine}<br>${address}`);
    });
}

function showError(msg) {
    if (msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    } else {
        errorMsg.classList.add('hidden');
    }
}