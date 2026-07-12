import "./style.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix marker icons (Vite bundles assets differently)
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

L.Marker.prototype.options.icon = L.icon({
  iconUrl,
  shadowUrl: iconShadow,
});

const CLIENT_ID = '163773';
let accessToken = '';
let latlngs = [];
let activities = [];
let activityIndex = 0;
let isSharedMode = false;

// Detect access token from redirect
const params = new URLSearchParams(window.location.search);



//-------------------------------------------------------------------------------
const showMap = (activity) => {
  document.getElementById("login").style.display = "none";
  document.getElementById("map").style.display = "block";

  const API_KEY = 'Dp0Y4WgtEgqMzlXttJnbX9GAg2Ijj9lZUaFawE466Gk';
  const map = L.map('map').setView(activity.latlngs[0], 16);



  L.tileLayer(`https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${API_KEY}`, {
    minZoom: 0,
    maxZoom: 19,
    attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
  }).addTo(map);

  const LogoControl = L.Control.extend({
    options: { position: 'bottomleft' },
    onAdd: function (map) {
      const container = L.DomUtil.create('div');
      const link = L.DomUtil.create('a', '', container);
      link.setAttribute('href', 'http://mapy.com/');
      link.setAttribute('target', '_blank');
      link.innerHTML = '<img src="https://api.mapy.com/img/api/logo.svg" />';
      L.DomEvent.disableClickPropagation(link);
      return container;
    },
  });
  new LogoControl().addTo(map);


  const StravaLogoControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function (map) {
      const container = L.DomUtil.create('div');
      const img = L.DomUtil.create('img', '', container);
      img.src = '/api_logo_pwrdBy_strava_stack_orange.png';
      img.style.width = '100px'; // optional size control
      //img.style.opacity = '0.8'; // optional transparency
      return container;
    },
  });
  new StravaLogoControl().addTo(map);



  const polyline = animatePolyline(
  map,
  activity.latlngs,                // [[lat, lng], ...]
  { color: 'blue', weight: 5, opacity: 0.6, dashArray: [10, 10] }, // your styling
  2000                             // duration in ms
);

/*
  const polyline = L.polyline(activity.latlngs, { color: 'blue', weight: 5, opacity: 0.6, dashArray: [10, 10] })
    .addTo(map);
*/



  // Create the starting marker with custom icon
  const startMarker = L.marker(activity.latlngs[0], {}).addTo(map);
  startMarker.bindPopup("Start: " + formatDate(activity.start_date_local));
  startMarker.setOpacity(0.8);


  // Create the ending marker with custom icon
  const endMarker = L.marker(activity.latlngs[activity.latlngs.length - 1], {}).addTo(map);
  const startDate = new Date(activity.start_date_local);
  endMarker.bindPopup("End: " + formatDate(new Date(startDate.getTime() + activity.elapsed_time * 1000)));
  endMarker.setOpacity(0.8);


  //map.fitBounds(polyline.getBounds());

  // Create arrows (not in shared mode)
  if (!isSharedMode) {
    if (activityIndex > 0) {
      const arrowLeft = L.DomUtil.create('div', 'arrow-control right-arrow', map.getContainer());
      arrowLeft.innerHTML = '&#9654;'; // ▶
      arrowLeft.title = getInfoTextShort(activities[activityIndex - 1]);
      arrowLeft.onclick = () => onSwitchActivity(activityIndex - 1, map);

    }
    if (activityIndex < activities.length - 1) {
      const arrowRight = L.DomUtil.create('div', 'arrow-control left-arrow', map.getContainer());
      arrowRight.innerHTML = '&#9664;'; // ◀
      arrowRight.title = getInfoTextShort(activities[activityIndex + 1]);
      arrowRight.onclick = () => onSwitchActivity(activityIndex + 1, map);

    }
  }


  // info text
  const infoText = L.DomUtil.create('div', 'info-text', map.getContainer());
  infoText.innerHTML = getInfoText(activity);
  
  // Combo-box (not in shared mode)
  if (!isSharedMode) {
    const selectBox = L.DomUtil.create('select', 'activity-selector', map.getContainer());
    activities.forEach((act, i) => {
      const option = document.createElement('option');
      option.value = i;
      option.text = getInfoTextShort(act);
      if (act.id === activity.id) {
        option.selected = true;
      }
      selectBox.appendChild(option);
    });

    selectBox.onchange = (e) => {
      const selectedIndex = parseInt(e.target.value, 10);
      onSwitchActivity(selectedIndex, map);
    };
  }


  // Share button (only when logged in, not in shared mode)
  if (accessToken && !isSharedMode) {
    const shareBtn = L.DomUtil.create('div', 'share-button', map.getContainer());
    shareBtn.innerHTML = '&#128279; Share';
    shareBtn.title = 'Share this activity';
    shareBtn.onclick = () => shareActivity(activity);
  }

  // Change URL without reloading
  if (!isSharedMode) {
    window.history.pushState({}, '', `/activities/${activity.id}`);
  }

};

