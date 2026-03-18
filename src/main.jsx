import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Amplify } from 'aws-amplify'
import './index.css'

// Configure Amplify BEFORE importing App (components may use generateClient)
try {
  const outputs = await import('../amplify_outputs.json')
  Amplify.configure(outputs.default)
  // Store outputs globally for Steam auth URL access
  window.amplifyOutputs = outputs.default
} catch {
  console.warn(
    'Amplify outputs not found. Run `npx ampx sandbox` to generate amplify_outputs.json'
  )
}

// Import App AFTER Amplify is configured
const { default: App } = await import('./App.jsx')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
