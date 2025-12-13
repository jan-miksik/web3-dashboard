import { defineNuxtPlugin } from '#app'
import { WagmiPlugin } from '@wagmi/vue'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { defaultWagmiConfig, getWagmiAdapter } from '~/utils/wagmi'
import { logger } from '~/utils/logger'

export default defineNuxtPlugin(nuxtApp => {
  const runtimeConfig = useRuntimeConfig()
  const projectId = runtimeConfig.public.reownProjectId
  const queryClient = new QueryClient()

  let wagmiConfig = defaultWagmiConfig

  if (projectId) {
    try {
      const adapter = getWagmiAdapter(projectId)
      if (adapter && 'wagmiConfig' in adapter && adapter.wagmiConfig) {
        wagmiConfig = adapter.wagmiConfig as typeof defaultWagmiConfig
      } else {
        logger.warn('getWagmiAdapter returned invalid result, missing wagmiConfig property', {
          projectId,
        })
      }
    } catch (error) {
      logger.error('Failed to initialize WagmiAdapter', error, {
        projectId,
      })
    }
  }

  nuxtApp.vueApp.use(WagmiPlugin, { config: wagmiConfig })
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
})
