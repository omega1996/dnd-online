# D&D Online

A web-based D&D game management system with real-time collaboration features.

## WebRTC Audio Broadcasting

The application supports GM-to-players audio broadcasting using WebRTC mesh topology with Socket.IO signaling.

### Features

- **GM Audio Sharing**: GM can share tab/system audio to all players in the room
- **Automatic Playback**: Players automatically receive and play the audio stream
- **Mesh Topology**: Direct peer-to-peer connections between GM and each player
- **Real-time Signaling**: Socket.IO handles WebRTC signaling (offers, answers, ICE candidates)

### Testing Instructions

To test the WebRTC audio broadcasting feature:

1. **Start the server**:
   ```bash
   cd server
   npm start
   ```

2. **Start the client** (in a separate terminal):
   ```bash
   cd client
   npm run dev
   ```

3. **Open two browser tabs/windows**:
   - **Tab 1 (GM)**: Open `http://localhost:3000` (or your dev server URL)
   - **Tab 2 (Player)**: Open `http://localhost:3000` in a new tab/window

4. **Join the same room**:
   - In Tab 1: Create or join a room (first person becomes GM)
   - In Tab 2: Join the same room code (becomes Player)

5. **Start audio sharing**:
   - In Tab 1 (GM): Click the "🔇 Share Audio" button in the GM Tools section
   - Browser will prompt to select a tab/window/application to share
   - Select a tab that has audio playing (e.g., YouTube video, music player)
   - The button will change to "🔊 Stop Sharing Audio" and show "Sharing audio to players..."

6. **Verify audio reception**:
   - In Tab 2 (Player): You should automatically hear the audio from the shared tab
   - No action required from the player - audio plays automatically

7. **Stop sharing**:
   - In Tab 1 (GM): Click "🔊 Stop Sharing Audio" to stop broadcasting
   - Players will automatically stop receiving audio

### Browser Compatibility

- **Chrome/Edge**: Full support for tab audio capture
- **Firefox**: Supports tab audio capture
- **Safari**: Limited support (may require system audio capture)

### Troubleshooting

- **No audio received**: Check browser console for WebRTC errors
- **Permission denied**: Ensure browser permissions allow microphone/audio capture
- **Connection failed**: Check that both tabs are in the same room and Socket.IO is connected
- **ICE connection failed**: May need TURN server for NAT traversal (currently using STUN only)

### Technical Details

- **Signaling**: Socket.IO events (`webrtc:offer`, `webrtc:answer`, `webrtc:ice`, `webrtc:stop`)
- **ICE Servers**: Uses Google STUN server (`stun:stun.l.google.com:19302`)
- **Audio Element**: Players use hidden `<audio>` element with `autoplay` and `playsinline` attributes
- **Cleanup**: Automatically cleans up peer connections when GM stops sharing or players disconnect
