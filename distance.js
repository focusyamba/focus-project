// distance.js
// Calculates real-world distance between GPS coordinates using the "Haversine formula".
// This formula accounts for the Earth being a sphere, not a flat surface.

const EARTH_RADIUS_KM = 6371;

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Distance in km between two GPS points.
 */
function haversineDistance(point1, point2) {
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lon - point1.lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Takes a full track (array of {lat, lon, timestamp}) and returns the total distance in km.
 * Also does basic sanity-checking: ignores "jumps" that are physically impossible
 * for a runner (e.g. teleporting 500m in 1 second = fake GPS or a bug).
 */
function calculateTrackDistance(track) {
  let totalKm = 0;
  const MAX_REALISTIC_SPEED_KMH = 25; // generous upper limit for a sprinting human

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1];
    const curr = track[i];

    const segmentKm = haversineDistance(prev, curr);
    const timeDiffHours = (curr.timestamp - prev.timestamp) / 1000 / 60 / 60;

    if (timeDiffHours <= 0) continue; // skip bad/duplicate timestamps

    const speedKmh = segmentKm / timeDiffHours;

    // Skip segments that imply impossible speed — likely GPS glitch or spoofing.
    if (speedKmh > MAX_REALISTIC_SPEED_KMH) continue;

    totalKm += segmentKm;
  }

  return totalKm;
}

module.exports = { haversineDistance, calculateTrackDistance };
