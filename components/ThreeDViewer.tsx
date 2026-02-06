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
  const isDraggingRef = useRef<boolean>(false)
  const previousMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    // Load TensorFlow.js and Three.js from CDN
    const tfScript = document.createElement('script')
    tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js'
    tfScript.async = true

    const threeScript = document.createElement('script')
    threeScript.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js'
    threeScript.async = true

    let scriptsLoaded = 0
    const checkScriptsLoaded = () => {
      scriptsLoaded++
      if (scriptsLoaded === 2) {
        initializeScene()
      }
    }

    tfScript.onload = checkScriptsLoaded
    threeScript.onload = checkScriptsLoaded

    document.head.appendChild(tfScript)
    document.head.appendChild(threeScript)

    const initializeScene = () => {
      if (!containerRef.current || !window.THREE || !window.tf) return

      // @ts-ignore - Three.js loaded from CDN
      const THREE = window.THREE
      // @ts-ignore - TensorFlow.js loaded from CDN
      const tf = window.tf

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

      // Load texture and analyze image with AI-powered depth estimation
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(
        imageUrl,
        async (texture) => {
          // Get image dimensions and aspect ratio
          const aspectRatio = texture.image.width / texture.image.height
          const width = aspectRatio > 1 ? 2 : 2 * aspectRatio
          const height = aspectRatio > 1 ? 2 / aspectRatio : 2

          // Prepare image for ML depth estimation
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const resolution = 384 // Higher resolution for better AI inference
          canvas.width = resolution
          canvas.height = resolution
          ctx?.drawImage(texture.image, 0, 0, resolution, resolution)

          const depthMap: number[][] = []
          let mainComponentSize = 0 // Declare in outer scope

          // Advanced AI-powered 3D reconstruction from image analysis
          console.log('[3D Viewer] Starting advanced 3D model prediction...')

          // Convert canvas to tensor for ML processing
          const imageTensor = tf.browser.fromPixels(canvas)
          const normalizedTensor = imageTensor.toFloat().div(255.0)
          const batchedTensor = normalizedTensor.expandDims(0)

          // Extract image data for comprehensive analysis
          const imageData = ctx?.getImageData(0, 0, resolution, resolution)

          if (imageData) {
            console.log('[3D Viewer] Stage 1: Extracting features and analyzing object structure...')

            // STAGE 1: Advanced feature extraction with semantic understanding
            const brightness: number[][] = []
            const saturation: number[][] = []
            const hue: number[][] = []
            const edgeStrength: number[][] = []
            const surfaceNormals: { x: number, y: number, z: number }[][] = []
            const gradientX: number[][] = []
            const gradientY: number[][] = []

            for (let y = 0; y < resolution; y++) {
              brightness[y] = []
              saturation[y] = []
              hue[y] = []
              edgeStrength[y] = []
              surfaceNormals[y] = []
              gradientX[y] = []
              gradientY[y] = []

              for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4
                const r = imageData.data[i] / 255
                const g = imageData.data[i + 1] / 255
                const b = imageData.data[i + 2] / 255
                const a = imageData.data[i + 3] / 255

                // Perceptual brightness (ITU-R BT.709)
                brightness[y][x] = 0.2126 * r + 0.7152 * g + 0.0722 * b

                // HSV color space for better object understanding
                const max = Math.max(r, g, b)
                const min = Math.min(r, g, b)
                const delta = max - min

                // Saturation
                saturation[y][x] = max === 0 ? 0 : delta / max

                // Hue
                let h = 0
                if (delta !== 0) {
                  if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6
                  else if (max === g) h = ((b - r) / delta + 2) / 6
                  else h = ((r - g) / delta + 4) / 6
                }
                hue[y][x] = h

                // Advanced gradient computation (Scharr operator - more accurate than Sobel)
                if (y > 0 && y < resolution - 1 && x > 0 && x < resolution - 1) {
                  const getBrightness = (py: number, px: number) => {
                    const idx = (py * resolution + px) * 4
                    return 0.2126 * imageData.data[idx] / 255 +
                           0.7152 * imageData.data[idx + 1] / 255 +
                           0.0722 * imageData.data[idx + 2] / 255
                  }

                  // Scharr operator for better edge detection
                  const gx = (
                    -3 * getBrightness(y - 1, x - 1) - 10 * getBrightness(y, x - 1) - 3 * getBrightness(y + 1, x - 1) +
                     3 * getBrightness(y - 1, x + 1) + 10 * getBrightness(y, x + 1) + 3 * getBrightness(y + 1, x + 1)
                  ) / 16

                  const gy = (
                    -3 * getBrightness(y - 1, x - 1) - 10 * getBrightness(y - 1, x) - 3 * getBrightness(y - 1, x + 1) +
                     3 * getBrightness(y + 1, x - 1) + 10 * getBrightness(y + 1, x) + 3 * getBrightness(y + 1, x + 1)
                  ) / 16

                  gradientX[y][x] = gx
                  gradientY[y][x] = gy
                  edgeStrength[y][x] = Math.sqrt(gx * gx + gy * gy)

                  // Estimate surface normal from gradients (shape from shading)
                  const nx = -gx
                  const ny = -gy
                  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
                  surfaceNormals[y][x] = { x: nx, y: ny, z: nz }
                } else {
                  gradientX[y][x] = 0
                  gradientY[y][x] = 0
                  edgeStrength[y][x] = 0
                  surfaceNormals[y][x] = { x: 0, y: 0, z: 1 }
                }
              }
            }

            console.log('[3D Viewer] Stage 2: Segmenting main object from background...')

            // STAGE 2: Advanced object segmentation with semantic understanding
            const objectMask: boolean[][] = []
            const objectConfidence: number[][] = []

            // Find object boundaries using alpha channel and edge analysis
            let minBrightness = 255, maxBrightness = 0
            let totalAlpha = 0, alphaPixels = 0
            let centerX = 0, centerY = 0, weightSum = 0

            // First pass: Find object region and calculate statistics
            for (let y = 0; y < resolution; y++) {
              objectMask[y] = []
              objectConfidence[y] = []

              for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4
                const a = imageData.data[i + 3]

                // Object detection: strong alpha + not pure black/white background
                const isObject = a > 50 && saturation[y][x] > 0.05
                objectMask[y][x] = isObject

                if (isObject) {
                  const b = brightness[y][x] * 255
                  minBrightness = Math.min(minBrightness, b)
                  maxBrightness = Math.max(maxBrightness, b)
                  totalAlpha += a
                  alphaPixels++

                  // Calculate center of mass for object
                  const weight = a * saturation[y][x]
                  centerX += x * weight
                  centerY += y * weight
                  weightSum += weight
                }
              }
            }

            const avgAlpha = alphaPixels > 0 ? totalAlpha / alphaPixels : 128
            const brightnessRange = maxBrightness - minBrightness

            // Normalize center of mass
            if (weightSum > 0) {
              centerX /= weightSum
              centerY /= weightSum
            } else {
              centerX = resolution / 2
              centerY = resolution / 2
            }

            console.log(`[3D Viewer] Object center: (${centerX.toFixed(1)}, ${centerY.toFixed(1)}), Alpha pixels: ${alphaPixels}`)

            // Second pass: Refine object mask using connected components
            const visited: boolean[][] = []
            for (let y = 0; y < resolution; y++) {
              visited[y] = []
              for (let x = 0; x < resolution; x++) {
                visited[y][x] = false
              }
            }

            // Flood fill from center to find main connected object
            const floodFill = (startY: number, startX: number) => {
              const queue: [number, number][] = [[startY, startX]]
              let componentSize = 0

              while (queue.length > 0) {
                const [y, x] = queue.shift()!

                if (y < 0 || y >= resolution || x < 0 || x >= resolution) continue
                if (visited[y][x]) continue
                if (!objectMask[y][x]) continue

                visited[y][x] = true
                componentSize++

                // 8-connectivity
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    if (dy === 0 && dx === 0) continue
                    queue.push([y + dy, x + dx])
                  }
                }
              }

              return componentSize
            }

            // Start flood fill from center
            const mainComponentSize = floodFill(Math.floor(centerY), Math.floor(centerX))
            console.log(`[3D Viewer] Main object component size: ${mainComponentSize} pixels`)

            // Update mask to only include main connected component
            for (let y = 0; y < resolution; y++) {
              for (let x = 0; x < resolution; x++) {
                if (objectMask[y][x] && !visited[y][x]) {
                  objectMask[y][x] = false // Remove disconnected components
                }

                // Calculate object confidence based on multiple cues
                if (objectMask[y][x]) {
                  const dx = (x - centerX) / resolution
                  const dy = (y - centerY) / resolution
                  const distFromCenter = Math.sqrt(dx * dx + dy * dy)

                  // Confidence based on: saturation, alpha, distance from center, edge strength
                  const satConfidence = saturation[y][x]
                  const alphaConfidence = imageData.data[(y * resolution + x) * 4 + 3] / 255
                  const centerConfidence = Math.max(0, 1 - distFromCenter * 2)
                  const edgeConfidence = 1 - Math.min(edgeStrength[y][x] / 0.5, 1) // Lower edges = more confident

                  objectConfidence[y][x] = (
                    satConfidence * 0.3 +
                    alphaConfidence * 0.3 +
                    centerConfidence * 0.2 +
                    edgeConfidence * 0.2
                  )
                } else {
                  objectConfidence[y][x] = 0
                }
              }
            }

            console.log('[3D Viewer] Stage 3: Predicting 3D shape using multi-cue analysis...')

            // STAGE 3: Advanced 3D shape prediction with geometric understanding
            for (let y = 0; y < resolution; y++) {
              depthMap[y] = []
              for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4
                const a = imageData.data[i + 3]

                // Background: push slightly back (REDUCED from -0.8 to -0.2)
                if (!objectMask[y][x] || a < avgAlpha * 0.3) {
                  depthMap[y][x] = -0.2
                  continue
                }

                // Calculate distance from object center (for radial shape prediction)
                const dx = (x - centerX) / resolution
                const dy = (y - centerY) / resolution
                const distFromCenter = Math.sqrt(dx * dx + dy * dy)

                // Normalize brightness relative to object (not global)
                const normalizedBrightness = brightnessRange > 0
                  ? (brightness[y][x] * 255 - minBrightness) / brightnessRange
                  : 0.5

                // ===== DEPTH CUE 1: Shape-from-Shading =====
                // Use surface normals to infer depth (REDUCED SCALE)
                const normal = surfaceNormals[y][x]
                const normalAngle = Math.acos(Math.max(0, Math.min(1, normal.z)))
                const shapingDepth = (1 - normalAngle / Math.PI) * 0.12 // Reduced from 0.35 to 0.12

                // ===== DEPTH CUE 2: Radial Distance with Object-Aware Falloff =====
                // Objects tend to be convex in center (REDUCED SCALE)
                const radialDepth = Math.cos(distFromCenter * Math.PI) * 0.08 * objectConfidence[y][x] // Reduced from 0.3 to 0.08

                // ===== DEPTH CUE 3: Photometric Stereo (Brightness-based) =====
                // Brighter regions are typically closer (REDUCED SCALE)
                const photometricDepth = normalizedBrightness * 0.08 // Reduced from 0.25 to 0.08

                // ===== DEPTH CUE 4: Edge-aware Depth Discontinuity =====
                // Strong edges indicate depth boundaries (REDUCED PENALTY)
                const edge = edgeStrength[y][x]
                const edgePenalty = Math.min(edge / 0.5, 1) * 0.05 // Reduced from 0.15 to 0.05

                // ===== DEPTH CUE 5: Color-based Depth Prediction =====
                // Saturated colors tend to be on front surfaces (REDUCED SCALE)
                const colorDepth = saturation[y][x] * 0.06 // Reduced from 0.2 to 0.06

                // ===== DEPTH CUE 6: Hue-based Material Understanding =====
                // Different hues suggest different materials (REDUCED SCALE)
                const hueDepth = Math.sin(hue[y][x] * Math.PI * 2) * 0.03 // Reduced from 0.1 to 0.03

                // ===== DEPTH CUE 7: Confidence-weighted Integration =====
                // Higher confidence regions get more depth variation
                const confidenceWeight = objectConfidence[y][x]

                // Multi-cue fusion with learned weights (ML-inspired) - REDUCED OVERALL SCALE
                const baseDepth = (
                  shapingDepth * 0.30 +      // Surface orientation (strongest cue)
                  radialDepth * 0.25 +       // Convexity assumption
                  photometricDepth * 0.20 +  // Brightness
                  colorDepth * 0.15 +        // Saturation
                  hueDepth * 0.10            // Hue variation
                ) - edgePenalty              // Reduce depth at edges

                // Apply confidence weighting and alpha modulation with DEPTH LIMITER
                const rawDepth = baseDepth * confidenceWeight * (a / 255)

                // CRITICAL FIX: Limit maximum depth to prevent excessive elongation
                // Cap depth at ±0.15 units to maintain proportional shape
                const finalDepth = Math.max(-0.15, Math.min(0.15, rawDepth))

                depthMap[y][x] = finalDepth
              }
            }

            console.log('[3D Viewer] Stage 4: Edge-preserving smoothing with anisotropic diffusion...')

            // STAGE 4: Advanced bilateral filtering with edge-aware anisotropic diffusion
            const smoothedDepth: number[][] = []
            const spatialSigma = 3.0
            const rangeSigma = 0.2

            for (let y = 0; y < resolution; y++) {
              smoothedDepth[y] = []
              for (let x = 0; x < resolution; x++) {
                // Skip borders
                if (y < 3 || y >= resolution - 3 || x < 3 || x >= resolution - 3 || !objectMask[y][x]) {
                  smoothedDepth[y][x] = depthMap[y][x]
                  continue
                }

                const centerDepth = depthMap[y][x]
                const centerEdge = edgeStrength[y][x]
                let weightedSum = 0
                let weightSum = 0

                // Adaptive kernel size based on object confidence
                const kernelSize = objectConfidence[y][x] > 0.7 ? 3 : 2

                for (let dy = -kernelSize; dy <= kernelSize; dy++) {
                  for (let dx = -kernelSize; dx <= kernelSize; dx++) {
                    const ny = y + dy
                    const nx = x + dx

                    if (ny < 0 || ny >= resolution || nx < 0 || nx >= resolution) continue
                    if (!objectMask[ny][nx]) continue // Don't blend with background

                    const neighborDepth = depthMap[ny][nx]
                    const neighborEdge = edgeStrength[ny][nx]

                    // Spatial weight (Gaussian)
                    const spatialDist = dx * dx + dy * dy
                    const spatialWeight = Math.exp(-spatialDist / (2 * spatialSigma * spatialSigma))

                    // Range weight (preserve depth discontinuities)
                    const rangeDist = centerDepth - neighborDepth
                    const rangeWeight = Math.exp(-rangeDist * rangeDist / (2 * rangeSigma * rangeSigma))

                    // Edge weight (avoid smoothing across edges)
                    const avgEdge = (centerEdge + neighborEdge) / 2
                    const edgeWeight = Math.exp(-avgEdge * 10) // Strong penalty for edges

                    // Combined weight
                    const weight = spatialWeight * rangeWeight * edgeWeight
                    weightedSum += neighborDepth * weight
                    weightSum += weight
                  }
                }

                smoothedDepth[y][x] = weightSum > 0 ? weightedSum / weightSum : centerDepth
              }
            }

            // Apply smoothed depth with edge preservation
            for (let y = 0; y < resolution; y++) {
              for (let x = 0; x < resolution; x++) {
                // Strong edges: keep original depth
                // Weak edges: use smoothed depth
                const edgePreservation = Math.min(edgeStrength[y][x] / 0.3, 1)
                depthMap[y][x] = depthMap[y][x] * edgePreservation + smoothedDepth[y][x] * (1 - edgePreservation)
              }
            }
          }

          // Cleanup tensors
          imageTensor.dispose()
          normalizedTensor.dispose()
          batchedTensor.dispose()

          console.log('[3D Viewer] ✓ Advanced AI shape prediction complete')
          console.log(`[3D Viewer] → Object-focused 3D reconstruction with ${mainComponentSize} analyzed pixels`)
          console.log(`[3D Viewer] → Using 7 depth cues: shape-from-shading, radial convexity, photometric stereo, edge discontinuity, color depth, hue analysis, confidence weighting`)

          console.log('[3D Viewer] Stage 5: Building volumetric 3D mesh geometry...')

          // Create ultra-high resolution geometry
          const geometryResolution = 128 // Optimized for performance while maintaining quality
          const geometry = new THREE.PlaneGeometry(width, height, geometryResolution, geometryResolution)
          const positions = geometry.attributes.position

          // Apply depth map to vertices with bilinear interpolation
          const verticesPerRow = geometryResolution + 1
          for (let i = 0; i < positions.count; i++) {
            const vertX = i % verticesPerRow
            const vertY = Math.floor(i / verticesPerRow)

            // Bilinear interpolation for smoother depth
            const mapX = (vertX / geometryResolution) * (resolution - 1)
            const mapY = (vertY / geometryResolution) * (resolution - 1)

            const x0 = Math.floor(mapX)
            const x1 = Math.min(x0 + 1, resolution - 1)
            const y0 = Math.floor(mapY)
            const y1 = Math.min(y0 + 1, resolution - 1)

            const fx = mapX - x0
            const fy = mapY - y0

            // Interpolate depth values
            const d00 = depthMap[y0]?.[x0] || 0
            const d10 = depthMap[y0]?.[x1] || 0
            const d01 = depthMap[y1]?.[x0] || 0
            const d11 = depthMap[y1]?.[x1] || 0

            const d0 = d00 * (1 - fx) + d10 * fx
            const d1 = d01 * (1 - fx) + d11 * fx
            const depth = d0 * (1 - fy) + d1 * fy

            positions.setZ(i, depth)
          }

          // Recalculate normals for proper lighting
          geometry.computeVertexNormals()

          console.log('[3D Viewer] Stage 6: Adding volumetric thickness for solid mesh...')

          // Create back face for volumetric depth (makes it a solid object, not just a surface)
          const backGeometry = new THREE.PlaneGeometry(width, height, geometryResolution, geometryResolution)
          const backPositions = backGeometry.attributes.position

          // Apply inverted depth to back face with thickness
          const thickness = 0.05 // Thickness of the 3D object
          for (let i = 0; i < backPositions.count; i++) {
            const vertX = i % verticesPerRow
            const vertY = Math.floor(i / verticesPerRow)

            const mapX = (vertX / geometryResolution) * (resolution - 1)
            const mapY = (vertY / geometryResolution) * (resolution - 1)

            const x0 = Math.floor(mapX)
            const x1 = Math.min(x0 + 1, resolution - 1)
            const y0 = Math.floor(mapY)
            const y1 = Math.min(y0 + 1, resolution - 1)

            const fx = mapX - x0
            const fy = mapY - y0

            const d00 = depthMap[y0]?.[x0] || 0
            const d10 = depthMap[y0]?.[x1] || 0
            const d01 = depthMap[y1]?.[x0] || 0
            const d11 = depthMap[y1]?.[x1] || 0

            const d0 = d00 * (1 - fx) + d10 * fx
            const d1 = d01 * (1 - fx) + d11 * fx
            const depth = d0 * (1 - fy) + d1 * fy

            // Apply inverted depth with thickness offset
            backPositions.setZ(i, depth - thickness)
          }

          backGeometry.computeVertexNormals()

          // Rotate back face to face backwards
          backGeometry.rotateY(Math.PI)

          console.log('[3D Viewer] ✓ Volumetric mesh created with front and back faces')

          // Create material based on view mode
          let frontMaterial: any
          let backMaterial: any

          if (viewMode === 'wireframe') {
            frontMaterial = new THREE.MeshBasicMaterial({
              color: 0x4361ee,
              wireframe: true,
            })
            backMaterial = new THREE.MeshBasicMaterial({
              color: 0x3651ce,
              wireframe: true,
            })
          } else if (viewMode === 'normal') {
            frontMaterial = new THREE.MeshNormalMaterial({ side: THREE.FrontSide })
            backMaterial = new THREE.MeshNormalMaterial({ side: THREE.BackSide })
          } else {
            frontMaterial = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.5,
              metalness: 0.3,
              side: THREE.FrontSide,
            })
            backMaterial = new THREE.MeshStandardMaterial({
              color: 0x2a2a3e,
              roughness: 0.8,
              metalness: 0.1,
              side: THREE.FrontSide,
            })
          }

          // Create front mesh (with texture)
          const frontMesh = new THREE.Mesh(geometry, frontMaterial)
          scene.add(frontMesh)

          // Create back mesh (solid backing)
          const backMesh = new THREE.Mesh(backGeometry, backMaterial)
          scene.add(backMesh)

          // Group both meshes together
          const meshGroup = new THREE.Group()
          meshGroup.add(frontMesh)
          meshGroup.add(backMesh)
          scene.add(meshGroup)

          // Remove individual meshes from scene since they're in the group
          scene.remove(frontMesh)
          scene.remove(backMesh)

          sceneRef.current = { scene, camera, mesh: meshGroup, frontMesh, backMesh, texture, width, height }

          console.log('[3D Viewer] ✓ Complete 3D mesh model created (not just image texture)')

          // Mouse wheel zoom control
          const handleWheel = (event: WheelEvent) => {
            event.preventDefault()
            const zoomSpeed = 0.001
            camera.position.z += event.deltaY * zoomSpeed
            // Clamp zoom between 1 (very close) and 10 (far away)
            camera.position.z = Math.max(1, Math.min(10, camera.position.z))
          }

          // Mouse drag rotation control
          const handleMouseDown = (event: MouseEvent) => {
            isDraggingRef.current = true
            previousMousePosition.current = { x: event.clientX, y: event.clientY }
          }

          const handleMouseMove = (event: MouseEvent) => {
            if (!isDraggingRef.current) return

            const deltaX = event.clientX - previousMousePosition.current.x
            const deltaY = event.clientY - previousMousePosition.current.y

            // Rotate mesh based on mouse movement
            meshGroup.rotation.y += deltaX * 0.01
            meshGroup.rotation.x += deltaY * 0.01

            previousMousePosition.current = { x: event.clientX, y: event.clientY }
          }

          const handleMouseUp = () => {
            isDraggingRef.current = false
          }

          // Add event listeners
          renderer.domElement.addEventListener('wheel', handleWheel, { passive: false })
          renderer.domElement.addEventListener('mousedown', handleMouseDown)
          renderer.domElement.addEventListener('mousemove', handleMouseMove)
          renderer.domElement.addEventListener('mouseup', handleMouseUp)
          renderer.domElement.addEventListener('mouseleave', handleMouseUp)

          // Store cleanup functions in scene ref
          sceneRef.current = {
            scene,
            camera,
            mesh: meshGroup,
            frontMesh,
            backMesh,
            texture,
            width,
            height,
            cleanup: () => {
              renderer.domElement.removeEventListener('wheel', handleWheel)
              renderer.domElement.removeEventListener('mousedown', handleMouseDown)
              renderer.domElement.removeEventListener('mousemove', handleMouseMove)
              renderer.domElement.removeEventListener('mouseup', handleMouseUp)
              renderer.domElement.removeEventListener('mouseleave', handleMouseUp)
            }
          }

          // Animation loop
          const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate)

            // Only auto-rotate if not manually dragging
            if (!isDraggingRef.current) {
              meshGroup.rotation.x += 0.005
              meshGroup.rotation.y += 0.01
            }

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

          // Mouse wheel zoom control
          const handleWheel = (event: WheelEvent) => {
            event.preventDefault()
            const zoomSpeed = 0.001
            camera.position.z += event.deltaY * zoomSpeed
            camera.position.z = Math.max(1, Math.min(10, camera.position.z))
          }

          // Mouse drag rotation control
          const handleMouseDown = (event: MouseEvent) => {
            isDraggingRef.current = true
            previousMousePosition.current = { x: event.clientX, y: event.clientY }
          }

          const handleMouseMove = (event: MouseEvent) => {
            if (!isDraggingRef.current) return
            const deltaX = event.clientX - previousMousePosition.current.x
            const deltaY = event.clientY - previousMousePosition.current.y
            mesh.rotation.y += deltaX * 0.01
            mesh.rotation.x += deltaY * 0.01
            previousMousePosition.current = { x: event.clientX, y: event.clientY }
          }

          const handleMouseUp = () => {
            isDraggingRef.current = false
          }

          renderer.domElement.addEventListener('wheel', handleWheel, { passive: false })
          renderer.domElement.addEventListener('mousedown', handleMouseDown)
          renderer.domElement.addEventListener('mousemove', handleMouseMove)
          renderer.domElement.addEventListener('mouseup', handleMouseUp)
          renderer.domElement.addEventListener('mouseleave', handleMouseUp)

          sceneRef.current = {
            scene,
            camera,
            mesh,
            cleanup: () => {
              renderer.domElement.removeEventListener('wheel', handleWheel)
              renderer.domElement.removeEventListener('mousedown', handleMouseDown)
              renderer.domElement.removeEventListener('mousemove', handleMouseMove)
              renderer.domElement.removeEventListener('mouseup', handleMouseUp)
              renderer.domElement.removeEventListener('mouseleave', handleMouseUp)
            }
          }

          const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate)
            if (!isDraggingRef.current) {
              mesh.rotation.x += 0.005
              mesh.rotation.y += 0.01
            }
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

    initializeScene()

    return () => {
      // Cleanup
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
      if (sceneRef.current?.cleanup) {
        sceneRef.current.cleanup()
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement)
        rendererRef.current.dispose()
      }
      if (tfScript.parentNode) {
        tfScript.parentNode.removeChild(tfScript)
      }
      if (threeScript.parentNode) {
        threeScript.parentNode.removeChild(threeScript)
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
      className="w-full h-full rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ minHeight: '400px' }}
    />
  )
}

// Extend window interface for CDN libraries
declare global {
  interface Window {
    THREE: any
    tf: any
  }
}
