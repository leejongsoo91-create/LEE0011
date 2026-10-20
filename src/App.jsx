import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import Schedule from './pages/Schedule.jsx'
import Work from './pages/Work.jsx'
import Hobbies from './pages/Hobbies.jsx'
import Investments from './pages/Investments.jsx'

// /login 외의 모든 경로는 로그인해야 볼 수 있고, 정의되지 않은 경로는 홈으로 이동시킨다.
export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="work" element={<Work />} />
          <Route path="hobbies" element={<Hobbies />} />
          <Route path="investments" element={<Investments />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
