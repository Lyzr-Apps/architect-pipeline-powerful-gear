'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Upload, Loader2, CheckCircle, AlertCircle, Download, Eye, Grid, Layers, Settings, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { callAIAgent, uploadFiles } from '@/lib/aiAgent'

// TypeScript interfaces based on actual test response data
interface PreflightAnalysisResult {
  status: 'success' | 'error'
  result: {
    quality_score: number
    background_type: 'simple' | 'complex'
    object_category: string
    needs_enhancement: boolean
    needs_background_removal: boolean
    preprocessed_image_ready: boolean
    recommendations: string
  }
  metadata?: {
    agent_name?: string
    timestamp?: string
  }
}

interface EnhancementResult {
  status: 'success' | 'error'
  result: {
    enhanced: boolean
    original_resolution: string
    enhanced_resolution: string
    quality_improvement_score: number
    enhanced_image_url: string
    processing_time_ms: number
  }
  metadata?: {
    agent_name?: string
    timestamp?: string
  }
}

interface ReconstructionResult {
  status: 'success' | 'error'
  result: {
    reconstruction_status: 'SUCCEEDED' | 'FAILED' | 'IN_PROGRESS'
    api_provider_used: string
    task_id: string
    raw_mesh_url: string
    texture_maps: {
      base_color_url: string
      normal_url: string
      roughness_url: string
      metallic_url: string
    }
    polygon_count: number
    processing_time_seconds: number
    errors: string
  }
  metadata?: {
    agent_name?: string
    timestamp?: string
  }
}

interface RefinementResult {
  status: 'success' | 'error'
  result: {
    optimized: boolean
    original_poly_count: number
    optimized_poly_count: number
    reduction_percentage: number
    texture_validation: {
      base_color_valid: boolean
      normal_valid: boolean
      roughness_valid: boolean
    }
    geometry_issues: string[]
    optimized_mesh_url: string
    processing_time_ms: number
  }
  metadata?: {
    agent_name?: string
    timestamp?: string
  }
}

interface DeploymentResult {
  status: 'success' | 'error'
  result: {
    glb_package: {
      url: string
      file_size_mb: number
      embedded_textures: boolean
    }
    obj_package: {
      obj_url: string
      mtl_url: string
      texture_urls: string[]
      total_size_mb: number
    }
    manifest_url: string
    download_expires_at: string
    deployment_status: 'completed' | 'failed' | 'in_progress'
  }
  metadata?: {
    agent_name?: string
    timestamp?: string
  }
}

interface ProcessLogEntry {
  id: string
  timestamp: string
  stage: string
  status: 'processing' | 'completed' | 'error'
  message: string
  details?: any
}

type ViewMode = 'textured' | 'wireframe' | 'normal'

// Agent IDs from workflow_state.json
const AGENT_IDS = {
  PIPELINE_ORCHESTRATOR: '698596e41caa4e686dd66f72',
  PREFLIGHT_ANALYSIS: '69859686ab4bf65a66ad08ad',
  ENHANCEMENT: '69859695382ef8715224cf63',
  RECONSTRUCTION: '698596a7e17e33c11eed1a9c',
  REFINEMENT: '698596baf7f7d3ffa5d86570',
  DEPLOYMENT: '698596cc07ec48e3dc90a260'
}

