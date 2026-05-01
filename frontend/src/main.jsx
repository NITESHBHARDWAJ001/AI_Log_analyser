import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a27',
            color: '#e2e8f0',
            border: '1px solid #2d2d45'
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#1a1a27' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1a1a27' } }
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
