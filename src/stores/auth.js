import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth'

import { auth, db } from '@/firebase.js'
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null)
    const profil = ref(null)
    const authReady = ref(false)

    const isLoggedIn = computed(() => user.value !== null)

    const punoIme = computed(() => {
        const p = profil.value
        return `${p?.ime ?? ''} ${p?.prezime ?? ''}`.trim() || user.value?.email || ''
    })

    let odjaviProfil = null

    function pratiProfil(uid) {
        odjaviProfil?.()
        odjaviProfil = null
        profil.value = null

        if (!uid) return

        odjaviProfil = onSnapshot(
            doc(db, 'korisnici', uid),
            (snap) => {
                profil.value = snap.exists() ? snap.data() : null
            },
            (e) => {
                console.error('Profil nije učitan:', e)
                profil.value = null
            },
        )
    }

    let oznaciSpremno
    const spremno = new Promise((razrijesi) => (oznaciSpremno = razrijesi))

    onAuthStateChanged(auth, (firebaseUser) => {
        user.value = firebaseUser
        pratiProfil(firebaseUser?.uid ?? null)
        authReady.value = true
        oznaciSpremno()
    })

    function whenAuthReady() {
        return spremno
    }

    async function register(email, password, ime, prezime) {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        try {
            await setDoc(doc(db, 'korisnici', cred.user.uid), {
                email,
                ime,
                prezime,
                datumRegistracije: serverTimestamp(),
            })
            await updateProfile(cred.user, { displayName: `${ime} ${prezime}`.trim() })
        } catch (e) {
            console.error('Profil nije spremljen:', e)
        }
        return cred
    }

    async function azurirajProfil(ime, prezime) {
        if (!user.value) throw new Error('Niste prijavljeni.')

        await updateDoc(doc(db, 'korisnici', user.value.uid), { ime, prezime })

        await updateProfile(user.value, { displayName: `${ime} ${prezime}`.trim() })
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password)
    }

    function logout() {
        return signOut(auth)
    }

    return {
        user,
        profil,
        punoIme,
        authReady,
        isLoggedIn,
        whenAuthReady,
        register,
        azurirajProfil,
        login,
        logout,
    }
})

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}
