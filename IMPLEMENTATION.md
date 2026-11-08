# VidJam: how it works

VidJam is a static, backend-less 2-person video call where you draw on your own video with hand gestures. The people on the call see the drawing because it is baked into the video you send.

## Files

| File | Role |
| --- | --- |
| `index.html` | Single page: start modal, local/remote video tiles, canvases, call controls |
| `script.js` | All app logic: PeerJS calling, MediaPipe hand tracking, gestures, drawing, UI |
| `style.css` | Layout and styling |
| `camera_utils.js`, `drawing_utils.js` | Vendored MediaPipe helpers (`Camera`, `drawConnectors`, `drawLandmarks`). Don't edit. |
| `hands/` | Vendored MediaPipe Hands solution: JS loader, WASM, `.tflite` model, graph (about 16 MB in total) |
| `assets/` | Logos and icons |

## Call flow (PeerJS, WebRTC)

1. On load, `new Peer("vj" + <timestamp digits>)` registers with PeerJS's free cloud signaling server. When `peer.on("open")` fires, the loader hides and **New Meeting** appears.
2. **New Meeting** shows your peer ID to share. The other person pastes it in the input and clicks **Join**.
3. **Caller** (`join-btn` click): starts the camera, adds the mic audio track to `localStream`, then calls `peer.call(remoteId, localStream)`.
4. **Receiver** (`peer.on("call")`): starts the camera, adds the mic track, then calls `call.answer(localStream)`.
5. In both cases `call.on("stream")` puts the remote stream into `#remoteVdo`.
6. End call and signaling disconnect both just `location.reload()`.

Media goes peer to peer. Only the handshake uses the signaling server.

## Video pipeline

```
webcam -> <video id=localVdo> -> MediaPipe Hands -> onResults()
                                                      |
              .output_canvas  <- camera frame + hand skeleton + fingertip dot
              #draw           <- persistent strokes
              #overlay        <- eraser cursor (cleared every frame)
                                                      |
              #sendingCanvas  <- frame + strokes + overlay composited
                                                      |
              sendingCanvas.captureStream() -> WebRTC track sent to the peer
              (also shown locally via <video id=renderedVdo>)
```

`Camera` (from `camera_utils.js`) pulls frames from the webcam and calls `hands.send()` for each one. `onResults()` runs per frame with the 21 landmarks of one hand (`maxNumHands: 1`, `selfieMode: true`).

Because the *composited canvas* is what gets streamed, the remote side sees your drawing as ordinary video. No drawing data is sent separately.

## Gestures (`onResults` in `script.js`)

Rules are hand-written comparisons of landmark coordinates (index fingertip is landmark 8, thumb tip is 4, and so on). Many compare `x.toFixed(1)` values, which is why they are sensitive and have needed tuning.

| Gesture | Effect |
| --- | --- |
| Thumb above index, fingers lined up | Turn draw mode **on** (indicator turns lime) |
| Thumb below index, fingers lined up | Turn draw mode **off** (indicator turns grey) |
| Draw mode, index finger up | Draw a line from the previous to the current fingertip position |
| Draw mode, index and middle finger up | Erase a 50x50 box around the fingertip (blue square preview on `#overlay`) |
| Draw mode, pinky up | Clear everything on `#draw` |

The brush icon (`#drawModeIndicator`) toggles draw mode manually, and the color input sets the stroke color. Muting video turns draw mode off.

## Permissions (Chrome only block, top of `script.js`)

On Chrome the page checks `permissions.query({name: "camera"})`. If it isn't `granted`, it shows a `confirm()` and opens and stops a throwaway `getUserMedia` stream. It creates `localStream` only when the permission state changes to granted. Other browsers create `localStream` immediately. `Camera.start()` later calls `getUserMedia` again for the real stream.

## Known problems

- **Slow start:** the ~16 MB of MediaPipe files used to start downloading only on the first `hands.send()` after clicking Join. This branch starts that download on page load (`hands.initialize()`).
- **Permission loop:** if the permission never reaches `granted` (managed browser policy), the `confirm()` reappears on every load. `peer.on("disconnected")` also reloads the page, which can restart the loop.
- **Fragile gestures:** the `toFixed(1)` comparisons are brittle.
- **Legacy library:** `@mediapipe/hands` is deprecated. The newer Tasks Vision `HandLandmarker` is faster and smaller.
- **2 people only**, and the peer ID is time-derived so collisions are possible.

## Toward a Meet extension

Keep the pipeline, change the transport. A content script in the page's main world wraps `navigator.mediaDevices.getUserMedia`, runs hand tracking on the real camera stream, and returns `canvas.captureStream()`'s video track. Meet then sends the composited video, so PeerJS is no longer needed. The main risk is Meet's Content Security Policy and loading WASM there.
