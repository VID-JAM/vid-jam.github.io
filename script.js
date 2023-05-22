let uid = "vj"+Date.now().toString().slice(-6,-1)
let peer = new Peer(uid)
let localPeerIdP = document.getElementById("localPeerId")
let remotePidF = document.getElementById("remotePeerId")
let callBtn = document.getElementById("join-btn")
let localVdoElmnt = document.getElementById("localVdo")
let remoteVdoElmnt = document.getElementById("remoteVdo")
let startModal = document.getElementById("start")
let cvr = document.getElementById("cover")
let logo = document.getElementById('logo')
let backBtn = document.getElementById('back')
let muteabtn = document.getElementById('muteaudio')
let mutevbtn = document.getElementById('mutevideo')
let endcallbtn = document.getElementById('endcall')
var mutera_icon = document.getElementById('mutera_icon');

let localVid = document.getElementById("localVid")
let remoteVid = document.getElementById("remoteVid")
let renderedLocalVdo = document.getElementById("renderedVdo")
let drawColor = document.getElementById('clrInput')
drawColor.value = '#00ff00'
let drawModeIndicator = document.getElementById('drawModeIndicator')
let drawMode = false
let mute_ra=false;
let mutea=false;
let mutev=false;

let sendingCanvas = document.getElementById("sendingCanvas")
let scCtx = sendingCanvas.getContext('2d')


let localStream

let w = window.innerWidth
let h = window.innerHeight
let vw,vh
const canvasElement = document.querySelector('.output_canvas');
const ctx = canvasElement.getContext('2d');
let dc = document.getElementById('draw')
let oc = document.getElementById('overlay')
localVdoElmnt.addEventListener('loadedmetadata',e=>{
    vw = localVdoElmnt.videoWidth
    vh = localVdoElmnt.videoHeight
    canvasElement.width = vw
    canvasElement.height = vh
    sendingCanvas.width = vw
    sendingCanvas.height = vh
    dc.width = vw
    dc.height = vh
    oc.width = vw
    oc.height = vh
  })
  let octx = oc.getContext('2d')
  let dctx = dc.getContext('2d')
  let x,y,px,py

async function startLocalVideo(){
    const camera = new Camera(localVdoElmnt, {
        onFrame: async () => {
          await hands.send({image: localVdoElmnt});
        },
      });
      return camera.start();
}
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
  function onResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    octx.clearRect(0,0,oc.width,oc.height)
    ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
          px = x
          py = y
          x = landmarks[8].x*vw
          y = landmarks[8].y*vh
          ctx.beginPath()
          ctx.fillStyle = drawColor.value
          ctx.arc(x,y,9,0,2*Math.PI)
          ctx.fill()
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS,{color: '#ff7700', lineWidth: 5});
          drawLandmarks(ctx, landmarks, {color: '#ee00ff', lineWidth: 1});
          if(landmarks[4].y<landmarks[20].y-((-landmarks[20].z*0.833)+0.05) && landmarks[4].x.toFixed(2)===landmarks[20].x.toFixed(2) && landmarks[4].x.toFixed(1)===landmarks[8].x.toFixed(1)){
            drawModeIndicator.style.backgroundColor = 'lime'
            drawMode = true
          }
          if(landmarks[4].y>landmarks[20].y-((-landmarks[20].z*0.833)+0.05) && landmarks[4].x.toFixed(2)===landmarks[20].x.toFixed(2) && landmarks[4].x.toFixed(1)===landmarks[8].x.toFixed(1)){
            drawModeIndicator.style.backgroundColor = 'grey'
            drawMode = false
          }
          if(drawMode){
            if(landmarks[8].y<landmarks[16].y-0.25){
              if(landmarks[8].y>landmarks[12].y){
                octx.beginPath()
                octx.fillStyle = "rgba(15,143,255,0.5)"
                octx.rect(x-20,y-20,50,50)
                octx.fill()
                dctx.clearRect(x-20,y-20,50,50)
              }
              else{
                dctx.beginPath()
                dctx.moveTo(px,py)
                dctx.strokeStyle = drawColor.value
                dctx.lineWidth = 3
                dctx.lineTo(x,y)
                dctx.stroke()
              }
            }
            if(landmarks[20].y<landmarks[12].y-((-landmarks[12].z*0.833)+0.05)){
              dctx.clearRect(0, 0, dc.width, dc.height)
            }
          }
        }
    }
    ctx.restore();

    scCtx.drawImage(canvasElement,0,0)
    scCtx.drawImage(dc,0,0)
    scCtx.drawImage(oc,0,0)
}
localStream = sendingCanvas.captureStream()
renderedLocalVdo.srcObject = localStream

