let peer = new Peer()
let localPeerIdP = document.getElementById("localPeerId")
let remotePidF = document.getElementById("remotePeerId")
let callBtn = document.getElementById("join-btn")
let localVdoElmnt = document.getElementById("localVdo")
let remoteVdoElmnt = document.getElementById("remoteVdo")
let startModal = document.getElementById("start")
let cvr = document.getElementById("cover")
let backBtn = document.getElementById('back')
let localStream
async function startLocalVideo(){
    return navigator.mediaDevices.getUserMedia({video:true,audio:true})
        .then(stream =>{
            localStream = stream
            localVdoElmnt.srcObject = stream
            localVdoElmnt.onloadedmetadata = ()=> localVdoElmnt.play()
        })
}

//startLocalVideo()
peer.on("open", id=>{
    localPeerIdP.innerText = id
}) 
callBtn.addEventListener('click',async ()=>{
    const remotePid = remotePidF.value
    await startLocalVideo();
    const call = peer.call(remotePid,localStream)
    startModal.style.display = "none"
    cvr.style.display = "none"
    call.on("stream", stream =>{
        remoteVdoElmnt.srcObject = stream
        remoteVdoElmnt.onloadedmetadata = ()=> remoteVdoElmnt.play()
    })
})
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
    localVdoElmnt.style.width = 'auto'
    remoteVdoElmnt.style.width = 'auto'
    localVdoElmnt.style.height = 'auto'
    remoteVdoElmnt.style.height = 'auto'
    document.body.style.backgroundColor = 'black'
})

document.getElementById('copy').addEventListener('click',()=>{
    navigator.clipboard.writeText(localPeerIdP.innerText)
})