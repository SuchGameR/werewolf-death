<template>
  <div class="vote-progress" v-html="html" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  votes: Record<string, string>
  eligibleNames: string[]
}>()

function avatarHTML(name: string, size: number): string {
  const { avatarHTML } = useUtils()
  return avatarHTML(name, size)
}

const html = computed(() => {
  const items = props.eligibleNames.map(name => {
    const val = props.votes[name]
    let dotClass = 'pending'
    let label = '未'
    if (val === 'yes' || (val && val !== '' && val !== 'no')) { dotClass = 'yes'; label = '⭕' }
    else if (val === 'no') { dotClass = 'no'; label = '❌' }
    else if (val === '') { dotClass = 'abstain'; label = '—' }
    return `<div class="vote-progress-item">${avatarHTML(name, 20)}<span class="vote-dot ${dotClass}"></span><span class="text-sm">${label}</span></div>`
  })
  if (items.length === 0) return ''
  return items.join('')
})
</script>
