import { ref } from 'vue'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useFlashStore = defineStore('flash', () => {
    const flash = ref(null) // { message: string, type: 'success' | 'error' }

    function setFlash(message, type = 'success') {
        flash.value = { message, type }
    }

    function clearFlash() {
        flash.value = null
    }

    return { flash, setFlash, clearFlash }
})

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useFlashStore, import.meta.hot))
}