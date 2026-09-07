import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LimiteDeError } from './components/ui/LimiteDeError.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LimiteDeError>
      <App />
    </LimiteDeError>
  </StrictMode>,
)
