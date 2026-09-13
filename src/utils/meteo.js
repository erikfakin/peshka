// Open-Meteo je besplatan i ne traži ključ. Dva endpointa:
// forecast  -> vjetar, tlak, temperatura zraka
// marine    -> valovi, temperatura mora

const VJETROVI = [
    'Tramontana', // N
    'Bura', // NE
    'Levant', // E
    'Jugo', // SE
    'Oštro', // S
    'Lebić', // SW
    'Pulenat', // W
    'Maestral', // NW
]

export function smjerIzStupnjeva(deg) {
    if (deg == null) return null
    return VJETROVI[Math.round(deg / 45) % 8]
}

export function stanjeMoraIzValova(visinaM) {
    if (visinaM == null) return null
    if (visinaM < 0.5) return 'Mirno'
    if (visinaM < 1.25) return 'Valovito'
    return 'Uzburkano'
}

function zaApi(d) {
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * @returns {Promise<Array>} niz po satima:
 *   { vrijeme, smjerVjetraDeg, smjerVjetra, brzinaVjetraCv,
 *     tlakHpa, tempZrakaC, tempMoraC, valoviM, stanjeMora }
 */
export async function dohvatiUvjete(lat, lng, datumOd, datumDo = datumOd) {
    const zajedno =
        `latitude=${lat}&longitude=${lng}` +
        `&start_date=${zaApi(datumOd)}&end_date=${zaApi(datumDo)}` +
        `&timezone=Europe%2FZagreb`

    const urlKopno =
        `https://api.open-meteo.com/v1/forecast?${zajedno}` +
        `&hourly=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m` +
        `&wind_speed_unit=kn`

    const urlMore =
        `https://marine-api.open-meteo.com/v1/marine?${zajedno}` +
        `&hourly=wave_height,sea_surface_temperature`

    const odgovor = await fetch(urlKopno)
    if (!odgovor.ok) throw new Error(`Open-Meteo ${odgovor.status}`)
    const kopno = await odgovor.json()

    const more = await fetch(urlMore)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)

    const h = kopno.hourly
    const m = more?.hourly

    return h.time.map((vrijeme, i) => {
        const deg = h.wind_direction_10m?.[i] ?? null
        const valoviM = m?.wave_height?.[i] ?? null

        return {
            vrijeme,
            smjerVjetraDeg: deg,
            smjerVjetra: smjerIzStupnjeva(deg),
            brzinaVjetraCv: zaokruzi(h.wind_speed_10m?.[i]),
            tlakHpa: zaokruzi(h.surface_pressure?.[i]),
            tempZrakaC: zaokruzi(h.temperature_2m?.[i], 1),
            tempMoraC: zaokruzi(m?.sea_surface_temperature?.[i], 1),
            valoviM: zaokruzi(valoviM, 2),
            stanjeMora: stanjeMoraIzValova(valoviM),
        }
    })
}

function zaokruzi(v, decimala = 0) {
    if (v == null) return null
    return Number(Number(v).toFixed(decimala))
}


export function satZaVrijeme(satno, datum) {
    if (!satno?.length) return null
    const cilj = datum.getTime()
    return satno.reduce((najblizi, s) =>
        Math.abs(new Date(s.vrijeme) - cilj) < Math.abs(new Date(najblizi.vrijeme) - cilj)
            ? s
            : najblizi,
    )
}

export function trendTlaka(satno) {
    const vrijednosti = satno.map((s) => s.tlakHpa).filter((v) => v != null)
    if (vrijednosti.length < 2) return null
    const razlika = vrijednosti.at(-1) - vrijednosti[0]
    if (Math.abs(razlika) < 1) return 'stabilan'
    return razlika > 0 ? 'raste' : 'pada'
}