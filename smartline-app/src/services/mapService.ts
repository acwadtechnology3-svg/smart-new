import axios from 'axios';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

/**
 * Log Mapbox API usage for optimization tracking.
 * @param endpoint The API endpoint/service being used (e.g., 'geocoding', 'directions')
 * @param details Additional context (e.g., 'reverse', 'forward', 'driving')
 */
const logMapboxUsage = (endpoint: string, details: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[MAPBOX_USAGE] ${timestamp} | Service: ${endpoint} | Type: ${details}`);
    // Potential Future: Send this to backend analytics
};

/**
 * Forward Geocoding (Search for a place)
 * API Billing: Geocoding API (1 request per call)
 */
export const searchPlaces = async (query: string, proximity?: [number, number], types?: string, language: 'en' | 'ar' = 'en') => {
    logMapboxUsage('geocoding', 'forward_search');
    try {
        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=EG&autocomplete=true&limit=10&language=${language}`;

        if (proximity) {
            url += `&proximity=${proximity[0]},${proximity[1]}`;
        }

        if (types) {
            url += `&types=${types}`;
        }

        const response = await axios.get(url);
        return response.data.features;
    } catch (error) {
        console.error('Mapbox Geocoding Error:', error);
        return [];
    }
};

/**
 * Reverse Geocoding (Coordinates -> Address)
 * API Billing: Geocoding API (1 request per call)
 */
export const reverseGeocode = async (lat: number, lng: number, language: 'en' | 'ar' = 'en') => {
    logMapboxUsage('geocoding', 'reverse');
    try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&language=${language}`;
        const response = await axios.get(url, { timeout: 5000 });
        return response.data.features?.[0]?.place_name; // Return full address or undefined
    } catch (error) {
        console.error('Mapbox Reverse Geocoding Error:', error);
        return null;
    }
};

/**
 * Directions API (Route between two points)
 * API Billing: Directions API (1 request per call)
 */
export const getDirections = async (start: [number, number], end: [number, number]) => {
    logMapboxUsage('directions', 'driving_traffic');
    try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`;
        const response = await axios.get(url);
        return response.data.routes[0];
    } catch (error) {
        console.error('Mapbox Directions Error:', error);
        return null;
    }
};
