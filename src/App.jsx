import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'

// 화면은 열 때 받는다(처음 로딩을 가볍게). 받는 동안은 Layout의 Suspense가 스켈레톤을 보여 준다.
// 로그인 화면은 가벼워서 처음부터 같이 받는다.
const Home = lazy(() => import('./pages/Home.jsx'))
const Control = lazy(() => import('./pages/Control.jsx'))
const Schedule = lazy(() => import('./pages/Schedule.jsx'))
const Work = lazy(() => import('./pages/Work.jsx'))
const WorkDetail = lazy(() => import('./pages/WorkDetail.jsx'))
const Hobbies = lazy(() => import('./pages/Hobbies.jsx'))
const Investments = lazy(() => import('./pages/Investments.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

// /login 외의 모든 경로는 로그인해야 볼 수 있고, 정의되지 않은 경로는 홈으로 이동시킨다.
export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="control" element={<Control />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="work" element={<Work />} />
          <Route path="work/:id" element={<WorkDetail />} />
          <Route path="hobbies" element={<Hobbies />} />
          <Route path="investments" element={<Investments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
