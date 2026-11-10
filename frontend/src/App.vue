<template>
  <div class="app-shell">
    <AppHeader />
    <RouterView />
  </div>
</template>

<script setup>
import AppHeader from './components/AppHeader.vue'
</script>

<style>
#app {
  padding-top: 80px;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.app-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
}
</style>
