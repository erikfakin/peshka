// Upload i brisanje fotografija: datoteke idu u Firebase Storage,
// metapodaci u top-level kolekciju 'fotografije'.

import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
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

const MAX_STRANICA = 1600 // duža stranica u px nakon smanjivanja
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

    return { blob, sirina, visina }
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
    {
        ulovId,
        izlazakId,
        korisnikId,
        vidljivost = 'Privatno',
        pocetniRedoslijed = 0,
        onNapredak,
        onSpremljena,
    },
) {
    const popis = Array.from(datoteke ?? [])
    const spremljene = []

    for (const [i, datoteka] of popis.entries()) {
        const fotoId = doc(collection(db, 'fotografije')).id
        const { blob, sirina, visina } = await pripremiSliku(datoteka)

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
            sirina,
            visina,
            velicinaB: blob.size,
            mimeType: 'image/jpeg',
            redoslijed: pocetniRedoslijed + i,
            vidljivost,
            vrijemeUcitavanja: serverTimestamp(),
        }

        await setDoc(doc(db, 'fotografije', fotoId), zapis)
        const spremljena = { id: fotoId, ...zapis }
        spremljene.push(spremljena)
        onSpremljena?.(spremljena, datoteka)
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
            ; (poUlovu[foto.ulovId] ??= []).push(foto)
    }
    return poUlovu
}

async function ukloniDatoteku(putanja) {
    try {
        await deleteObject(spremisteRef(storage, putanja))
    } catch (e) {
        // Datoteka je već obrisana — dokument svejedno maknemo.
        if (e.code !== 'storage/object-not-found') throw e
    }
}

export async function obrisiFotografiju(foto) {
    await ukloniDatoteku(foto.putanja)
    await deleteDoc(doc(db, 'fotografije', foto.id))
}


export async function obrisiFotografijeUlova(ulovId, korisnikId) {
    const snap = await getDocs(
        query(
            collection(db, 'fotografije'),
            where('ulovId', '==', ulovId),
            where('korisnikId', '==', korisnikId),
        ),
    )
    if (snap.empty) return

    await Promise.all(snap.docs.map((d) => ukloniDatoteku(d.data().putanja)))

    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
}