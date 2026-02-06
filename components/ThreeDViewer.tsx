'use client'

import { useEffect, useRef } from 'react'

interface ThreeDViewerProps {
  imageUrl: string
  viewMode: 'textured' | 'wireframe' | 'normal'
}

export default function ThreeDViewer({ imageUrl, viewMode }: ThreeDViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)
  const rendererRef = useRef<any>(null)
  const animationIdRef = useRef<number | null>(null)

  useEffect(() => {
    // Load Three.js from CDN
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js'
    script.async = true

    script.onload = () => {
      if (!containerRef.current || !window.THREE) return

      // @ts-ignore - Three.js loaded from CDN
      const THREE = window.THREE

      // Scene setup
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x0f0f17)

      // Camera
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      )
      camera.position.z = 3

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      containerRef.current.appendChild(renderer.domElement)
      rendererRef.current = renderer

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(5, 5, 5)
      scene.add(directionalLight)

      // Load texture
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(
        imageUrl,
        (texture) => {
          // Create geometry based on image aspect ratio
          const aspectRatio = texture.image.width / texture.image.height
          const width = aspectRatio > 1 ? 2 : 2 * aspectRatio
          const height = aspectRatio > 1 ? 2 / aspectRatio : 2

          // Create 3D extruded geometry
          const geometry = new THREE.BoxGeometry(width, height, 0.3, 32, 32, 32)

          // Material based on view mode
          let material: any

          if (viewMode === 'wireframe') {
            material = new THREE.MeshBasicMaterial({
              color: 0x4361ee,
              wireframe: true,
            })
          } else if (viewMode === 'normal') {
            material = new THREE.MeshNormalMaterial()
          } else {
            material = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.5,
              metalness: 0.3,
            })
          }

          const mesh = new THREE.Mesh(geometry, material)
          scene.add(mesh)
          sceneRef.current = { scene, camera, mesh }

          // Animation loop
          const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate)

            // Rotate mesh
            mesh.rotation.x += 0.005
            mesh.rotation.y += 0.01

            renderer.render(scene, camera)
          }
          animate()
        },
        undefined,
        (error) => {
          console.error('Error loading texture:', error)
          // Fallback to colored cube
          const geometry = new THREE.BoxGeometry(2, 2, 0.3)
          const material = new THREE.MeshStandardMaterial({ color: 0x4361ee })
          const mesh = new THREE.Mesh(geometry, material)
          scene.add(mesh)
          sceneRef.current = { scene, camera, mesh }

          const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate)
            mesh.rotation.x += 0.005
            mesh.rotation.y += 0.01
            renderer.render(scene, camera)
          }
          animate()
        }
      )

      // Handle window resize
      const handleResize = () => {
        if (!containerRef.current || !renderer) return

        const width = containerRef.current.clientWidth
        const height = containerRef.current.clientHeight

        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
        rendererRef.current.dispose()
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [imageUrl, viewMode])

  // Update material when view mode changes
  useEffect(() => {
    if (!sceneRef.current || !window.THREE) return

    // @ts-ignore
    const THREE = window.THREE
    const { mesh } = sceneRef.current

    if (!mesh) return

    // Dispose old material
    if (mesh.material) {
      mesh.material.dispose()
    }

    // Create new material based on view mode
    if (viewMode === 'wireframe') {
      mesh.material = new THREE.MeshBasicMaterial({
        color: 0x4361ee,
        wireframe: true,
      })
    } else if (viewMode === 'normal') {
      mesh.material = new THREE.MeshNormalMaterial()
    } else {
      // Reload texture for textured mode
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(imageUrl, (texture) => {
        mesh.material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.5,
          metalness: 0.3,
        })
      })
    }
  }, [viewMode, imageUrl])

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    />
  )
}

// Extend window interface for Three.js CDN
declare global {
  interface Window {
    THREE: any
  }
}
