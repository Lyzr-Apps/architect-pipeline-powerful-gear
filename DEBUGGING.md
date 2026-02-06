# Debugging Guide: 3D Pipeline Architect

## Issue: Reconstruction Failed

### Quick Checks

1. **API Key Configuration**
   ```bash
   # Verify .env.local has your Lyzr API key
   cat .env.local | grep LYZR_API_KEY
   ```

2. **Server Logs**
   - Open your browser DevTools Console (F12)
   - Look for logs prefixed with `[Agent API]` and `[Pipeline]`
   - Check the server terminal for detailed error messages

3. **Test Upload First**
   - Upload should complete successfully before reconstruction
   - Look for: `[Upload API] Success - data received`

### Common Issues

#### 1. Reconstruction Agent Not Responding
**Symptom:** "Reconstruction failed" error
**Check:**
- Browser console shows: `[Pipeline] Reconstruction result:`
- Server logs show: `[Agent API] Response status: 200` or error code

**Solution:**
- Verify agent ID is correct: `698596a7e17e33c11eed1a9c`
- Check if agent is active in Lyzr dashboard
- Ensure agent has necessary tools/permissions

#### 2. JSON Parsing Error
**Symptom:** Error mentions JSON parsing
**Check:**
- Server logs show: `[Agent API] Raw response (first 500 chars):`
- Look for malformed JSON in response

**Solution:**
- The `parseLLMJson` utility handles this automatically
- If persists, check agent's response schema configuration

#### 3. Asset Not Found
**Symptom:** "Asset ID not found" or similar
**Check:**
- Upload logs show asset_ids array with valid IDs
- Asset ID is being passed to reconstruction agent

**Solution:**
- Verify upload completed: `Image uploaded successfully (Asset ID: ...)`
- Check asset ID format (should be 24-character hex string)

### Step-by-Step Debugging

1. **Open Browser DevTools** (F12)
2. **Go to Console tab**
3. **Upload an image**
4. **Watch for these log sequences:**

```
[Upload API] Starting file upload...
[Upload API] Received 1 file(s)
[Upload API] Uploading file: yourfile.jpg (123456 bytes)
[Upload API] Sending to Lyzr API...
[Upload API] Lyzr API response status: 200
[Upload API] Success - data received: {...}
[Upload API] Extracted 1 asset ID(s): ["abc123..."]

[Agent API] Request: {agent_id: "698596e41caa4e686dd66f72", ...}
[Agent API] Calling Lyzr API...
[Agent API] Response status: 200
[Agent API] Raw response (first 500 chars): {...}
[Agent API] Parsed response: {...}
[Agent API] Normalized response status: success

[Pipeline] Reconstruction result: {success: true, ...}
```

5. **If you see an error**, note:
   - Which step failed (Upload, Orchestrator, Pre-flight, Enhancement, Reconstruction, etc.)
   - The exact error message
   - The response status code

### Agent IDs Reference

```typescript
PIPELINE_ORCHESTRATOR: '698596e41caa4e686dd66f72'  // Manager agent
PREFLIGHT_ANALYSIS: '69859686ab4bf65a66ad08ad'      // Sub-agent
ENHANCEMENT: '69859695382ef8715224cf63'            // Sub-agent
RECONSTRUCTION: '698596a7e17e33c11eed1a9c'         // Sub-agent (failing)
REFINEMENT: '698596baf7f7d3ffa5d86570'             // Sub-agent
DEPLOYMENT: '698596cc07ec48e3dc90a260'             // Sub-agent
```

### Testing Individual Agents

You can test agents individually using the browser console:

```javascript
// Test reconstruction agent directly
const testReconstruction = async () => {
  const assetId = "YOUR_ASSET_ID_HERE"; // From upload step
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "Generate 3D mesh with quad topology targeting 25000 polygons",
      agent_id: "698596a7e17e33c11eed1a9c",
      assets: [assetId]
    })
  });
  const data = await response.json();
  console.log('Reconstruction test result:', data);
};

testReconstruction();
```

### Next Steps

1. Upload an image through the UI
2. Open browser console and check the logs
3. Find which specific agent is failing
4. Check the error message in the logs
5. Verify the agent configuration in Lyzr dashboard

### Need Help?

Logs to share:
- Browser console logs (copy all `[Agent API]` and `[Pipeline]` logs)
- Server terminal logs
- Specific error message
- Agent ID that's failing
