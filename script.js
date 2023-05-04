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
let mutea=false;
let mutev=false;


let localStream
async function startLocalVideo(){
    return navigator.mediaDevices.getUserMedia({video:true,audio:true})
        .then(stream =>{
            localStream = stream
            localVdoElmnt.srcObject = stream
            localVdoElmnt.onloadedmetadata = ()=> localVdoElmnt.play()
        })
}

peer.on("open", id=>{ 
    document.getElementById("loader").style.display="none";
    document.getElementById("id_div").style.display="flex";
    localPeerIdP.innerText = id;
}) 
//caller
callBtn.addEventListener('click',async ()=>{
    console.log(remotePidF.value)
    if (remotePidF.value!=="") {
        const remotePid = remotePidF.value
        await startLocalVideo();
        const call = peer.call(remotePid,localStream)
        startModal.style.display = "none"
        cvr.style.display = "none"
        call.on("stream", stream =>{
            remoteVdoElmnt.srcObject = stream
            remoteVdoElmnt.onloadedmetadata = ()=> remoteVdoElmnt.play()
            console.log(stream)
        })
        endcallbtn.addEventListener("click",()=>{
            call.close();
            location.reload();
        })
        call.on("close",()=>{
            console.log("caller_videoclosed");
            remoteVdoElmnt.style.display="none";
            location.reload();
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
    console.log("got a call")
    await startLocalVideo()
    startModal.style.display = "none"
    cvr.style.display = "none"
    call.answer(localStream)
    call.on("stream", stream =>{
        remoteVdoElmnt.srcObject = stream
        remoteVdoElmnt.onloadedmetadata = ()=> remoteVdoElmnt.play()
    })
    endcallbtn.addEventListener("click",()=>{
        call.close();
        location.reload();
    })
    call.on("close",()=>{
        console.log("receiver_videoclosed");
        remoteVdoElmnt.style.display="none";
        location.reload();
        
    })
})
peer.on('disconnected',()=>{
    console.log('dissed')
})


localVdoElmnt.addEventListener('click',()=>{
    remoteVdoElmnt.style.display = 'none'
    localVdoElmnt.style.width = '100vw'
    localVdoElmnt.style.height = '100vh'
    document.body.style.backgroundColor = 'orange'
    backBtn.style.display = 'block'
})
remoteVdoElmnt.addEventListener('click',()=>{
    localVdoElmnt.style.display = 'none'
    remoteVdoElmnt.style.width = '100vw'
    remoteVdoElmnt.style.height = '100vh'
    document.body.style.backgroundColor = 'darkslategray'
    backBtn.style.display = 'block'
})
backBtn.addEventListener('click',()=>{
    backBtn.style.display = 'none'
    localVdoElmnt.style.display = 'block'
    remoteVdoElmnt.style.display = 'block'
    localVdoElmnt.style.width = window.innerWidth > 600 ? "50vw" : "100vw"
    remoteVdoElmnt.style.width = window.innerWidth > 600 ? "50vw" : "100vw"
    localVdoElmnt.style.height = window.innerWidth > 600 ? "80vh" : "50vh"
    remoteVdoElmnt.style.height = window.innerWidth > 600 ? "80vh" : "50vh"
    document.body.style.backgroundColor = 'black'
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
    console.log("mute")
    mutea=true;
    console.log(mutea)
    muteabtn.innerHTML=""
    muteabtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-mic-mute" viewBox="0 0 16 16">
    <path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0v1zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4zm3-9v4.879l-1-1V3a2 2 0 0 0-3.997-.118l-.845-.845A3.001 3.001 0 0 1 11 3z"/>
    <path d="m9.486 10.607-.748-.748A2 2 0 0 1 6 8v-.878l-1-1V8a3 3 0 0 0 4.486 2.607zm-7.84-9.253 12 12 .708-.708-12-12-.708.708z"/>
  </svg>`
  return
  }
  if(mutea){
    mutea=false;
    console.log(mutea)
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
      console.log("mutev")
      mutev=true;
      console.log(mutev)
      mutevbtn.innerHTML=""
      mutevbtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video-off" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M10.961 12.365a1.99 1.99 0 0 0 .522-1.103l3.11 1.382A1 1 0 0 0 16 11.731V4.269a1 1 0 0 0-1.406-.913l-3.111 1.382A2 2 0 0 0 9.5 3H4.272l.714 1H9.5a1 1 0 0 1 1 1v6a1 1 0 0 1-.144.518l.605.847zM1.428 4.18A.999.999 0 0 0 1 5v6a1 1 0 0 0 1 1h5.014l.714 1H2a2 2 0 0 1-2-2V5c0-.675.334-1.272.847-1.634l.58.814zM15 11.73l-3.5-1.555v-4.35L15 4.269v7.462zm-4.407 3.56-10-14 .814-.58 10 14-.814.58z"/>
    </svg>`
    return
    }
    if(mutev){
      mutev=false;
      console.log(mutev)
      mutevbtn.innerHTML=""
      mutevbtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-camera-video" viewBox="0 0 16 16">
      <path fill-rule="evenodd" d="M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2V5zm11.5 5.175 3.5 1.556V4.269l-3.5 1.556v4.35zM2 4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H2z"/>
    </svg>`
      return
    }
  }