async function onSwitchActivity(selectedIndex, map) {
  try {
    showSpinner();
    if (map) {
      map.remove();
    }
    // Remove info-text and activity-selector from the DOM
    const infoText = document.querySelector('.info-text');
    if (infoText) {
      infoText.remove();
    }

    const activitySelector = document.querySelector('.activity-selector');
    if (activitySelector) {
      activitySelector.remove();
    }

    const arrowLeft = document.querySelector('.left-arrow');
    if (arrowLeft) {
      arrowLeft.remove();
    }

    const arrowRight = document.querySelector('.right-arrow');
    if (arrowRight) {
      arrowRight.remove();
    }

    activityIndex = selectedIndex;
    const mapContainer = document.getElementById("map");
    mapContainer.style.display = "none";
    let activity = activities[selectedIndex];
    activity.latlngs = await downloadGpx(activity.id);
    showMap(activity);
  }
  finally {
    hideSpinner();
  }


}


//------------------------------------------------------------------------
// Function to format distance in kilometers (max 2 decimal places)
function formatDistance(distance) {
  return (distance / 1000).toFixed(2); // Convert meters to kilometers and round to 2 decimals
}

// Function to convert start date to local time without trailing seconds
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString().replace(/:\d{2}$/, ''); // Remove seconds
}
// ------------------------------------------------------------
function getActivityIcon(type) {
  if (type === 'Run') return "🏃";
  if (type === 'Ride') return "🚴";
  return "";
}
function getInfoText(activity) {
  return ` <a href='https://www.strava.com/activities/${activity.id}' target="_blank"><strong>${activity.name}</strong></a><br>
     ${formatDate(activity.start_date_local)} – ${getActivityIcon(activity.type)} ${activity.type}, ${formatDistance(activity.distance)} km`
}
function getInfoTextShort(activity) {
  return `${formatDate(activity.start_date_local)}, ${getActivityIcon(activity.type)} ${activity.name}, ${formatDistance(activity.distance)} km`
}

const getActivityIdFromURL = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/activities\/([^\/]+)$/);

  if (match) {
    const activityId = match[1];
    console.log("Activity ID3:", activityId);
    return activityId
  } else {
    return ''
  }
}

const getSharedIdFromURL = () => {
  const path = window.location.pathname;
  const match = path.match(/^\/shared\/([^\/]+)$/);
  return match ? match[1] : '';
}

async function shareActivity(activity) {
  try {
    const payload = {
      latlngs: activity.latlngs,
      name: activity.name,
      start_date_local: activity.start_date_local,
      elapsed_time: activity.elapsed_time,
      distance: activity.distance,
      type: activity.type,
      strava_activity_id: activity.id,
    };

    const res = await fetch('https://api.strava-mapy.com/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      alert('Share failed: ' + (err.error || 'Unknown error'));
      return;
    }

    const data = await res.json();
    await navigator.clipboard.writeText(data.url);
    showShareNotification(data.url);
  } catch (e) {
    console.error('Share error:', e);
    alert('Failed to share activity.');
  }
}

function showShareNotification(url) {
  // Remove existing notification if any
  const existing = document.querySelector('.share-notification');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.className = 'share-notification';
  notif.innerHTML = `Link copied to clipboard!<br><a href="${url}" target="_blank">${url}</a>`;
  document.body.appendChild(notif);

  setTimeout(() => notif.remove(), 5000);
}

