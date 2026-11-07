// ===== Browser permissions (Chrome-only workaround) =====
navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
const isChrome = navigator.userAgent.indexOf("Chrome") != -1

if(isChrome){
  console.log('Chrome');

  navigator.permissions.query({name:"camera"}).then((permission)=>{
    if(!(permission.state === "granted")){
      if(confirm('Allow Camera & Mic?')){
        // open and immediately release a stream, just to trigger the browser prompt
        navigator.getUserMedia({video: true, audio: true}, (stream)=>{stream.getTracks().forEach(track=>track.stop())}, (err)=>{
          console.error('Camera/mic request failed:', err)
          showError("Couldn't access the camera/microphone (" + (err.name || err) + "). Check browser and system permissions.", {retry: false})
        });
        permission.onchange = ()=>{
          if(permission.state === "granted"){
            console.log('granteddd')
            createLocalStream()
          }
        }
      }
    }
    else{
      createLocalStream()
    }
  })
}


// ===== DOM references & state =====
// start screen
const startModal = document.getElementById("start")
const cover = document.getElementById("cover")
const localPeerIdLabel = document.getElementById("localPeerId")
const remotePeerIdInput = document.getElementById("remotePeerId")
const joinBtn = document.getElementById("join-btn")
const backBtn = document.getElementById('back')
const modelStatus = document.getElementById("modelStatus")
const errorBanner = document.getElementById("errorBanner")
const errorText = document.getElementById("errorText")
const errorRetry = document.getElementById("errorRetry")
const errorClose = document.getElementById("errorClose")

// video tiles
const localTile = document.getElementById("localVid")
const remoteTile = document.getElementById("remoteVid")
const localVideoEl = document.getElementById("localVdo")           // raw webcam feed (hidden input to MediaPipe)
const renderedLocalVideo = document.getElementById("renderedVdo")  // shows the stream we send (webcam + drawing)
const remoteVideoEl = document.getElementById("remoteVdo")

// controls
const muteAudioBtn = document.getElementById('muteaudio')
const muteVideoBtn = document.getElementById('mutevideo')
const muteRemoteIcon = document.getElementById('mutera_icon')
const colorInput = document.getElementById('clrInput')
colorInput.value = '#00ff00'
const drawModeIndicator = document.getElementById('drawModeIndicator')

// canvases: camera frame + hand skeleton, persistent strokes, eraser cursor, and the composite we stream out
const cameraCanvas = document.querySelector('.output_canvas')
const cameraCtx = cameraCanvas.getContext('2d')
const drawCanvas = document.getElementById('draw')
const drawCtx = drawCanvas.getContext('2d')
const overlayCanvas = document.getElementById('overlay')
const overlayCtx = overlayCanvas.getContext('2d')
const sendingCanvas = document.getElementById("sendingCanvas")
const sendingCtx = sendingCanvas.getContext('2d')

let localStream        // what we send to the peer (sendingCanvas video + mic audio)
let videoW, videoH     // webcam resolution, used to size every canvas
let tipX, tipY         // index fingertip, current and previous frame
let prevTipX, prevTipY

let drawMode = false
let audioMuted = false
let videoMuted = false
let remoteAudioMuted = false

// size all canvases to the webcam resolution once it is known
localVideoEl.addEventListener('loadedmetadata',()=>{
    videoW = localVideoEl.videoWidth
    videoH = localVideoEl.videoHeight
    for(const canvas of [cameraCanvas, sendingCanvas, drawCanvas, overlayCanvas]){
      canvas.width = videoW
      canvas.height = videoH
    }
})


// ===== Hand tracking setup =====
const hands = new Hands({locateFile: (file) => {
    return `hands/${file}`;
  }});
hands.setOptions({
    selfieMode: true,
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});
hands.onResults(onResults);

// Start downloading wasm + model (~16 MB) now, in the background, instead of on the first frame after Join
hands.initialize()
  .then(()=>{ modelStatus.innerText = "" })
  .catch(err=>{
    console.error("Hand model failed to preload", err)
    modelStatus.innerText = ""
  })

