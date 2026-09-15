
// Mjesečeva mijena i sunčeva svjetlost u trenutku ulova.

import * as SunCalc from 'suncalc'

// Redom kako idu kroz mjesec
export const MIJENE = [
    'Mlad mjesec',
    'Rastući srp',
    'Prva četvrt',
    'Rastući mjesec',
    'Pun mjesec',
    'Opadajući mjesec',
    'Zadnja četvrt',
    'Opadajući srp',
]

const MINUTA = 60 * 1000

export function fazaMjeseca(datum) {
    const { phase, fraction } = SunCalc.getMoonIllumination(datum)
    return {
        osvijetljenost: Math.round(fraction * 100),
        naziv: MIJENE[Math.round(phase * 8) % 8],
    }
}

export function svjetloDana(datum, gpsSirina, gpsDuzina) {
    const t = SunCalc.getTimes(datum, gpsSirina, gpsDuzina)
    const kada = datum.getTime()

    let dio = 'noć'
    if (kada >= t.sunrise && kada <= t.sunset) dio = 'dan'
    else if (kada >= t.dawn && kada < t.sunrise) dio = 'zora'
    else if (kada > t.sunset && kada <= t.dusk) dio = 'sumrak'

    return {
        dio,
        minutaDoIzlaska: Math.round((t.sunrise - kada) / MINUTA),
        minutaDoZalaska: Math.round((t.sunset - kada) / MINUTA),
    }
}

export function astroZaUlov(datum, gpsSirina, gpsDuzina) {
    return {
        mjesec: fazaMjeseca(datum),
        sunce: svjetloDana(datum, gpsSirina, gpsDuzina),
    }
}