if (typeof global === 'undefined') {
  window.global = window;
}
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SocketProvider } from './context/SocketContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </StrictMode>
);
