import { isoDatum } from '@/utils/format.js'

// forecast  -> vjetar, tlak, temperatura zraka
// marine    -> valovi, temperatura mora, razina mora (plima/oseka)


export const VJETROVI = [
    'Tramontana', // N
    'Bura', // NE
    'Levant', // E
    'Jugo', // SE
    'Oštro', // S
    'Lebić', // SW
    'Pulenat', // W
    'Maestral', // NW
]

const MINUTA = 60 * 1000

function smjerIzStupnjeva(deg) {
    if (deg == null) return null
    return VJETROVI[Math.round(deg / 45) % 8]
}

function stanjeMoraIzValova(visinaM) {
    if (visinaM == null) return null
    if (visinaM < 0.5) return 'Mirno'
    if (visinaM < 1.25) return 'Valovito'
    return 'Uzburkano'
}


async function dohvatiUvjete(lat, lng, datumOd, datumDo = datumOd) {
    const zajedno =
        `latitude=${lat}&longitude=${lng}` +
        `&start_date=${isoDatum(datumOd)}&end_date=${isoDatum(datumDo)}` +
        `&timezone=Europe%2FZagreb`

    const urlKopno =
        `https://api.open-meteo.com/v1/forecast?${zajedno}` +
        `&hourly=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m` +
        `&wind_speed_unit=kn`

    const urlMore =
        `https://marine-api.open-meteo.com/v1/marine?${zajedno}` +
        `&hourly=wave_height,sea_surface_temperature,sea_level_height_msl`

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
            tlakHpa: zaokruzi(h.surface_pressure?.[i], 1),
            tempZrakaC: zaokruzi(h.temperature_2m?.[i], 1),
            tempMoraC: zaokruzi(m?.sea_surface_temperature?.[i], 1),
            valoviM: zaokruzi(valoviM, 2),
            stanjeMora: stanjeMoraIzValova(valoviM),
            razinaMoraM: zaokruzi(m?.sea_level_height_msl?.[i], 2),
        }
    })
}

function zaokruzi(v, decimala = 0) {
    if (v == null) return null
    return Number(Number(v).toFixed(decimala))
}

function najbliziIndeks(satno, datum) {
    if (!satno?.length || !(datum instanceof Date)) return -1

    const cilj = datum.getTime()
    let indeks = -1
    let razlika = Infinity

    satno.forEach((s, i) => {
        const d = Math.abs(new Date(s.vrijeme).getTime() - cilj)
        if (d < razlika) {
            razlika = d
            indeks = i
        }
    })

    return razlika <= 90 * MINUTA ? indeks : -1
}

function promjena(satno, indeks, polje, sati, prag) {
    const sada = satno[indeks]?.[polje]
    if (sada == null) return null

    const pocetak = Math.max(0, indeks - sati)
    const prije = satno[pocetak]?.[polje]
    if (prije == null || pocetak === indeks) return null

    const razlika = Number((sada - prije).toFixed(2))
    return {
        promjena: razlika,
        sati: indeks - pocetak,
        smjer: Math.abs(razlika) < prag ? 'stabilno' : razlika > 0 ? 'raste' : 'pada',
    }
}

export async function uvjetiZaTrenutak(lat, lng, kada) {
    const satno = await dohvatiUvjete(
        lat,
        lng,
        new Date(kada.getTime() - 180 * MINUTA),
        new Date(kada.getTime() + 60 * MINUTA),
    )

    const i = najbliziIndeks(satno, kada)
    if (i === -1) return { uvjeti: null, trendTlaka: null, plimaOseka: null }

    return {
        uvjeti: satno[i],
        trendTlaka: promjena(satno, i, 'tlakHpa', 3, 0.5),
        plimaOseka: promjena(satno, i, 'razinaMoraM', 1, 0.02),
    }
}
