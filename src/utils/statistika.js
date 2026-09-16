// Zbrojevi nad popisom ulova koje prikazuju izlazak, profil i analitika.

export function ukupnoKg(ulovi) {
    return ulovi.reduce((zbroj, u) => zbroj + (u.masaKg ?? 0), 0)
}

export function najvecaRiba(ulovi) {
    let naj = null

    for (const u of ulovi) {
        if (u.masaKg == null) continue
        if (naj == null || u.masaKg > naj.masaKg) naj = u
    }

    return naj
}
