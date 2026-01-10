import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './global.css'

// NOTE: React.StrictMode double-invokes useEffect in development, which can cause double loading.
// Remove StrictMode to avoid double game load in dev.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
