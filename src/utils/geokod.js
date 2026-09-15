// Obrnuto geokodiranje preko Nominatima (OpenStreetMap).

const BAZA = 'https://nominatim.openstreetmap.org/reverse'
const spremnik = new Map()

function izAdrese(a = {}) {
    return (
        a.islet ||
        a.island ||
        a.bay ||
        a.hamlet ||
        a.village ||
        a.town ||
        a.city ||
        a.suburb ||
        a.municipality ||
        a.county ||
        null
    )
}

export async function nazivZaKoordinate(gpsSirina, gpsDuzina) {
    if (gpsSirina == null || gpsDuzina == null) return null

    const kljuc = `${gpsSirina.toFixed(4)},${gpsDuzina.toFixed(4)}`
    if (spremnik.has(kljuc)) return spremnik.get(kljuc)

    const url = `${BAZA}?format=jsonv2&lat=${gpsSirina}&lon=${gpsDuzina}&accept-language=hr`

    const odgovor = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!odgovor.ok) throw new Error(`Nominatim je vratio ${odgovor.status}.`)

    const podaci = await odgovor.json()
    const naziv = podaci.error ? null : izAdrese(podaci.address)

    spremnik.set(kljuc, naziv)
    return naziv
}