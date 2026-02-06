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

      // Add rim light for better depth
      const rimLight = new THREE.DirectionalLight(0x4361ee, 0.3)
      rimLight.position.set(-5, 0, -5)
      scene.add(rimLight)

      // Load texture and analyze image
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(
        imageUrl,
        (texture) => {
          // Get image dimensions and aspect ratio
          const aspectRatio = texture.image.width / texture.image.height
          const width = aspectRatio > 1 ? 2 : 2 * aspectRatio
          const height = aspectRatio > 1 ? 2 / aspectRatio : 2

          // Create canvas to analyze image pixels with higher resolution
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const resolution = 128
          canvas.width = resolution
          canvas.height = resolution
          ctx?.drawImage(texture.image, 0, 0, resolution, resolution)
          const imageData = ctx?.getImageData(0, 0, resolution, resolution)

          // Advanced image analysis: edge detection + depth mapping
          const depthMap: number[][] = []
          const edgeMap: number[][] = []
          const objectMask: boolean[][] = []

          if (imageData) {
            // Step 1: Calculate brightness map
            const brightnessMap: number[][] = []
            for (let y = 0; y < resolution; y++) {
              brightnessMap[y] = []
              for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4
                const r = imageData.data[i]
                const g = imageData.data[i + 1]
                const b = imageData.data[i + 2]
                // Perceptual brightness formula (weighted for human eye)
                brightnessMap[y][x] = 0.299 * r + 0.587 * g + 0.114 * b
              }
            }

            // Step 2: Edge detection using Sobel operator to find object boundaries
            for (let y = 0; y < resolution; y++) {
              edgeMap[y] = []
              for (let x = 0; x < resolution; x++) {
                if (y === 0 || y === resolution - 1 || x === 0 || x === resolution - 1) {
                  edgeMap[y][x] = 0
                  continue
                }

                // Sobel kernels for edge detection
                const gx =
                  -brightnessMap[y-1][x-1] + brightnessMap[y-1][x+1] +
                  -2*brightnessMap[y][x-1] + 2*brightnessMap[y][x+1] +
                  -brightnessMap[y+1][x-1] + brightnessMap[y+1][x+1]

                const gy =
                  -brightnessMap[y-1][x-1] - 2*brightnessMap[y-1][x] - brightnessMap[y-1][x+1] +
                  brightnessMap[y+1][x-1] + 2*brightnessMap[y+1][x] + brightnessMap[y+1][x+1]

                edgeMap[y][x] = Math.sqrt(gx * gx + gy * gy)
              }
            }

            // Step 3: Find object region using background detection
            const avgBackgroundBrightness = (() => {
              const borderPixels: number[] = []
              // Sample border pixels to detect background
              for (let x = 0; x < resolution; x++) {
                borderPixels.push(brightnessMap[0][x])
                borderPixels.push(brightnessMap[resolution-1][x])
              }
              for (let y = 1; y < resolution - 1; y++) {
                borderPixels.push(brightnessMap[y][0])
                borderPixels.push(brightnessMap[y][resolution-1])
              }
              return borderPixels.reduce((a, b) => a + b, 0) / borderPixels.length
            })()

            // Create object mask based on difference from background
            for (let y = 0; y < resolution; y++) {
              objectMask[y] = []
              for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4
                const a = imageData.data[i + 3]
                const brightnessDiff = Math.abs(brightnessMap[y][x] - avgBackgroundBrightness)
                const edgeStrength = edgeMap[y][x] || 0

                // Pixel is part of object if: not transparent, different from background, or on an edge
                objectMask[y][x] = a > 50 && (brightnessDiff > 20 || edgeStrength > 30)
              }
            }

            // Step 4: Generate sophisticated depth map
            for (let y = 0; y < resolution; y++) {
              depthMap[y] = []
              for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4
                const r = imageData.data[i]
                const g = imageData.data[i + 1]
                const b = imageData.data[i + 2]
                const a = imageData.data[i + 3]

                const brightness = brightnessMap[y][x]
                const edgeStrength = edgeMap[y][x] || 0
                const isObject = objectMask[y][x]

                if (!isObject || a < 50) {
                  // Background or transparent = recessed
                  depthMap[y][x] = -0.3
                } else {
                  // Calculate distance from center for radial depth
                  const centerX = resolution / 2
                  const centerY = resolution / 2
                  const distFromCenter = Math.sqrt(
                    Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
                  ) / (resolution / 2)

                  // Combine brightness, edge info, and radial distance for depth
                  // Center + brighter = closer, edges + darker = farther
                  const brightnessDepth = (brightness / 255) * 0.6
                  const edgeDepth = (edgeStrength / 255) * 0.4
                  const radialDepth = (1 - distFromCenter * 0.3)

                  depthMap[y][x] = (brightnessDepth + edgeDepth) * radialDepth * (a / 255)
                }
              }
            }
          }

          // Create geometry with higher resolution for better detail
          const geometry = new THREE.PlaneGeometry(width, height, 127, 127)
          const positions = geometry.attributes.position

          // Apply depth map to vertices with interpolation
          for (let i = 0; i < positions.count; i++) {
            const vertX = Math.floor(i % 128)
            const vertY = Math.floor(i / 128)

            // Map vertex coordinates to depth map coordinates
            const depthX = Math.floor((vertX / 127) * (resolution - 1))
            const depthY = Math.floor((vertY / 127) * (resolution - 1))

            if (depthMap[depthY] && depthMap[depthY][depthX] !== undefined) {
              positions.setZ(i, depthMap[depthY][depthX])
            }
          }

          // Recalculate normals for proper lighting
          geometry.computeVertexNormals()

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
              side: THREE.DoubleSide,
            })
          }

          const mesh = new THREE.Mesh(geometry, material)
          scene.add(mesh)
          sceneRef.current = { scene, camera, mesh, texture, width, height }

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
          // Fallback to simple plane
          const geometry = new THREE.PlaneGeometry(2, 2, 32, 32)
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
  }, [imageUrl])

  // Update material when view mode changes
  useEffect(() => {
    if (!sceneRef.current || !window.THREE) return

    // @ts-ignore
    const THREE = window.THREE
    const { mesh, texture } = sceneRef.current

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
      mesh.material = new THREE.MeshNormalMaterial({
        side: THREE.DoubleSide,
      })
    } else {
      // Use existing texture for textured mode
      if (texture) {
        mesh.material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.5,
          metalness: 0.3,
          side: THREE.DoubleSide,
        })
      } else {
        // Reload texture if not available
        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(imageUrl, (newTexture) => {
          mesh.material = new THREE.MeshStandardMaterial({
            map: newTexture,
            roughness: 0.5,
            metalness: 0.3,
            side: THREE.DoubleSide,
          })
        })
      }
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
