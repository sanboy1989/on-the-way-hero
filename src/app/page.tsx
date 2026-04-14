'use client';

import AuthProvider        from '@/components/AuthProvider';
import LoginPage           from '@/components/LoginPage';
import MissionExplorer     from '@/components/MissionExplorer';
import { useAuthStore }    from '@/store/authStore';

function AppGate() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div
        style={{
          minHeight:      '100dvh',
          background:     '#111111',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width:        40,
            height:       40,
            border:       '3px solid #2a2a2a',
            borderTop:    '3px solid #FF8C00',
            borderRadius: '50%',
            animation:    'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <MissionExplorer />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
