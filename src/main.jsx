import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { store } from './store'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#FFFFFF',
              color: '#1E293B',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08)',
            },
            success: {
              iconTheme: { primary: '#6366F1', secondary: '#FFFFFF' },
            },
            error: {
              iconTheme: { primary: '#E11D48', secondary: '#FFFFFF' },
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)
