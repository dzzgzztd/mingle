import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import MediaList from "./pages/MediaList";
import MediaDetail from "./pages/MediaDetail";
import Home from "./pages/Home";
import Search from "./pages/Search";

function RequireAuth({ children }: { children: JSX.Element }) {
    const token = localStorage.getItem("token");
    if (!token) return <Navigate to="/login" replace />;
    return children;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                path="/"
                element={
                    <RequireAuth>
                        <AppShell />
                    </RequireAuth>
                }
            >
                <Route index element={<Home />} />
                <Route path="search" element={<Search />} />

                <Route path="profile" element={<Profile />} />
                <Route path="collections" element={<Collections />} />
                <Route path="collections/:id" element={<CollectionDetail />} />

                <Route path="media" element={<MediaList />} />
                <Route path="media/:id" element={<MediaDetail />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
