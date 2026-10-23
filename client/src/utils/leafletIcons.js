import L from 'leaflet';

// Fix standard Leaflet default marker icons for Vite asset bundling
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl
});

/**
 * Creates custom colored SVG div-icon pins for interactive maps.
 * @param {string} color - Hex or CSS color
 * @param {string} label - e.g. 'A', 'B', 'Origin', 'Destination'
 */
export function createPinIcon(color = '#0284c7', label = '') {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <div style="
          background-color: ${color};
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
          border: 2px solid white;
        ">
          <span style="
            transform: rotate(45deg);
            font-size: 13px;
            font-weight: 700;
          ">${label}</span>
        </div>
        <div style="
          width: 8px;
          height: 8px;
          background-color: rgba(0, 0, 0, 0.3);
          border-radius: 50%;
          filter: blur(1px);
          margin-top: 2px;
        "></div>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -36]
  });
}

export const originIcon = createPinIcon('#10b981', 'A'); // Emerald / Origin
export const destinationIcon = createPinIcon('#ef4444', 'B'); // Rose / Destination
export const genericPinIcon = createPinIcon('#3b82f6', '📍'); // Blue pin
