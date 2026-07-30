<template>
  <div class="title-screen">
    <div class="title-content">
      <div class="logo">
        <div class="logo-icon">🐺</div>
        <h1>Werewolf Death</h1>
        <p class="subtitle">飢餓と裏切りのオンライン人狼</p>
      </div>
      <div class="title-actions">
        <button class="btn btn-primary btn-lg" @click="goLobby">ゲームを開始</button>
      </div>
    </div>
    <div class="title-bg" />
  </div>
</template>

<script setup lang="ts">
function goLobby() {
  navigateTo('/lobby')
}
</script>
