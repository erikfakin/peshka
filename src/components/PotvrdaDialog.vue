<script setup>
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

defineProps({
    open: Boolean,
    naslov: { type: String, default: 'Jeste li sigurni?' },
    opis: { type: String, default: '' },
    potvrdi: { type: String, default: 'Obriši' },
})

const emit = defineEmits(['update:open', 'potvrda'])
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>{{ naslov }}</DialogTitle>
                <DialogDescription v-if="opis">{{ opis }}</DialogDescription>
            </DialogHeader>

            <DialogFooter>
                <Button variant="outline" @click="emit('update:open', false)">Odustani</Button>
                <Button variant="destructive" @click="emit('potvrda')">{{ potvrdi }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
