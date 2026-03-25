import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { VercelPageTest } from './pages/VercelPageTest'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/test/vercel-page" element={<VercelPageTest />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
