import React, { memo } from 'react';
import { UrlTile } from 'react-native-maps';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// Tile style URLs — constants so they never trigger re-renders
const LIGHT_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
const DARK_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
const DARK_NAV_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;

interface MapTileLayerProps {
    isDark: boolean;
    /** Use nav-night style instead of dark-v11 (for driver screens) */
    useNavStyle?: boolean;
}

const MapTileLayer: React.FC<MapTileLayerProps> = ({ isDark, useNavStyle = false }) => {
    // Determine the active URL based on the current theme
    const activeUrl = isDark
        ? (useNavStyle ? DARK_NAV_TILE_URL : DARK_TILE_URL)
        : LIGHT_TILE_URL;

    // console.log('MapTileLayer URL:', activeUrl);

    // Using key creates a full remount which can cause white flash/screen if persistent.
    // Try forcing update via key ONLY when theme changes, but ensure key is stable otherwise.
    const tileKey = isDark ? `dark-${useNavStyle ? 'nav' : 'std'}` : 'light';

    return (
        <UrlTile
            key={tileKey}
            urlTemplate={activeUrl}
            maximumZ={19}
            flipY={false}
            tileSize={256}
            opacity={1}
            zIndex={1}
            shouldReplaceMapContent={true}
        />
    );
};

export default memo(MapTileLayer);
