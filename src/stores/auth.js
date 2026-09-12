import { computed, ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from 'firebase/auth'

import { auth } from '@/firebase.js'

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

    function register(email, password) {
        return createUserWithEmailAndPassword(auth, email, password)
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