/**
 * WebRTC Audio Broadcasting Module
 * 
 * GM side: Manages peer connections to all players, broadcasts tab audio
 * Player side: Receives audio from GM and plays it automatically
 */

import { socket } from './socket.js';

// GM state
let gmPeers = new Map(); // Map<socketId, RTCPeerConnection>
let gmAudioTrack = null;
let gmStream = null;
let isGMSharing = false;
let onSharingStateChange = null; // Callback for sharing state changes

// Player state
let playerPeer = null; // Single RTCPeerConnection from GM
let playerAudioElement = null;

// ICE configuration
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

/**
 * Initialize WebRTC audio sharing for GM
 * @param {Array} members - Array of member objects with { id, name, role }
 * @param {string} mySocketId - Current user's socket ID
 * @param {Function} onStateChange - Callback called when sharing state changes (isSharing: boolean)
 */
export function initGMAudioSharing(members, mySocketId, onStateChange = null) {
  console.log('[WebRTC] Initializing GM audio sharing', { membersCount: members.length, mySocketId });
  
  onSharingStateChange = onStateChange;
  
  // Set up signaling listeners
  socket.on('webrtc:answer', handleAnswer);
  socket.on('webrtc:ice', handleGMICE);
  
  // Clean up existing connections
  cleanupGM();
}

/**
 * Start sharing audio as GM
 * @param {Array} members - Array of member objects with { id, name, role }
 * @param {string} mySocketId - Current user's socket ID
 * @returns {Promise<void>}
 */
export async function startGMAudioSharing(members, mySocketId) {
  if (isGMSharing) {
    console.warn('[WebRTC] Already sharing audio');
    return;
  }

  try {
    console.log('[WebRTC] Requesting display media...');
    
    // Request display media (tab audio)
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    // Get audio track only (ignore video)
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio track found in display media');
    }

    gmAudioTrack = audioTracks[0];
    gmStream = stream;
    isGMSharing = true;
    
    if (onSharingStateChange) {
      onSharingStateChange(true);
    }

    console.log('[WebRTC] Got audio track:', gmAudioTrack.label);

    // Handle track ended (user stops sharing)
    gmAudioTrack.onended = () => {
      console.log('[WebRTC] Audio track ended, stopping sharing');
      stopGMAudioSharing();
    };

    // Create peer connections for each player
    const players = members.filter(m => m.id !== mySocketId && m.role === 'Player');
    console.log('[WebRTC] Creating peer connections for players:', players.map(p => p.id));

    for (const player of players) {
      await createGMPeerConnection(player.id, mySocketId);
    }

  } catch (error) {
    console.error('[WebRTC] Failed to start audio sharing:', error);
    isGMSharing = false;
    throw error;
  }
}

/**
 * Add a peer connection for a new player (when GM is already sharing)
 * @param {string} playerSocketId - Player's socket ID
 * @param {string} mySocketId - GM's socket ID
 * @returns {Promise<void>}
 */
export async function addGMPeerConnection(playerSocketId, mySocketId) {
  if (!isGMSharing || !gmAudioTrack) {
    console.warn('[WebRTC] Cannot add peer connection: not sharing audio');
    return;
  }
  
  await createGMPeerConnection(playerSocketId, mySocketId);
}

/**
 * Stop sharing audio as GM
 */
export function stopGMAudioSharing() {
  console.log('[WebRTC] Stopping GM audio sharing');
  
  isGMSharing = false;
  
  if (onSharingStateChange) {
    onSharingStateChange(false);
  }
  
  // Stop audio track
  if (gmAudioTrack) {
    gmAudioTrack.stop();
    gmAudioTrack = null;
  }
  
  // Stop stream
  if (gmStream) {
    gmStream.getTracks().forEach(track => track.stop());
    gmStream = null;
  }
  
  // Close all peer connections
  cleanupGM();
  
  // Notify players to stop
  socket.emit('webrtc:stop', {});
}

/**
 * Create a peer connection from GM to a player
 * @param {string} playerSocketId - Player's socket ID
 * @param {string} mySocketId - GM's socket ID
 * @returns {Promise<void>}
 */
async function createGMPeerConnection(playerSocketId, mySocketId) {
  console.log('[WebRTC] Creating peer connection to player:', playerSocketId);
  
  const peerConnection = new RTCPeerConnection(iceServers);
  
  // Add audio track
  if (gmAudioTrack) {
    peerConnection.addTrack(gmAudioTrack, gmStream);
  }
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('[WebRTC] GM ICE candidate:', event.candidate);
      socket.emit('webrtc:ice', {
        to: playerSocketId,
        from: mySocketId,
        candidate: event.candidate
      });
    }
  };
  
  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log(`[WebRTC] GM peer connection state (${playerSocketId}):`, peerConnection.connectionState);
    if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
      cleanupGMPeer(playerSocketId);
    }
  };
  
  // Create and send offer
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    console.log('[WebRTC] GM sending offer to:', playerSocketId);
    socket.emit('webrtc:offer', {
      to: playerSocketId,
      from: mySocketId,
      sdp: offer
    });
    
    gmPeers.set(playerSocketId, peerConnection);
  } catch (error) {
    console.error('[WebRTC] Failed to create offer:', error);
    peerConnection.close();
    throw error;
  }
}

/**
 * Handle answer from player
 * @param {Object} data - { from, sdp }
 */
async function handleAnswer({ from, sdp }) {
  console.log('[WebRTC] GM received answer from:', from);
  
  const peerConnection = gmPeers.get(from);
  if (!peerConnection) {
    console.warn('[WebRTC] No peer connection found for player:', from);
    return;
  }
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    console.log('[WebRTC] GM set remote description for:', from);
  } catch (error) {
    console.error('[WebRTC] Failed to set remote description:', error);
  }
}

