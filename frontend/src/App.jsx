import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './ErrorBoundary';
import CandidateList from './pages/CandidateList';
import Dashboard from './pages/Dashboard';
import SchedulingPage from './pages/SchedulingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/candidates" replace />} />
          <Route path="candidates" element={<CandidateList />} />
          <Route path="dashboard/:id" element={<Dashboard />} />
          <Route path="/scheduling" element={<ErrorBoundary><SchedulingPage /></ErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