export default function Home() {
  // Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [assetId, setAssetId] = useState<string>('')

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStage, setCurrentStage] = useState<string>('')
  const [processLogs, setProcessLogs] = useState<ProcessLogEntry[]>([])

  // Results state
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)
  const [reconstructionResult, setReconstructionResult] = useState<ReconstructionResult | null>(null)

  // Settings state
  const [topologyPreference, setTopologyPreference] = useState<'quad' | 'tri'>('quad')
  const [targetPolyCount, setTargetPolyCount] = useState([25000])

  // 3D Viewer state
  const [viewMode, setViewMode] = useState<ViewMode>('textured')
  const [meshUrl, setMeshUrl] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const logScrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
    }
  }, [processLogs])

  // Add log entry
  const addLog = useCallback((stage: string, status: ProcessLogEntry['status'], message: string, details?: any) => {
    const newLog: ProcessLogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      stage,
      status,
      message,
      details
    }
    setProcessLogs(prev => [...prev, newLog])
  }, [])

  // Handle file drop/select
  const handleFileChange = useCallback(async (file: File | null) => {
    if (!file) return

    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      addLog('Upload', 'error', 'Invalid file type. Please upload .jpg, .png, or .webp')
      return
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      addLog('Upload', 'error', 'File too large. Maximum size is 10MB')
      return
    }

    setUploadedFile(file)
    const preview = URL.createObjectURL(file)
    setPreviewUrl(preview)
    addLog('Upload', 'completed', `Loaded ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
  }, [addLog])

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    handleFileChange(file)
  }, [handleFileChange])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Remove uploaded file
  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null)
    setPreviewUrl('')
    setAssetId('')
    setDeploymentResult(null)
    setReconstructionResult(null)
    setMeshUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Generate 3D Model - Main workflow
  const handleGenerate = async () => {
    if (!uploadedFile) return

    setIsProcessing(true)
    setProcessLogs([])
    setDeploymentResult(null)
    setReconstructionResult(null)
    setMeshUrl('')

    try {
      // Step 1: Upload file
      addLog('Upload', 'processing', 'Uploading image to server...')

      // Add timeout wrapper for upload
      const uploadWithTimeout = async () => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
        )
        const uploadPromise = uploadFiles(uploadedFile)
        return Promise.race([uploadPromise, timeoutPromise])
      }

      const uploadResult = await uploadWithTimeout()

      if (!uploadResult.success || uploadResult.asset_ids.length === 0) {
        addLog('Upload', 'error', uploadResult.error || 'Upload failed - please check your API key configuration')
        setIsProcessing(false)
        return
      }

      const uploadedAssetId = uploadResult.asset_ids[0]
      setAssetId(uploadedAssetId)
      addLog('Upload', 'completed', `Image uploaded successfully (Asset ID: ${uploadedAssetId})`)

      // Step 2: Call Pipeline Orchestrator
      setCurrentStage('Orchestrating Pipeline')
      addLog('Pipeline Orchestrator', 'processing', 'Starting 3D conversion pipeline...')

      const orchestratorResult = await callAIAgent(
        `Process this uploaded product image through the complete 3D pipeline. Settings: topology=${topologyPreference}, target_poly_count=${targetPolyCount[0]}`,
        AGENT_IDS.PIPELINE_ORCHESTRATOR,
        { assets: [uploadedAssetId] }
      )

      if (!orchestratorResult.success) {
        addLog('Pipeline Orchestrator', 'error', orchestratorResult.error || 'Orchestration failed')
        setIsProcessing(false)
        return
      }

      addLog('Pipeline Orchestrator', 'completed', 'Pipeline orchestration started')

      // Step 3: Pre-flight Analysis
      setCurrentStage('Pre-flight Analysis')
      addLog('Pre-flight Analysis', 'processing', 'Analyzing image quality and background...')

      const preflightResult = await callAIAgent(
        `Analyze this uploaded image for 3D reconstruction readiness`,
        AGENT_IDS.PREFLIGHT_ANALYSIS,
        { assets: [uploadedAssetId] }
      )

      if (preflightResult.success && preflightResult.response.status === 'success') {
        const preflightData = preflightResult.response as PreflightAnalysisResult
        addLog(
          'Pre-flight Analysis',
          'completed',
          `Quality Score: ${preflightData.result.quality_score}/100 | Background: ${preflightData.result.background_type} | Category: ${preflightData.result.object_category}`,
          preflightData.result
        )

        // Step 4: Enhancement (conditional)
        if (preflightData.result.needs_enhancement) {
          setCurrentStage('Enhancement')
          addLog('Enhancement', 'processing', 'Enhancing image quality...')

          const enhancementResult = await callAIAgent(
            `Enhance this image for better 3D reconstruction`,
            AGENT_IDS.ENHANCEMENT,
            { assets: [uploadedAssetId] }
          )

          if (enhancementResult.success && enhancementResult.response.status === 'success') {
            const enhancementData = enhancementResult.response as EnhancementResult
            addLog(
              'Enhancement',
              'completed',
              `Enhanced: ${enhancementData.result.original_resolution} → ${enhancementData.result.enhanced_resolution} | Quality +${enhancementData.result.quality_improvement_score}`,
              enhancementData.result
            )
          }
        } else {
          addLog('Enhancement', 'completed', 'Image quality sufficient - skipping enhancement')
        }

        // Step 5: 3D Reconstruction
        setCurrentStage('3D Reconstruction')
        addLog('Reconstruction', 'processing', 'Generating 3D mesh with PBR textures...')

        const reconstructionResult = await callAIAgent(
          `Generate 3D mesh with ${topologyPreference} topology targeting ${targetPolyCount[0]} polygons`,
          AGENT_IDS.RECONSTRUCTION,
          { assets: [uploadedAssetId] }
        )

        console.log('[Pipeline] Reconstruction result:', reconstructionResult)

        if (reconstructionResult.success && reconstructionResult.response.status === 'success') {
          const reconstructionData = reconstructionResult.response as ReconstructionResult
          setReconstructionResult(reconstructionData)
          addLog(
            'Reconstruction',
            'completed',
            `Mesh generated: ${reconstructionData.result.polygon_count.toLocaleString()} polygons | Provider: ${reconstructionData.result.api_provider_used} | Time: ${reconstructionData.result.processing_time_seconds}s`,
            reconstructionData.result
          )

          // Step 6: Mesh Refinement
          setCurrentStage('Mesh Refinement')
          addLog('Refinement', 'processing', 'Optimizing mesh topology and validating textures...')

          const refinementResult = await callAIAgent(
            `Optimize mesh to target ${targetPolyCount[0]} polygons and validate PBR textures`,
            AGENT_IDS.REFINEMENT,
            { assets: [uploadedAssetId] }
          )

          let shouldContinueToDeployment = false

          if (refinementResult.success && refinementResult.response.status === 'success') {
            const refinementData = refinementResult.response as RefinementResult
            addLog(
              'Refinement',
              'completed',
              `Optimized: ${refinementData.result.original_poly_count.toLocaleString()} → ${refinementData.result.optimized_poly_count.toLocaleString()} polygons (-${refinementData.result.reduction_percentage.toFixed(1)}%)`,
              refinementData.result
            )
            shouldContinueToDeployment = true
          } else {
            // Refinement failed, but we can still use the raw reconstruction mesh
            addLog('Refinement', 'error', `${refinementResult.error || 'Refinement failed'} - Using raw reconstruction mesh`)
            addLog('System', 'processing', 'Continuing with unoptimized mesh...')
            shouldContinueToDeployment = true // Continue anyway
          }

          // Step 7: Asset Deployment (continue even if refinement failed)
          if (shouldContinueToDeployment) {
            setCurrentStage('Asset Deployment')
            addLog('Deployment', 'processing', 'Packaging .glb and .obj files for download...')

            const deploymentResult = await callAIAgent(
              `Package mesh into .glb and .obj formats with all PBR textures`,
              AGENT_IDS.DEPLOYMENT,
              { assets: [uploadedAssetId] }
            )

            if (deploymentResult.success && deploymentResult.response.status === 'success') {
              const deploymentData = deploymentResult.response as DeploymentResult
              setDeploymentResult(deploymentData)
              setMeshUrl(deploymentData.result.glb_package.url)
              addLog(
                'Deployment',
                'completed',
                `Ready for download | GLB: ${deploymentData.result.glb_package.file_size_mb} MB | OBJ: ${deploymentData.result.obj_package.total_size_mb} MB`,
                deploymentData.result
              )
              setCurrentStage('Completed')
            } else {
              // If deployment fails, try to use the raw mesh URL from reconstruction
              addLog('Deployment', 'error', `${deploymentResult.error || 'Deployment failed'} - Using raw mesh`)
              if (reconstructionData.result.raw_mesh_url) {
                setMeshUrl(reconstructionData.result.raw_mesh_url)
                addLog('System', 'completed', 'Raw mesh available for preview')
                setCurrentStage('Completed (Raw Mesh)')
              }
            }
          }
        } else {
          const errorDetails = reconstructionResult.error || 'Reconstruction failed'
          console.error('[Pipeline] Reconstruction failed:', errorDetails)
          console.error('[Pipeline] Full reconstruction response:', JSON.stringify(reconstructionResult, null, 2))
          addLog('Reconstruction', 'error', `${errorDetails}${reconstructionResult.details ? ' - Check browser console for details' : ''}`)
        }
      } else {
        addLog('Pre-flight Analysis', 'error', preflightResult.error || 'Analysis failed')
      }

    } catch (error) {
      addLog('System', 'error', error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsProcessing(false)
      setCurrentStage('')
    }
  }

  // Get status icon
  const getStatusIcon = (status: ProcessLogEntry['status']) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: ProcessLogEntry['status']) => {
    switch (status) {
      case 'processing':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#16161f]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#4361ee] to-[#3651ce] flex items-center justify-center">
                <Layers className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">3D Pipeline Architect</h1>
                <p className="text-xs text-gray-400">AI-Powered Image to 3D Conversion</p>
              </div>
            </div>
            {currentStage && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
                {currentStage}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Three Column Layout */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Sidebar - Upload & Settings */}
        <aside className="w-80 border-r border-gray-800 bg-[#16161f] overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Upload Dropzone */}
            <Card className="bg-[#1a1a2e] border-gray-800">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-[#4361ee]" />
                  Upload Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!uploadedFile ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-[#4361ee] hover:bg-[#4361ee]/5 transition-colors"
                  >
                    <Upload className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400 mb-1">Drag & drop or click to upload</p>
                    <p className="text-xs text-gray-500">.jpg, .png, .webp (max 10MB)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden bg-gray-900 border border-gray-800">
                      <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain" />
                      <button
                        onClick={handleRemoveFile}
                        className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-md transition-colors"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">
                      <p className="truncate">{uploadedFile.name}</p>
                      <p className="text-gray-500">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!uploadedFile || isProcessing}
              className="w-full h-12 bg-gradient-to-r from-[#4361ee] to-[#3651ce] hover:from-[#3651ce] hover:to-[#2941ae] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Layers className="h-5 w-5 mr-2" />
                  Generate 3D Model
                </>
              )}
            </Button>

            {/* Settings Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="settings" className="border-gray-800">
                <AccordionTrigger className="text-sm text-gray-300 hover:text-white">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-[#4361ee]" />
                    Pipeline Settings
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {/* Topology Preference */}
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-400">Topology Preference</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={topologyPreference === 'quad' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTopologyPreference('quad')}
                        className={topologyPreference === 'quad' ? 'bg-[#4361ee] hover:bg-[#3651ce]' : 'border-gray-700 text-gray-400'}
                      >
                        Quad
                      </Button>
                      <Button
                        variant={topologyPreference === 'tri' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTopologyPreference('tri')}
                        className={topologyPreference === 'tri' ? 'bg-[#4361ee] hover:bg-[#3651ce]' : 'border-gray-700 text-gray-400'}
                      >
                        Triangle
                      </Button>
                    </div>
                  </div>

                  {/* Target Poly Count */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs text-gray-400">Target Polygon Count</Label>
                      <span className="text-xs text-[#4361ee] font-medium">{targetPolyCount[0].toLocaleString()}</span>
                    </div>
                    <Slider
                      value={targetPolyCount}
                      onValueChange={setTargetPolyCount}
                      min={10000}
                      max={50000}
                      step={1000}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>10k</span>
                      <span>50k</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </aside>

        {/* Center Canvas - 3D Inspector */}
        <main className="flex-1 bg-[#0f0f17] flex flex-col">
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#4361ee]" />
                <h2 className="text-sm font-medium text-gray-300">3D Inspector</h2>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'textured' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('textured')}
                  className={viewMode === 'textured' ? 'bg-[#4361ee] hover:bg-[#3651ce]' : 'border-gray-700 text-gray-400'}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Textured
                </Button>
                <Button
                  variant={viewMode === 'wireframe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('wireframe')}
                  className={viewMode === 'wireframe' ? 'bg-[#4361ee] hover:bg-[#3651ce]' : 'border-gray-700 text-gray-400'}
                >
                  <Grid className="h-4 w-4 mr-1" />
                  Wireframe
                </Button>
                <Button
                  variant={viewMode === 'normal' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('normal')}
                  className={viewMode === 'normal' ? 'bg-[#4361ee] hover:bg-[#3651ce]' : 'border-gray-700 text-gray-400'}
                >
                  <Layers className="h-4 w-4 mr-1" />
                  Normal Map
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-8">
            {!meshUrl && !isProcessing ? (
              <div className="text-center">
                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center mx-auto mb-4 border border-gray-800">
                  <Layers className="h-16 w-16 text-gray-700" />
                </div>
                <h3 className="text-lg font-medium text-gray-400 mb-2">No 3D Model Generated</h3>
                <p className="text-sm text-gray-500 max-w-md">
                  Upload an image and click "Generate 3D Model" to begin the conversion process
                </p>
              </div>
            ) : !meshUrl && isProcessing ? (
              <div className="text-center">
                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-[#4361ee]/20 to-[#3651ce]/20 flex items-center justify-center mx-auto mb-4 border border-[#4361ee]/30">
                  <Loader2 className="h-16 w-16 text-[#4361ee] animate-spin" />
                </div>
                <h3 className="text-lg font-medium text-[#4361ee] mb-2">Processing Pipeline</h3>
                <p className="text-sm text-gray-500 max-w-md">
                  {currentStage || 'Generating your 3D model...'}
                </p>
                {reconstructionResult && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 mt-3">
                    {reconstructionResult.result.polygon_count.toLocaleString()} polygons
                  </Badge>
                )}
              </div>
            ) : (
              <div className="w-full h-full rounded-lg border border-gray-800 bg-gradient-to-br from-gray-900 to-[#0f0f17] flex flex-col items-center justify-center p-6">
                {/* Three.js canvas would go here - showing placeholder for now */}
                <div className="text-center">
                  <div className="h-64 w-64 rounded-lg bg-gradient-to-br from-[#4361ee]/20 to-[#3651ce]/20 flex items-center justify-center mx-auto mb-4 border border-[#4361ee]/30 relative overflow-hidden">
                    <Layers className="h-32 w-32 text-[#4361ee]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f17] via-transparent to-transparent opacity-50"></div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30 mb-2">
                    Model Ready
                  </Badge>
                  {reconstructionResult && (
                    <div className="flex gap-2 justify-center mb-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                        {reconstructionResult.result.polygon_count.toLocaleString()} polys
                      </Badge>
                      <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs">
                        {reconstructionResult.result.api_provider_used}
                      </Badge>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2">3D viewer (Three.js integration pending)</p>
                  <p className="text-xs text-gray-600 mt-1">View Mode: {viewMode}</p>
                  <a
                    href={meshUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#4361ee] hover:text-[#3651ce] underline mt-2 inline-block"
                  >
                    Open mesh in new tab
                  </a>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Panel - Process Log & Downloads */}
        <aside className="w-96 border-l border-gray-800 bg-[#16161f] flex flex-col">
          {/* Process Log */}
          <div className="flex-1 flex flex-col">
            <div className="border-b border-gray-800 p-4">
              <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <RefreshCw className={`h-4 w-4 text-[#4361ee] ${isProcessing ? 'animate-spin' : ''}`} />
                Process Log
              </h2>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div ref={logScrollRef} className="space-y-3">
                {processLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No pipeline activity yet</p>
                    <p className="text-xs text-gray-600 mt-1">Process logs will appear here</p>
                  </div>
                ) : (
                  processLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-[#1a1a2e] border border-gray-800 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1">
                          {getStatusIcon(log.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="outline"
                                className={`text-xs px-2 py-0 ${getStatusBadgeColor(log.status)}`}
                              >
                                {log.stage}
                              </Badge>
                              <span className="text-xs text-gray-500">{log.timestamp}</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed">{log.message}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator className="bg-gray-800" />

          {/* Download Section */}
          <div className="p-4 space-y-3">
            <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Download className="h-4 w-4 text-[#4361ee]" />
              Download Assets
            </h2>

            {!deploymentResult ? (
              <div className="text-center py-6">
                <p className="text-xs text-gray-500">No assets available</p>
                <p className="text-xs text-gray-600 mt-1">Complete the pipeline to download</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* GLB Download */}
                <a
                  href={deploymentResult.result.glb_package.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    variant="outline"
                    className="w-full justify-between border-gray-700 hover:border-[#4361ee] hover:bg-[#4361ee]/5"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      <span className="text-sm">Download .glb</span>
                    </span>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                      {deploymentResult.result.glb_package.file_size_mb} MB
                    </Badge>
                  </Button>
                </a>

                {/* OBJ Download */}
                <a
                  href={deploymentResult.result.obj_package.obj_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button
                    variant="outline"
                    className="w-full justify-between border-gray-700 hover:border-[#4361ee] hover:bg-[#4361ee]/5"
                  >
                    <span className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      <span className="text-sm">Download .obj</span>
                    </span>
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs">
                      {deploymentResult.result.obj_package.total_size_mb} MB
                    </Badge>
                  </Button>
                </a>

                {/* Additional info */}
                <div className="pt-2 border-t border-gray-800">
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(deploymentResult.result.download_expires_at).toLocaleDateString()}
                  </p>
                  {deploymentResult.result.glb_package.embedded_textures && (
                    <p className="text-xs text-green-400 mt-1">✓ Textures embedded in GLB</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