// feed every webcam frame to MediaPipe
async function startLocalVideo(){
    const camera = new Camera(localVideoEl, {
        onFrame: async () => {
          await hands.send({image: localVideoEl});
        },
      });
    return camera.start();
}


// ===== Gestures =====
// landmark indices: 0 wrist, 2-4 thumb, 5-8 index, 12 middle tip, 16 ring tip, 20 pinky tip
const sameColumn = (a, b) => a.x.toFixed(1) === b.x.toFixed(1)

// thumb above index, fingers lined up -> draw mode on
function isDrawOnGesture(lm){
  return lm[4].y<lm[8].y-0.05 && sameColumn(lm[4],lm[20]) && sameColumn(lm[4],lm[8]) && sameColumn(lm[5],lm[8]) && sameColumn(lm[2],lm[4])
}
// thumb below index, fingers lined up -> draw mode off
function isDrawOffGesture(lm){
  return lm[4].y>lm[8].y+0.05 && sameColumn(lm[4],lm[20]) && sameColumn(lm[4],lm[8]) && sameColumn(lm[5],lm[8]) && lm[5].y>lm[0].y
}
// index finger pointing up (curled thumb and ring finger)
function isPointing(lm){
  return lm[8].y<lm[16].y-0.1 && lm[3].y>lm[8].y
}
// pinky raised above middle finger, tolerance scaled by depth
function isClearGesture(lm){
  return lm[20].y<lm[12].y-((-lm[12].z*0.833)+0.05)
}


// ===== Per-frame drawing =====
function onResults(results) {
    cameraCtx.save();
    cameraCtx.clearRect(0, 0, cameraCanvas.width, cameraCanvas.height);
    overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height)
    cameraCtx.drawImage(results.image, 0, 0, cameraCanvas.width, cameraCanvas.height);
    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          // fingertip position in canvas pixels
          prevTipX = tipX
          prevTipY = tipY
          tipX = landmarks[8].x*videoW
          tipY = landmarks[8].y*videoH

          // fingertip dot and hand skeleton
          cameraCtx.beginPath()
          cameraCtx.fillStyle = colorInput.value
          cameraCtx.arc(tipX,tipY,9,0,2*Math.PI)
          cameraCtx.fill()
          drawConnectors(cameraCtx, landmarks, HAND_CONNECTIONS,{color: '#ff7700', lineWidth: 5});
          drawLandmarks(cameraCtx, landmarks, {color: '#ee00ff', lineWidth: 1});

          // toggle draw mode
          if(isDrawOnGesture(landmarks)){
            drawModeIndicator.style.backgroundColor = 'lime'
            drawMode = true
          }
          if(isDrawOffGesture(landmarks)){
            drawModeIndicator.style.backgroundColor = 'grey'
            drawMode = false
          }

          if(drawMode){
            if(isPointing(landmarks)){
              if(landmarks[8].y>landmarks[12].y){
                // index below middle finger: erase (blue box previews the area)
                overlayCtx.beginPath()
                overlayCtx.fillStyle = "rgba(15,143,255,0.5)"
                overlayCtx.rect(tipX-20,tipY-20,50,50)
                overlayCtx.fill()
                drawCtx.clearRect(tipX-20,tipY-20,50,50)
              }
              else{
                // otherwise: draw a line from last position
                drawCtx.beginPath()
                drawCtx.moveTo(prevTipX,prevTipY)
                drawCtx.strokeStyle = colorInput.value
                drawCtx.lineWidth = 3
                drawCtx.lineTo(tipX,tipY)
                drawCtx.stroke()
              }
            }
            if(isClearGesture(landmarks)){
              drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height)
            }
          }
        }
    }
    cameraCtx.restore();

    // composite camera + strokes + eraser cursor into the canvas we stream out
    sendingCtx.drawImage(cameraCanvas,0,0)
    sendingCtx.drawImage(drawCanvas,0,0)
    sendingCtx.drawImage(overlayCanvas,0,0)
}


// ===== Local stream =====
// the stream we send is the composited canvas; mic audio is added when the call starts
function createLocalStream(){
  localStream = sendingCanvas.captureStream()
  renderedLocalVideo.srcObject = localStream
}
if(!isChrome){
  createLocalStream()
}