/**
 * Handle ICE candidate from player
 * @param {Object} data - { from, candidate }
 */
async function handleGMICE({ from, candidate }) {
  console.log('[WebRTC] GM received ICE candidate from:', from);
  
  const peerConnection = gmPeers.get(from);
  if (!peerConnection) {
    console.warn('[WebRTC] No peer connection found for player:', from);
    return;
  }
  
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('[WebRTC] GM added ICE candidate for:', from);
  } catch (error) {
    console.error('[WebRTC] Failed to add ICE candidate:', error);
  }
}

/**
 * Clean up GM peer connections
 */
function cleanupGM() {
  console.log('[WebRTC] Cleaning up GM peer connections');
  
  for (const [socketId, peerConnection] of gmPeers.entries()) {
    peerConnection.close();
  }
  gmPeers.clear();
}

/**
 * Clean up a specific GM peer connection
 * @param {string} socketId - Player's socket ID
 */
function cleanupGMPeer(socketId) {
  const peerConnection = gmPeers.get(socketId);
  if (peerConnection) {
    peerConnection.close();
    gmPeers.delete(socketId);
    console.log('[WebRTC] Cleaned up peer connection for:', socketId);
  }
}

/**
 * Remove peer connection for a disconnected player (GM only)
 * @param {string} playerSocketId - Disconnected player's socket ID
 */
export function removeGMPeerConnection(playerSocketId) {
  console.log('[WebRTC] Removing peer connection for disconnected player:', playerSocketId);
  cleanupGMPeer(playerSocketId);
}

/**
 * Initialize WebRTC audio receiving for player
 * @param {string} mySocketId - Current user's socket ID
 */
export function initPlayerAudioReceiving(mySocketId) {
  console.log('[WebRTC] Initializing player audio receiving', { mySocketId });
  
  // Set up signaling listeners
  socket.on('webrtc:offer', handleOffer);
  socket.on('webrtc:ice', handlePlayerICE);
  socket.on('webrtc:stop', handleStop);
  
  // Create audio element
  if (!playerAudioElement) {
    playerAudioElement = document.createElement('audio');
    playerAudioElement.autoplay = true;
    playerAudioElement.playsInline = true;
    playerAudioElement.style.display = 'none';
    document.body.appendChild(playerAudioElement);
    console.log('[WebRTC] Created audio element for player');
  }
  
  // Clean up existing connection
  cleanupPlayer();
}

/**
 * Handle offer from GM
 * @param {Object} data - { from, sdp }
 */
async function handleOffer({ from, sdp }) {
  console.log('[WebRTC] Player received offer from GM:', from);
  
  // Clean up existing connection if any
  cleanupPlayer();
  
  const peerConnection = new RTCPeerConnection(iceServers);
  
  // Handle remote track
  peerConnection.ontrack = (event) => {
    console.log('[WebRTC] Player received remote track:', event.track.kind);
    if (event.track.kind === 'audio' && playerAudioElement) {
      const remoteStream = new MediaStream([event.track]);
      playerAudioElement.srcObject = remoteStream;
      console.log('[WebRTC] Player set audio source');
    }
  };
  
  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('[WebRTC] Player ICE candidate');
      socket.emit('webrtc:ice', {
        to: from,
        from: socket.id,
        candidate: event.candidate
      });
    }
  };
  
  // Handle connection state changes
  peerConnection.onconnectionstatechange = () => {
    console.log('[WebRTC] Player peer connection state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'closed') {
      cleanupPlayer();
    }
  };
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    console.log('[WebRTC] Player sending answer to GM:', from);
    socket.emit('webrtc:answer', {
      to: from,
      from: socket.id,
      sdp: answer
    });
    
    playerPeer = peerConnection;
  } catch (error) {
    console.error('[WebRTC] Failed to handle offer:', error);
    peerConnection.close();
  }
}

/**
 * Handle ICE candidate from GM
 * @param {Object} data - { from, candidate }
 */
async function handlePlayerICE({ from, candidate }) {
  console.log('[WebRTC] Player received ICE candidate from GM:', from);
  
  if (!playerPeer) {
    console.warn('[WebRTC] No peer connection found');
    return;
  }
  
  try {
    await playerPeer.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('[WebRTC] Player added ICE candidate');
  } catch (error) {
    console.error('[WebRTC] Failed to add ICE candidate:', error);
  }
}

/**
 * Handle stop signal from GM
 */
function handleStop() {
  console.log('[WebRTC] Player received stop signal');
  cleanupPlayer();
}

/**
 * Clean up player peer connection
 */
function cleanupPlayer() {
  console.log('[WebRTC] Cleaning up player peer connection');
  
  if (playerPeer) {
    playerPeer.close();
    playerPeer = null;
  }
  
  if (playerAudioElement) {
    playerAudioElement.srcObject = null;
  }
}

/**
 * Clean up all WebRTC resources
 */
export function cleanup() {
  console.log('[WebRTC] Cleaning up all resources');
  
  // Remove socket listeners
  socket.off('webrtc:offer');
  socket.off('webrtc:answer');
  socket.off('webrtc:ice');
  socket.off('webrtc:stop');
  
  // Clean up GM
  stopGMAudioSharing();
  
  // Clean up player
  cleanupPlayer();
  
  // Remove audio element
  if (playerAudioElement && playerAudioElement.parentNode) {
    playerAudioElement.parentNode.removeChild(playerAudioElement);
    playerAudioElement = null;
  }
}

/**
 * Check if GM is currently sharing audio
 * @returns {boolean}
 */
export function isSharing() {
  return isGMSharing;
}
