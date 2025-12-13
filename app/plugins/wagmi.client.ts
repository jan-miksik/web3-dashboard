import { defineNuxtPlugin } from '#app'
import { WagmiPlugin } from '@wagmi/vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { defaultWagmiConfig, getWagmiAdapter } from '~/utils/wagmi'

export default defineNuxtPlugin(nuxtApp => {
  const runtimeConfig = useRuntimeConfig()
  const projectId = runtimeConfig.public.reownProjectId
  const queryClient = new QueryClient()

  const wagmiConfig = projectId ? getWagmiAdapter(projectId).wagmiConfig : defaultWagmiConfig
  nuxtApp.vueApp.use(WagmiPlugin, { config: wagmiConfig })
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
})
