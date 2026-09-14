<script setup>
import AppHeader from '@/components/AppHeader.vue'
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
    <AppHeader />
    <Toaster position="top-center" />
    <RouterView />
</template>