// ===== Calling (PeerJS) =====
// add ?local to the page URL to use a PeerJS server on this machine (npx peerjs --port 9000 --path /),
// e.g. when the public one is blocked. Random suffix so two tabs opened together don't share an id.
const useLocalServer = new URLSearchParams(location.search).has("local")
const peerId = "vj"+Date.now().toString().slice(-6,-1) + (useLocalServer ? Math.random().toString(36).slice(2,5) : "")
const peer = useLocalServer
    ? new Peer(peerId, {host: "localhost", port: 9000, path: "/"})
    : new Peer(peerId)

function showCallScreen(){
    startModal.style.display = "none"
    cover.style.display = "none"
}
// add the mic track to the stream we send
function addMicTrack(){
    localVideoEl.srcObject.getAudioTracks().forEach(track => localStream.addTrack(track))
}

function showRemoteStream(stream){
    remoteVideoEl.srcObject = stream
    remoteVideoEl.onloadedmetadata = ()=> remoteVideoEl.play()
}

let signalingWasOpen = false

// Toast at the top. Stays until dismissed, or fades after autoHideMs for minor errors.
// Retry is a manual reload; we never reload on our own, that re-triggers the permission prompt.
let errorTimer
function showError(message, {retry = true, autoHideMs = 0} = {}){
    clearTimeout(errorTimer)
    errorText.innerText = message
    errorRetry.style.display = retry ? "inline-block" : "none"
    errorBanner.classList.add("show")
    if(autoHideMs) errorTimer = setTimeout(hideError, autoHideMs)
}
function hideError(){
    clearTimeout(errorTimer)
    errorBanner.classList.remove("show")
}
errorRetry.addEventListener('click', ()=> location.reload())
errorClose.addEventListener('click', hideError)

// the signaling server (0.peerjs.com) can be blocked by firewalls: tell the user instead of failing silently
const signalingTimeout = setTimeout(()=>{
    if(!signalingWasOpen){
        document.getElementById("loader").style.display="none"
        showError("Still can't reach the call server (0.peerjs.com). Your network or firewall may be blocking it.")
    }
}, 15000)

peer.on("error", err=>{
    console.error("PeerJS error:", err.type, err)
    if(err.type === "peer-unavailable"){
        showError("No meeting found with that ID.", {retry: false, autoHideMs: 5000})
    }
    else if(["network", "server-error", "socket-error", "socket-closed"].includes(err.type)){
        document.getElementById("loader").style.display="none"
        showError("Can't reach the call server (0.peerjs.com). Your network or firewall may be blocking it.")
    }
    else{
        showError("Call error: " + err.type, {retry: false, autoHideMs: 6000})
    }
})

peer.on("open", id=>{
    signalingWasOpen = true
    clearTimeout(signalingTimeout)
    hideError()
    document.getElementById("loader").style.display="none";
    document.getElementById('newMeetBtn').style.display = "block"
    //document.getElementById("id_div").style.display="flex";
    localPeerIdLabel.innerText = id;
})

function newMeet(){
  document.getElementById('newMeetBtn').style.display = "none"
  document.getElementById('share').style.display = "block"
  document.getElementById("id_div").style.display="flex";
  document.getElementById("inAndJoin").style.opacity=0
}

// caller
joinBtn.addEventListener('click',async ()=>{
    if (!peer.open) {
        showError("Not connected to the call server yet, so a call can't be started.", {autoHideMs: 8000})
        return
    }
    if (remotePeerIdInput.value!=="") {
        const remotePeerId = remotePeerIdInput.value
        await startLocalVideo();
        addMicTrack()
        const call = peer.call(remotePeerId,localStream)
        showCallScreen()
        call.on("stream", showRemoteStream)
    }
})
document.addEventListener("keypress",async(e)=>{
    if (e.key === "Enter") {
        joinBtn.click()
    }
})

// receiver
peer.on("call", async(call)=>{
    await startLocalVideo()
    showCallScreen()
    addMicTrack()
    call.answer(localStream)
    call.on("stream", showRemoteStream)
})

function endCall(){
  location.reload()
}
// Also fires after a failed first connect (PeerJS destroys the peer), so only reconnect if we were connected.
// Running calls are peer-to-peer and survive a signaling drop.
peer.on('disconnected',()=>{
    if(signalingWasOpen && !peer.destroyed){
        peer.reconnect()
    }
})


