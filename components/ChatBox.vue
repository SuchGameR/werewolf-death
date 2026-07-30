<template>
  <div class="chat-container">
    <div id="chatMessages" class="chat-messages" ref="messagesRef">
      <div v-for="(msg, i) in messages" :key="i" class="chat-msg">
        <span class="cname" v-html="nameWithAvatar(msg.userName, 20)" />: {{ esc(msg.message) }}
      </div>
    </div>
    <div class="chat-input-row">
      <input id="chatInput" v-model="text" type="text" class="chat-input" placeholder="チャット..." @keydown.enter="send" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

const props = defineProps<{
  messages: { userName: string; message: string }[]
}>()

const emit = defineEmits<{ send: [message: string] }>()
const text = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const { esc } = useUtils()
const { nameWithAvatar } = useUtils()

function send() {
  const msg = text.value.trim()
  if (!msg) return
  emit('send', msg)
  text.value = ''
}

watch(() => props.messages.length, () => {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
})
</script>
