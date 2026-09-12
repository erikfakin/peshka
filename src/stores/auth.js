import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth'

import { auth, db } from '@/firebase.js'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null)
    const authReady = ref(false)

    const isLoggedIn = computed(() => user.value !== null)

    onAuthStateChanged(auth, (firebaseUser) => {
        user.value = firebaseUser
    })

    const readyPromise = auth.authStateReady().then(() => {
        user.value = auth.currentUser
        authReady.value = true
    })

    function whenAuthReady() {
        return readyPromise.then(() => user.value)
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
        } catch (e) {
            console.error('Profil nije spremljen:', e)
        }
        return cred
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password)
    }

    function logout() {
        return signOut(auth)
    }

    return {
        user,
        authReady,
        isLoggedIn,
        whenAuthReady,
        register,
        login,
        logout,
    }
})

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
}