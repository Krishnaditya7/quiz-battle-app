import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SocketListener({ socket, user }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket || !user) return;

    socket.on('match:queued', (data) => {
      console.log('📣 Queued — redirecting to waiting room');
      if (window.location.pathname !== '/waiting-room') {
            const queueData = data?.queueData || 
      JSON.parse(sessionStorage.getItem('pendingQueueData') || '{}');
    const myTeam = data?.myTeam?.name || 
      JSON.parse(sessionStorage.getItem('pendingMyTeam') || 'null');

    navigate('/waiting-room', {
      state: { queueData, myTeam }
    });
      }
    });

    return () => {
      socket.off('match:queued');
    };
  }, [socket, user]);

  return null;
}