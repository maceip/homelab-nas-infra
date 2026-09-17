// Liquid DOM is decorative only: controls and live text always remain real DOM.
export function supportsLiquidGlass(env = globalThis) {
  return Boolean(env.navigator?.gpu && env.GPUQueue?.prototype?.copyElementImageToTexture)
}

export function mountLiquidGlass(host, { env = globalThis, load = () => import('@liquid-dom/core') } = {}) {
  let disposed = false, device, core, content, canvas, observer, raf = 0
  const motion = env.matchMedia?.('(prefers-reduced-motion: reduce)')
  if (!supportsLiquidGlass(env) || motion?.matches) return () => {}
  const destroy = () => {
    if (disposed) return
    disposed = true
    env.cancelAnimationFrame(raf)
    observer?.disconnect()
    env.document.removeEventListener('visibilitychange', visibility)
    motion?.removeEventListener('change', destroy)
    content?.destroy(); core?.destroy(); device?.destroy(); canvas?.remove()
    host.dataset.glass = 'fallback'
  }
  let draw = () => {}
  const visibility = () => {
    env.cancelAnimationFrame(raf)
    if (!env.document.hidden && !disposed) raf = env.requestAnimationFrame(draw)
  }
  ;(async () => {
    try {
      const lib = await load()
      if (disposed) return
      const adapter = await env.navigator.gpu.requestAdapter()
      if (!adapter || disposed) return
      const nextDevice = await adapter.requestDevice()
      if (disposed) { nextDevice.destroy(); return }
      device = nextDevice
      canvas = env.document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      canvas.className = 'island-liquid-canvas'
      const context = canvas.getContext('webgpu')
      if (!context) { destroy(); return }
      const format = env.navigator.gpu.getPreferredCanvasFormat()
      const dpr = Math.min(env.devicePixelRatio || 1, 1.5)
      const scene = new lib.Scene()
      const backdrop = env.document.createElement('div')
      backdrop.className = 'island-liquid-backdrop'
      const html = new lib.Html({ width: 360, height: 280, element: backdrop, zIndex: -1 })
      scene.add(html)
      const container = new lib.Container({ blur: 5, thickness: 45, tint: { r: 0.85, g: 1, b: 0.95, a: 0.13 }, spacing: 30 })
      const glass = new lib.Glass({ x: 72, y: 40, width: 210, height: 190, cornerRadius: 65, cornerSmoothing: 0.7 })
      container.add(glass); scene.add(container)
      host.prepend(canvas)
      core = new lib.WebGpuGlassCore({ device, format })
      content = new lib.WebGpuDomContentSource({ targetCanvas: canvas, getCurrentDpr: () => dpr, scene })
      content.setDevice(device, format)
      const resize = () => {
        const width = host.clientWidth, height = host.clientHeight
        canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr))
        html.width = width; html.height = height
        backdrop.style.width = width + 'px'; backdrop.style.height = height + 'px'
        glass.x = (width - 210) / 2; glass.y = (height - 190) / 2
        context.configure({ device, format, alphaMode: 'premultiplied', usage: env.GPUTextureUsage.RENDER_ATTACHMENT | env.GPUTextureUsage.COPY_DST | env.GPUTextureUsage.COPY_SRC | env.GPUTextureUsage.TEXTURE_BINDING })
      }
      resize()
      observer = new env.ResizeObserver(resize); observer.observe(host)
      let previous = -100
      draw = timestamp => {
        if (disposed || env.document.hidden) return
        try {
          if (timestamp - previous > 32) {
            glass.rotation = Math.sin(timestamp / 4500) * 0.035
            content.sync(scene)
            core.render({ scene, width: canvas.width, height: canvas.height, dpr, outputTexture: context.getCurrentTexture(), contentSource: content })
            host.dataset.glass = 'webgpu'
            previous = timestamp
          }
          raf = env.requestAnimationFrame(draw)
        } catch { destroy() }
      }
      device.lost.then(destroy)
      device.addEventListener('uncapturederror', destroy)
      motion?.addEventListener('change', destroy)
      env.document.addEventListener('visibilitychange', visibility)
      visibility()
    } catch { destroy() }
  })()
  return destroy
}
