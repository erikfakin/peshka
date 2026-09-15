import { divIcon } from 'leaflet/dist/leaflet-src.esm.js'

const PRIBADACA = 'M14 1C6.8 1 1 6.8 1 14c0 9.6 13 23 13 23s13-13.4 13-23C27 6.8 21.2 1 14 1z'

const ikone = new Map()


export function ikonaOznake(broj = 1) {
    const oznaka = broj > 99 ? '99+' : String(broj)
    if (ikone.has(oznaka)) return ikone.get(oznaka)

    const sredina =
        broj > 1
            ? `<circle cx="14" cy="14" r="8.5" fill="var(--brand-navy)"/>
               <text x="14" y="14" dy="0.35em" text-anchor="middle" fill="#fff"
                   font-family="Geist Variable, sans-serif" font-weight="700"
                   >${oznaka}</text>`
            : `<circle cx="14" cy="14" r="4.5" fill="var(--brand-navy)"/>`

    const ikona = divIcon({
        className: 'oznaka-ulova',
        html: `<svg width="28" height="38" viewBox="0 0 28 38" aria-hidden="true">
                   <path d="${PRIBADACA}" fill="var(--brand-coral)" stroke="var(--brand-navy)" stroke-width="1.5"/>
                   ${sredina}
               </svg>`,
        iconSize: [28, 38],
        iconAnchor: [14, 37],
        tooltipAnchor: [0, -26],
    })

    ikone.set(oznaka, ikona)
    return ikona
}
