<!-- svelte-ignore a11y-media-has-caption -->
<script>
  import io from "socket.io-client";
  import { onMount } from "svelte";

  let localVideo;
  let remoteVideo;

  let userStream;
  let otherUserSocketId;

  let socket = null;
  let peer;

  let users = [];

  const handleTrackEvent = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  const handleICECandidateNeeded = (incoming) => {
    const candidate = new RTCIceCandidate(incoming);
    peer.addIceCandidate(candidate);
  };

  const handleICECandidateEvent = (event) => {
    if (event.candidate) {
      const payload = {
        target: otherUserSocketId,
        candidate: event.candidate,
      };

      socket.emit("ice-candidate", payload);
    }
  };

  const handleAnswer = (message) => {
    const desc = new RTCSessionDescription(message.sdp);
    peer.setRemoteDescription(desc);
  };

  const handleReceiveCall = (incoming) => {
    peer = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);

    peer
      .setRemoteDescription(desc)
      .then(() => {
        userStream.getTracks().forEach((track) => {
          peer.addTrack(track, userStream);
        });
      })
      .then(() => peer.createAnswer())
      .then((answer) => peer.setLocalDescription(answer))
      .then(() => {
        const payload = {
          target: incoming.caller,
          caller: socket.id,
          sdp: peer.localDescription,
        };

        otherUserSocketId = incoming.caller;
        socket.emit("answer", payload);
      });
  };

  const handleNegotiationNeededEvent = (socketId) => {
    peer
      .createOffer()
      .then((offer) => peer.setLocalDescription(offer))
      .then(() => {
        const payload = {
          target: socketId,
          caller: socket.id,
          sdp: peer.localDescription,
        };

        socket.emit("offer", payload);
      });
  };

  const createPeer = (socketId) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.stunprotocol.org",
        },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com",
        },
      ],
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(socketId);

    return peer;
  };

  const callUser = (socketId) => {
    peer = createPeer(socketId);

    userStream.getTracks().forEach((track) => {
      return peer.addTrack(track, userStream);
    });
  };

  onMount(async () => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: true,
      })
      .then((stream) => {
        localVideo.srcObject = stream;
        userStream = stream;
      });

    socket = io(`http://${window.location.hostname}:5001`, {
      secure: true,
    });

    socket.on("offer", handleReceiveCall);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleICECandidateNeeded);

    socket.emit("get-all-users");

    socket.on("all-users", (u) => {
      users = u.filter((id) => id !== socket.id);
    });
  });
</script>

<div>
  <ul>
    {#each users as user}
      <li on:click={() => callUser(user)}>{user}</li>
    {/each}
  </ul>

  <video bind:this={localVideo} autoplay />
  <video bind:this={remoteVideo} autoplay />
</div>

<style>
  video {
    width: 640px;
    height: 480px;
  }
</style>
