<script setup lang="ts">
import MapPicker from '@/components/MapPicker.vue';
import { ref, watch } from 'vue';

const lokacija = ref()

watch(lokacija, (oldV, newV) => {
    console.log(newV)
})
</script>

<template>

    <MapPicker v-model="lokacija" />
</template>