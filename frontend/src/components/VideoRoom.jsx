import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import SimplePeer from 'simple-peer';

const VideoRoom = () => {
  const { roomId } = useParams();
  const socket = useSocket();
  const userVideoRef = useRef();
  const peersRef = useRef({});
  const [peers, setPeers] = useState([]); // { id, peer, username }
  const [stream, setStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const streamRef = useRef(null);

  const username = localStorage.getItem('username') || 'Anonymous';

  useEffect(() => {
    let isMounted = true;

    socket.emit('join-room', roomId, username);

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        if (!isMounted) return;
        streamRef.current = currentStream;
        setStream(currentStream);
        if (userVideoRef.current)
          userVideoRef.current.srcObject = currentStream;
      })
      .catch((err) => {
        console.warn('Media access denied:', err);
      });

    const handleUserConnected = ({ userId, userName }) => {
      if (streamRef.current) {
        const peer = createPeer(userId, socket.id, streamRef.current);
        peersRef.current[userId] = { peer, username: userName };
        setPeers((users) => [
          ...users.filter((u) => u.id !== userId),
          { id: userId, peer, username: userName },
        ]);
      } else {
        setPeers((users) => [
          ...users.filter((u) => u.id !== userId),
          { id: userId, peer: null, username: userName },
        ]);
      }
    };

    const handleSignal = ({ userId, signal }) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.signal(signal);
      } else if (streamRef.current) {
        const peer = addPeer(signal, userId, streamRef.current);
        peersRef.current[userId] = { peer, username: 'Unknown' };
        setPeers((users) => [
          ...users.filter((u) => u.id !== userId),
          { id: userId, peer, username: 'Unknown' },
        ]);
      }
    };

    const handleReceiveMessage = ({ message, userName, timestamp }) => {
      setMessages((prev) => [...prev, { message, userName, timestamp }]);
    };

    const handleUserDisconnected = (userId) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.destroy();
        delete peersRef.current[userId];
        setPeers((users) => users.filter((p) => p.id !== userId));
      }
    };

    socket.on('connect', () => {
      console.log(`[FRONTEND] Socket connected: ${socket.id}`);
    });
    socket.on('user-connected', handleUserConnected);
    socket.on('signal', handleSignal);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('user-disconnected', handleUserDisconnected);

    return () => {
      isMounted = false;
      socket.off('user-connected', handleUserConnected);
      socket.off('signal', handleSignal);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('user-disconnected', handleUserDisconnected);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [socket, roomId, username]);

  const toggleAudio = () => {
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
    });
  };

  const toggleVideo = () => {
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
    });
  };

  const sendMessage = () => {
    if (chatInput.trim() === '') return;
    console.log(
      `[FRONTEND] Sending message: "${chatInput}" as ${username} to room ${roomId}`
    );
    socket.emit('send-message', {
      roomId,
      message: chatInput,
      userName: username,
    });
    setChatInput('');
  };

  const handleReceiveMessage = ({ message, userName, timestamp }) => {
    console.log(
      `[FRONTEND] Received message from ${userName}: "${message}" at ${timestamp}`
    );
    setMessages((prev) => [...prev, { message, userName, timestamp }]);
  };

  function createPeer(userToSignal, callerId, stream) {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      socket.emit('signal', { userId: userToSignal, signal });
    });

    return peer;
  }

  function addPeer(incomingSignal, callerId, stream) {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      socket.emit('signal', { userId: callerId, signal });
    });

    peer.signal(incomingSignal);

    return peer;
  }

  return (
    <div>
      <h2>Room: {roomId}</h2>

      <div>
        <video
          ref={userVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '300px' }}
        />
        <div>
          <button onClick={toggleAudio}>
            {audioEnabled ? 'Mute Mic' : 'Unmute Mic'}
          </button>
          <button onClick={toggleVideo}>
            {videoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          </button>
        </div>
      </div>

      {/* Video grid container */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(peers.length + 1, 4)}, 1fr)`,
          gap: '10px',
          marginTop: '20px',
          width: '100%',
        }}
      >
        {/* Local video */}
        <div style={{ position: 'relative', width: '100%' }}>
          <video
            ref={userVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', borderRadius: '8px' }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              color: 'black',
              backgroundColor: 'rgba(0,0,0,0.5)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            You
          </div>
        </div>

        {/* Remote peers */}
        {peers.map(({ peer, id, username }) => (
          <Video key={id} peer={peer} username={username} />
        ))}
      </div>

      {/* Chat UI */}
      <div style={{ marginTop: '20px', maxWidth: '600px' }}>
        <h3>Chat</h3>
        <div
          style={{
            border: '1px solid #ccc',
            height: '200px',
            overflowY: 'scroll',
            padding: '10px',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
          }}
        >
          {messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: '8px' }}>
              <strong>
                {msg.userName === username ? 'You' : msg.userName}:{' '}
              </strong>
              <span>{msg.message}</span>
              <div style={{ fontSize: '10px', color: '#666' }}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '10px', display: 'flex' }}>
          <input
            type='text'
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            style={{
              flexGrow: 1,
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
            placeholder='Type a message...'
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage();
            }}
          />
          <button
            onClick={sendMessage}
            style={{ marginLeft: '8px', padding: '8px 12px' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

const Video = ({ peer, username }) => {
  const ref = useRef();

  React.useEffect(() => {
    if (!peer) return;
    peer.on('stream', (stream) => {
      if (ref.current) ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div style={{ position: 'relative', width: '300px' }}>
      <video
        ref={ref}
        autoPlay
        playsInline
        style={{ width: '100%', borderRadius: '8px' }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '8px',
          color: 'black',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '14px',
        }}
      >
        {username}
      </div>
    </div>
  );
};

export default VideoRoom;
