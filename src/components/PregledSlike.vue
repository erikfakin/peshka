<script setup>
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

defineProps({
    // { url, opis } ili null kad je pregled zatvoren
    slika: { type: Object, default: null },
})

const emit = defineEmits(['update:slika'])
</script>

<template>
    <Dialog :open="!!slika" @update:open="emit('update:slika', null)">
        <DialogContent class="w-auto max-w-[95vw] p-2 sm:max-w-[90vw]">
            <DialogTitle class="sr-only">{{ slika?.opis }}</DialogTitle>
            <img v-if="slika" :src="slika.url" :alt="slika.opis"
                class="max-h-[85vh] w-auto max-w-full rounded-lg object-contain" />
        </DialogContent>
    </Dialog>
</template>
