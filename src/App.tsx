import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { MyCatches } from './pages/catches/MyCatches';
import { CatchForm } from './pages/catches/CatchForm';
import { CatchDetail } from './pages/catches/CatchDetail';
import { MyTrips } from './pages/trips/MyTrips';
import { TripForm } from './pages/trips/TripForm';
import { TripDetail } from './pages/trips/TripDetail';
import { MyMap } from './pages/map/MyMap';
import { MyLocations } from './pages/locations/MyLocations';
import { MyProfile } from './pages/profile/MyProfile';
import { Feed } from './pages/feed/Feed';
import { PublicProfile } from './pages/profile/PublicProfile';
import { Notifications } from './pages/notifications/Notifications';
import { Analytics } from './pages/analytics/Analytics';
import { ExportPage } from './pages/export/ExportPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { ManageUsers } from './pages/admin/ManageUsers';
import { ManageSpecies } from './pages/admin/ManageSpecies';
import { ManageCategories } from './pages/admin/ManageCategories';
import { MySpeciesRequests } from './pages/species/MySpeciesRequests';
import { SystemReports } from './pages/admin/SystemReports';
import { AuditLogs } from './pages/admin/AuditLogs';
import { Backup } from './pages/admin/Backup';
import { FeedLayout } from './components/FeedLayout';
import { LandingPage } from './pages/landing/LandingPage';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Dashboard } from './pages/dashboard/Dashboard';
import { NotFound } from './pages/NotFound';




function App() {
  return (
   <Routes>
      {/* One "/" (B-23): the landing page when signed out; it sends signed-in anglers to /dashboard. */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Public: people read it before signing up (F-19), and Google sign-in needs a public policy URL. */}
      <Route path="/privacy" element={<PrivacyPolicy />} />

      <Route element={<ProtectedRoute />}>
        {/* Feed gets the wider shell */}
        <Route element={<FeedLayout />}>
          <Route path="/feed" element={<Feed />} />
        </Route>

        {/* Everything else keeps the narrow shell */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trips" element={<MyTrips />} />
          <Route path="/map" element={<MyMap />} />
          <Route path="/trips/new" element={<TripForm />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          <Route path="/trips/:id/edit" element={<TripForm />} />
          <Route path="/trips/:tripId/catches/new" element={<CatchForm />} />

          {/* Catch history (search across all your catches); a catch opens on its trip's page */}
          <Route path="/catches" element={<MyCatches />} />
          <Route path="/catches/:id" element={<CatchDetail />} />
          <Route path="/catches/:id/edit" element={<CatchForm />} />

          <Route path="/locations" element={<MyLocations />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/anglers/:userId" element={<PublicProfile />} />

          <Route path="/notifications" element={<Notifications />} />
          <Route path="/species/requests" element={<MySpeciesRequests />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/export" element={<ExportPage />} />


          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<ManageUsers />} />
              <Route path="users" element={<ManageUsers />} />
              <Route path="species" element={<ManageSpecies />} />
              <Route path="categories" element={<ManageCategories />} />
              <Route path="reports" element={<SystemReports />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="backup" element={<Backup />} />
            </Route>
          </Route>
        </Route>
      </Route>
      {/* Unknown URLs (B-23). */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