// ===== Layout: click a tile to expand it =====
localTile.addEventListener('click',()=>{
    remoteTile.style.display = 'none'
    localTile.style.width = '100vw'
    localTile.style.height = '100vh'
    document.body.style.backgroundColor = 'orange'
    backBtn.style.display = 'block'
})
remoteVideoEl.addEventListener('click',()=>{
    localTile.style.display = 'none'
    remoteTile.style.width = '100vw'
    remoteTile.style.height = '100vh'
    document.body.style.backgroundColor = 'darkslategray'
    backBtn.style.display = 'block'
})
backBtn.addEventListener('click',()=>{
    backBtn.style.display = 'none'
    localTile.style.display = 'flex'
    remoteTile.style.display = 'flex'
    localTile.style.width = window.innerWidth > 600 ? "50vw" : "100vw"
    remoteTile.style.width = window.innerWidth > 600 ? "50vw" : "100vw"
    localTile.style.height = window.innerWidth > 600 ? "80vh" : "50vh"
    remoteTile.style.height = window.innerWidth > 600 ? "80vh" : "50vh"
    document.body.style.backgroundColor = 'rgb(55,55,55)'
})

document.getElementById('copy').addEventListener('click',()=>{
    navigator.clipboard.writeText(localPeerIdLabel.innerText)
    document.getElementById('share').innerText="Copied!"
    setTimeout(()=>{
        document.getElementById('share').innerHTML="Share this id:";
    }, 2000)
})


// ===== Controls (called from onclick attributes in index.html) =====
const MIC_ON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-mic" viewBox="0 0 16 16">
    <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
    <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z"/>
    </svg>`
const MIC_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-mic-mute" viewBox="0 0 16 16">
    <path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0v1zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4zm3-9v4.879l-1-1V3a2 2 0 0 0-3.997-.118l-.845-.845A3.001 3.001 0 0 1 11 3z"/>
    <path d="m9.486 10.607-.748-.748A2 2 0 0 1 6 8v-.878l-1-1V8a3 3 0 0 0 4.486 2.607zm-7.84-9.253 12 12 .708-.708-12-12-.708.708z"/>
  </svg>`
const CAM_ON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H2z"/>
    </svg>`
const CAM_OFF_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video-off" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M10.961 12.365a1.99 1.99 0 0 0 .522-1.103l3.11 1.382A1 1 0 0 0 16 11.731V4.269a1 1 0 0 0-1.406-.913l-3.111 1.382A2 2 0 0 0 9.5 3H4.272l.714 1H9.5a1 1 0 0 1 1 1v6a1 1 0 0 1-.144.518l.605.847zM1.428 4.18A.999.999 0 0 0 1 5v6a1 1 0 0 0 1 1h5.014l.714 1H2a2 2 0 0 1-2-2V5c0-.675.334-1.272.847-1.634l.58.814zM15 11.73l-3.5-1.555v-4.35L15 4.269v7.462zm-4.407 3.56-10-14 .814-.58 10 14-.814.58z"/>
    </svg>`

function muteafn(){
  audioMuted = !audioMuted
  localStream.getAudioTracks()[0].enabled = !audioMuted
  muteAudioBtn.innerHTML = audioMuted ? MIC_OFF_ICON : MIC_ON_ICON
}

function mutevfn(){
  videoMuted = !videoMuted
  localStream.getVideoTracks()[0].enabled = !videoMuted
  drawMode = !videoMuted  // drawing is disabled while the camera is off
  muteVideoBtn.innerHTML = videoMuted ? CAM_OFF_ICON : CAM_ON_ICON
}

function toggleDrawMode(){
  drawMode = !drawMode
  drawModeIndicator.style.backgroundColor = drawMode ? 'lime' : 'grey'
}

function muteremoteaudio(){
  remoteAudioMuted = !remoteAudioMuted
  remoteVideoEl.muted = remoteAudioMuted
  muteRemoteIcon.src = remoteAudioMuted ? "./assets/volume-mute.svg" : "./assets/volume-down.svg"
}