peer.on("open", id=>{ 
    document.getElementById("loader").style.display="none";
    document.getElementById('newMeetBtn').style.display = "block"
    //document.getElementById("id_div").style.display="flex";
    localPeerIdP.innerText = id;
}) 
function newMeet(){
  document.getElementById('newMeetBtn').style.display = "none"
  document.getElementById('share').style.display = "block"
  document.getElementById("id_div").style.display="flex";
  document.getElementById("inAndJoin").style.opacity=0
}
//caller
callBtn.addEventListener('click',async ()=>{
    if (remotePidF.value!=="") {
        const remotePid = remotePidF.value
        await startLocalVideo();
        localVdoElmnt.srcObject.getAudioTracks().forEach(track => localStream.addTrack(track)) //<---OK
        const call = peer.call(remotePid,localStream)
        startModal.style.display = "none"
        cvr.style.display = "none"
        call.on("stream", stream =>{
            remoteVdoElmnt.srcObject = stream
            remoteVdoElmnt.onloadedmetadata = ()=> remoteVdoElmnt.play()
        })
    }
})
document.addEventListener("keypress",async(e)=>{
    if (e.key === "Enter") {
        callBtn.click()
    }
    
})
//receiver
peer.on("call", async(call)=>{
    await startLocalVideo()
    startModal.style.display = "none"
    cvr.style.display = "none"
    localVdoElmnt.srcObject.getAudioTracks().forEach(track => localStream.addTrack(track)) 
    call.answer(localStream)
    call.on("stream", stream =>{
        remoteVdoElmnt.srcObject = stream
        remoteVdoElmnt.onloadedmetadata = ()=> remoteVdoElmnt.play()
    })
})
function endCall(){
  location.reload()
}
peer.on('disconnected',()=>{
    location.reload()
})


localVid.addEventListener('click',()=>{
    remoteVid.style.display = 'none'
    localVid.style.width = '100vw'
    localVid.style.height = '100vh'
    document.body.style.backgroundColor = 'orange'
    backBtn.style.display = 'block'
})
remoteVdoElmnt.addEventListener('click',()=>{
    localVid.style.display = 'none'
    remoteVid.style.width = '100vw'
    remoteVid.style.height = '100vh'
    document.body.style.backgroundColor = 'darkslategray'
    backBtn.style.display = 'block'
})
backBtn.addEventListener('click',()=>{
    backBtn.style.display = 'none'
    localVid.style.display = 'flex'
    remoteVid.style.display = 'flex'
    localVid.style.width = window.innerWidth > 600 ? "50vw" : "100vw"
    remoteVid.style.width = window.innerWidth > 600 ? "50vw" : "100vw"
    localVid.style.height = window.innerWidth > 600 ? "80vh" : "50vh"
    remoteVid.style.height = window.innerWidth > 600 ? "80vh" : "50vh"
    document.body.style.backgroundColor = 'rgb(55,55,55)'
})

document.getElementById('copy').addEventListener('click',()=>{
    navigator.clipboard.writeText(localPeerIdP.innerText)
    document.getElementById('share').innerText="Copied!"
    setTimeout(()=>{
        document.getElementById('share').innerHTML="Share this id:";
    }, 2000)
})

function muteafn(){
   
  if (!mutea){
    localStream.getAudioTracks()[0].enabled = false
    mutea=true;
    muteabtn.innerHTML=""
    muteabtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-mic-mute" viewBox="0 0 16 16">
    <path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0v1zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4zm3-9v4.879l-1-1V3a2 2 0 0 0-3.997-.118l-.845-.845A3.001 3.001 0 0 1 11 3z"/>
    <path d="m9.486 10.607-.748-.748A2 2 0 0 1 6 8v-.878l-1-1V8a3 3 0 0 0 4.486 2.607zm-7.84-9.253 12 12 .708-.708-12-12-.708.708z"/>
  </svg>`
  return
  }
  if(mutea){
    localStream.getAudioTracks()[0].enabled = true
    mutea=false;
    muteabtn.innerHTML=""
    muteabtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-mic" viewBox="0 0 16 16">
    <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
    <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z"/>
    </svg>`
    return
  }
}

function mutevfn(){
   
    if (!mutev){
      localStream.getVideoTracks()[0].enabled = false
      mutev=true;
      drawMode = false
      mutevbtn.innerHTML=""
      mutevbtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video-off" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M10.961 12.365a1.99 1.99 0 0 0 .522-1.103l3.11 1.382A1 1 0 0 0 16 11.731V4.269a1 1 0 0 0-1.406-.913l-3.111 1.382A2 2 0 0 0 9.5 3H4.272l.714 1H9.5a1 1 0 0 1 1 1v6a1 1 0 0 1-.144.518l.605.847zM1.428 4.18A.999.999 0 0 0 1 5v6a1 1 0 0 0 1 1h5.014l.714 1H2a2 2 0 0 1-2-2V5c0-.675.334-1.272.847-1.634l.58.814zM15 11.73l-3.5-1.555v-4.35L15 4.269v7.462zm-4.407 3.56-10-14 .814-.58 10 14-.814.58z"/>
    </svg>`
    return
    }
    if(mutev){
      localStream.getVideoTracks()[0].enabled = true
      mutev=false;
      drawMode = true
      mutevbtn.innerHTML=""
      mutevbtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H2z"/>
    </svg>`
      return
    }
  }

function toggleDrawMode(){
  if(!drawMode){
    drawModeIndicator.style.backgroundColor = 'lime'
    drawMode = true
    return
  }
  if(drawMode){
    drawModeIndicator.style.backgroundColor = 'grey'
    drawMode = false
    return
  }
}
  function muteremoteaudio(){
    mute_ra = !mute_ra;
    remoteVdoElmnt.muted=mute_ra;

    if(mute_ra) //when true-audio muted
      mutera_icon.src="./assets/volume-mute.svg";
    else
      mutera_icon.src="./assets/volume-down.svg";
  }
