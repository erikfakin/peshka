// Vrste ribe, načini lova i mamci. Ne mijenjaju se dok aplikacija radi, pa ih
// dohvaćamo jednom i dijelimo između svih stranica i komponenti.

import { ref } from 'vue'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebase.js'

const sifrarnici = ref({ vrste: {}, nacini: {}, mamci: {} })
let dohvat = null

async function dohvatiKolekciju(naziv) {
    const snap = await getDocs(collection(db, naziv))
    return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
}

function ucitaj() {
    dohvat ??= Promise.all([
        dohvatiKolekciju('vrsteRibe'),
        dohvatiKolekciju('naciniLova'),
        dohvatiKolekciju('mamci'),
    ])
        .then(([vrste, nacini, mamci]) => {
            sifrarnici.value = { vrste, nacini, mamci }
        })
        .catch((e) => {
            dohvat = null
            throw e
        })

    return dohvat
}

export function useSifrarnici() {
    return {
        sifrarnici,
        ucitaj,
        nazivVrste: (id) => sifrarnici.value.vrste[id]?.nazivHr ?? 'Nepoznata vrsta',
        nazivNacina: (id) => sifrarnici.value.nacini[id]?.naziv ?? '',
        nazivMamca: (id) => sifrarnici.value.mamci[id]?.naziv ?? '',
    }
}
