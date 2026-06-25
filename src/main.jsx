import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import ReviewQueue from './pages/ReviewQueue.tsx'
import PipelineVisualization from './components/PipelineVisualization.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/review-queue" element={<ReviewQueue />} />
        <Route path="/pipeline" element={<PipelineVisualization />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
