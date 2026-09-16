<script setup>
defineProps({
    ulov: { type: Object, required: true },
})
</script>

<template>
    <span v-if="ulov.pusten"
        class="bg-secondary text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-xs">
        puštena
    </span>
    <span v-if="ulov.vidljivost === 'Privatno'"
        class="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs">
        privatno
    </span>
</template>
