// Upload i brisanje fotografija: datoteke idu u Firebase Storage,
// metapodaci u kolekciju 'fotografije'.

import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    setDoc,
    where,
    writeBatch,
} from 'firebase/firestore'
import {
    deleteObject,
    getDownloadURL,
    ref as spremisteRef,
    uploadBytesResumable,
} from 'firebase/storage'
import { db, storage } from '@/firebase.js'

const MAX_STRANICA = 1600
const KVALITETA = 0.82

export async function pripremiSliku(datoteka, maxStranica = MAX_STRANICA) {
    if (!datoteka.type.startsWith('image/')) {
        throw new Error(`Datoteka "${datoteka.name}" nije slika.`)
    }

    const bitmap = await createImageBitmap(datoteka)
    const omjer = Math.min(1, maxStranica / Math.max(bitmap.width, bitmap.height))
    const sirina = Math.round(bitmap.width * omjer)
    const visina = Math.round(bitmap.height * omjer)

    const platno = document.createElement('canvas')
    platno.width = sirina
    platno.height = visina
    platno.getContext('2d').drawImage(bitmap, 0, 0, sirina, visina)
    bitmap.close()

    const blob = await new Promise((razrijesi, odbij) =>
        platno.toBlob(
            (b) => (b ? razrijesi(b) : odbij(new Error('Pretvorba slike nije uspjela.'))),
            'image/jpeg',
            KVALITETA,
        ),
    )

    return blob
}

function posalji(ref, blob, onNapredak) {
    return new Promise((razrijesi, odbij) => {
        const zadatak = uploadBytesResumable(ref, blob, {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000',
        })
        zadatak.on(
            'state_changed',
            (s) => onNapredak?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0),
            odbij,
            () => razrijesi(zadatak.snapshot.ref),
        )
    })
}

export async function dodajFotografije(
    datoteke,
    { ulovId, izlazakId, korisnikId, vidljivost = 'Privatno', pocetniRedoslijed = 0, onNapredak },
) {
    const popis = Array.from(datoteke ?? [])
    const spremljene = []

    for (const [i, datoteka] of popis.entries()) {
        const fotoId = doc(collection(db, 'fotografije')).id
        const blob = await pripremiSliku(datoteka)

        const putanja = `korisnici/${korisnikId}/ulovi/${ulovId}/${fotoId}.jpg`
        const ref = spremisteRef(storage, putanja)

        await posalji(ref, blob, (udio) =>
            onNapredak?.({ indeks: i, ukupno: popis.length, udio, naziv: datoteka.name }),
        )

        const url = await getDownloadURL(ref)
        const zapis = {
            ulovId,
            izlazakId,
            korisnikId,
            putanja,
            url,
            redoslijed: pocetniRedoslijed + i,
            vidljivost,
        }

        await setDoc(doc(db, 'fotografije', fotoId), zapis)
        spremljene.push({ id: fotoId, ...zapis })
    }

    return spremljene
}

export async function ucitajFotografijeIzlaska(izlazakId, korisnikId) {
    const snap = await getDocs(
        query(
            collection(db, 'fotografije'),
            where('izlazakId', '==', izlazakId),
            where('korisnikId', '==', korisnikId),
            orderBy('redoslijed'),
        ),
    )

    const poUlovu = {}
    for (const d of snap.docs) {
        const foto = { id: d.id, ...d.data() }
        if (!poUlovu[foto.ulovId]) poUlovu[foto.ulovId] = []
        poUlovu[foto.ulovId].push(foto)
    }
    return poUlovu
}

export async function ucitajFotografijeUlova(ulovId, { korisnikId = null } = {}) {
    const dokaz = korisnikId
        ? where('korisnikId', '==', korisnikId)
        : where('vidljivost', '==', 'Javno')

    const snap = await getDocs(
        query(
            collection(db, 'fotografije'),
            where('ulovId', '==', ulovId),
            dokaz,
            orderBy('redoslijed'),
        ),
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function ukloniDatoteku(putanja) {
    try {
        await deleteObject(spremisteRef(storage, putanja))
    } catch (e) {
        if (e.code !== 'storage/object-not-found') throw e
    }
}

export async function obrisiFotografiju(foto) {
    await ukloniDatoteku(foto.putanja)
    await deleteDoc(doc(db, 'fotografije', foto.id))
}

export function fotografijeVlasnika(ulovId, korisnikId) {
    return getDocs(
        query(
            collection(db, 'fotografije'),
            where('ulovId', '==', ulovId),
            where('korisnikId', '==', korisnikId),
        ),
    )
}

export async function obrisiFotografijeUlova(ulovId, korisnikId) {
    const snap = await fotografijeVlasnika(ulovId, korisnikId)
    if (snap.empty) return

    await Promise.all(snap.docs.map((d) => ukloniDatoteku(d.data().putanja)))

    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
}