async function loadSharedActivity() {
  const shareId = getSharedIdFromURL();
  if (!shareId) return false;

  isSharedMode = true;
  showSpinner();

  try {
    const res = await fetch(`/shared-data/${shareId}.json`);
    if (!res.ok) {
      hideSpinner();
      document.getElementById('login').style.display = 'none';
      document.getElementById('map').style.display = 'block';
      document.getElementById('map').innerHTML = '<p style="padding:2em;">Shared activity not found or has expired.</p>';
      return true;
    }

    const activity = await res.json();
    activity.id = activity.strava_activity_id || shareId;
    showMap(activity);
  } catch (e) {
    console.error('Error loading shared activity:', e);
    alert('Failed to load shared activity.');
  } finally {
    hideSpinner();
  }

  return true;
}
const init = async () => {
  try {
    // Handle shared activity route (no auth needed)
    if (await loadSharedActivity()) return;

    const code = params.get("code");


    // Check if accessToken is already stored in localStorage
    const storedToken = localStorage.getItem('accessToken');

    if (storedToken) {
      console.log("Using stored Strava token:", storedToken);
      accessToken = storedToken; // Use the stored access token
      showSpinner();
      await fetchActivities();
    } else if (code) {
      console.log("Strava code:", code);
      const res = await fetch("https://api.strava-mapy.com/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();
      console.log("Strava token:", data.access_token);
      accessToken = data.access_token;

      // Store the access token in localStorage
      localStorage.setItem('accessToken', accessToken);

      // reflect activityId in URL
      const activityId = params.get("state"); //activityId
      redirectToBase(activityId ? `/activities/${activityId}` : '');
    } else {
      document.getElementById("login").style.display = "block";
      document.getElementById("strava-connect").href =
        `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}&approval_prompt=auto&scope=read,activity:read,activity:read_all&state=${getActivityIdFromURL()}`;
    }
  } catch (error) {

    console.error("Error occurred during initialization:", error);
    hideSpinner();
  }
};

function redirectToBase(activitySuffix = '') {
  window.location.href = window.location.origin + activitySuffix;
}
//----------------------------------------------------------
async function fetchFromStrava(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    goToLoginPage();
  }

  if (!response.ok) {
    console.log('Error fetching activities');
    return;
  }

  return await response.json()

}
//------------------------------------------------------------------------------
async function fetchActivities() {


  let data = await fetchFromStrava("https://www.strava.com/api/v3/athlete/activities?per_page=20&page=1");
  activities = data.filter(activity => activity.map && activity.map.summary_polyline);
  if (activities.length === 0) {
    alert("Sorry, no recent activity with map found.");
    return;
  }

  const id = getActivityIdFromURL();
  let index = 0;
  if (id) {
    index = activities.findIndex(activity => activity.id == id)
  }

  if (index == -1) {
    data = await fetchFromStrava("https://www.strava.com/api/v3/activities/" + id);
    if (!data || data.length == 0) {
      console.error("No activity with ID " + id);
      return;
    }
    index = activities.push(data) - 1;
  }

  onSwitchActivity(index, null)
}

// ------------------------------------------------
function goToLoginPage() {
  console.error("Invalid access token. Redirecting to the login page.")
  localStorage.removeItem('accessToken');
  redirectToBase();
}
//-----------------------------------------------------------------------------------------------
function showSpinner() {
  const el = document.getElementById('spinner');
  if (!el) return;
  el.style.display = 'flex';
  console.log('show');
  el.setAttribute('aria-busy', 'true');
}
function hideSpinner() {
  const el = document.getElementById('spinner');
  if (!el) return;
  el.style.display = 'none';
  el.setAttribute('aria-busy', 'false');
}
//----------------------------------------------------------------------------------------------

async function downloadGpx(activityId) {
  const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=latlng&key_by_type=true`;
  //const url = `https://api.strava-mapy.com/activities/${activityId}/streams?keys=latlng&key_by_type=true`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    goToLoginPage();
  }
  if (!response.ok) {
    alert("Failed to download track data.");
    return;
  }

  const data = await response.json();
  return data.latlng.data;

}
//------------------------------------------------------------------------------------
// Animate drawing a polyline over a fixed duration (ms)
function animatePolyline(map, latlngs, styleOpts = {}, duration = 3000) {
  if (!latlngs || latlngs.length < 2) {
    return L.polyline(latlngs || [], styleOpts).addTo(map);
  }

  // Precompute cumulative distances
  const pts = latlngs.map(p => L.latLng(p[0], p[1]));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i]));
  }
  const total = cum[cum.length - 1];

  // Create an empty polyline and add to map
  const line = L.polyline([], {
    weight: 5,
    color: 'blue',
    opacity: 0.9,
    ...styleOpts
  }).addTo(map);

  // Optional: fit bounds once
  map.fitBounds(L.polyline(latlngs).getBounds(), { padding: [20, 20] });

  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const t = Math.min(elapsed / duration, 1);
    const targetDist = total * t;

    // Find segment where targetDist lies
    let i = 0;
    while (i < cum.length - 1 && cum[i + 1] < targetDist) i++;

    const segLen = cum[i + 1] - cum[i];
    const segT = segLen > 0 ? (targetDist - cum[i]) / segLen : 0;

    // Build current points + interpolated point
    const current = pts.slice(0, i + 1);
    if (i < pts.length - 1) {
      const a = pts[i], b = pts[i + 1];
      const lat = a.lat + (b.lat - a.lat) * segT;
      const lng = a.lng + (b.lng - a.lng) * segT;
      current.push([lat, lng]);
    }

    line.setLatLngs(current);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // Ensure final full path is set (exact)
      line.setLatLngs(latlngs);
    }
  }

  requestAnimationFrame(step);
  return line;
}
//-------------------------------------------------------------------------------------
init()
  .then(() => {
    console.log("Init completed successfully");
  })
  .catch((error) => {
    console.error("Error in init:", error);
  });

