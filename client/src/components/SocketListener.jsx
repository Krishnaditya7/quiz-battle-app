import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SocketListener({ socket, user }) {
  const navigate = useNavigate();
  

  
  useEffect(() => {
    if (!socket || !user) return;
    socket.on('match:queued', (data) => {
    console.log('📣 Queued — redirecting to waiting room');
    console.log('data.myTeam from socket:', data?.myTeam); // ← add this
  console.log('data.myTeam members count:', data?.myTeam?.members?.length);
  if (window.location.pathname !== '/waiting-room') {
    navigate('/waiting-room', {
      state: {
        // queueData can fallback to sessionStorage
        queueData: data?.queueData || 
          JSON.parse(sessionStorage.getItem('pendingQueueData') || '{}'),
        
        // myTeam ONLY from socket data — never from sessionStorage
        // because sessionStorage has unfiltered members
        myTeam: data?.myTeam || null,
      }
    });
  }
});
    socket.on('match:found', (data) => {
      console.log('🎮 Match found — redirecting to game room');
      if (window.location.pathname === '/waiting-room') {
        return;
      }
        navigate('/game-room', { state: { gameData: data } });
      
    });
    return () => {
      socket.off('match:queued');
      socket.off('match:found')
    };
  }, [socket, user]);

  return null;
}