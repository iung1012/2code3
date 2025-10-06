import { WebContainer } from '@webcontainer/api'

class WebContainerManager {
  private static instance: WebContainerManager
  private webcontainer: WebContainer | null = null
  private isBooting = false
  private bootPromise: Promise<WebContainer> | null = null
  private lastCodeHash: string | null = null

  private constructor() {}

  static getInstance(): WebContainerManager {
    if (!WebContainerManager.instance) {
      WebContainerManager.instance = new WebContainerManager()
    }
    return WebContainerManager.instance
  }

  async getWebContainer(codeHash?: string): Promise<WebContainer> {
    // Se já temos uma instância e o código não mudou, retornar ela
    if (this.webcontainer && (!codeHash || codeHash === this.lastCodeHash)) {
      console.log('[WebContainer] Reusing existing instance')
      return this.webcontainer
    }

    // Se já está bootando, aguardar o boot atual
    if (this.isBooting && this.bootPromise) {
      console.log('[WebContainer] Waiting for existing boot process...')
      return this.bootPromise
    }

    // Se o código mudou, fazer teardown da instância anterior
    if (this.webcontainer && codeHash && codeHash !== this.lastCodeHash) {
      console.log('[WebContainer] Code changed, tearing down previous instance...')
      await this.teardown()
    }

    // Iniciar novo boot
    console.log('[WebContainer] Starting new boot process...')
    this.isBooting = true
    this.bootPromise = this.bootWebContainer()

    try {
      this.webcontainer = await this.bootPromise
      this.lastCodeHash = codeHash || null
      console.log('[WebContainer] Boot completed successfully')
      return this.webcontainer
    } catch (error) {
      console.error('[WebContainer] Boot failed:', error)
      // Se o erro for sobre instância única, tentar reutilizar a existente
      if (error instanceof Error && error.message.includes('Only a single WebContainer instance can be booted')) {
        console.log('[WebContainer] Single instance error detected, attempting to reuse existing instance...')
        // Tentar obter a instância existente se ela existir
        if (this.webcontainer) {
          console.log('[WebContainer] Reusing existing instance after error')
          return this.webcontainer
        }
      }
      this.isBooting = false
      this.bootPromise = null
      throw error
    } finally {
      this.isBooting = false
      this.bootPromise = null
    }
  }

  private async bootWebContainer(): Promise<WebContainer> {
    try {
      console.log('[WebContainer] Booting new instance...')
      const webcontainer = await WebContainer.boot({
        coep: 'require-corp',
      })
      console.log('[WebContainer] Successfully booted')
      return webcontainer
    } catch (error) {
      console.error('[WebContainer] Boot failed:', error)
      throw error
    }
  }

  async teardown(): Promise<void> {
    if (this.webcontainer) {
      try {
        console.log('[WebContainer] Tearing down instance...')
        await this.webcontainer.teardown()
        console.log('[WebContainer] Successfully torn down')
      } catch (error) {
        console.error('[WebContainer] Teardown failed:', error)
      } finally {
        this.webcontainer = null
      }
    }
  }

  async forceRestart(): Promise<WebContainer> {
    console.log('[WebContainer] Force restart requested...')
    await this.teardown()
    this.lastCodeHash = null
    return this.getWebContainer()
  }

  isReady(): boolean {
    return this.webcontainer !== null
  }

  getInstance(): WebContainer | null {
    return this.webcontainer
  }
}

export const webContainerManager = WebContainerManager.getInstance()
