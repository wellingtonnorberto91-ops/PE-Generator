import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Calendars } from './pages/Calendars';
import { Classes } from './pages/Classes';
import { Students } from './pages/Students';
import { Dossier } from './pages/Dossier';
import { CurricularUnits } from './pages/CurricularUnits';
import { Schedules } from './pages/Schedules';
import { ClassEditor } from './pages/ClassEditor';
import { TeachingPlanEditor } from './pages/TeachingPlanEditor';
import { AppLayout } from './components/layout/AppLayout';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendars" element={<Calendars />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/classes/edit/:id" element={<ClassEditor />} />
          <Route path="/classes/:classId/modules/:moduleIndex/teaching-plan" element={<TeachingPlanEditor />} />
          <Route path="/units" element={<CurricularUnits />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/students" element={<Students />} />
          <Route path="/dossier" element={<Dossier />} />
          <Route path="/admin" element={<AdminRoute />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
