<script setup>
import AppHeader from './components/AppHeader.vue';
import FlashMessage from './components/FlashMessage.vue';

</script>

<template>
  <div>
    <AppHeader />
    <FlashMessage />

    <RouterView />


  </div>
</template>

<style scoped></style>
