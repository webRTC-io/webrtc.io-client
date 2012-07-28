(function() {

var rtc = this.rtc = {};

// Fallbacks for vendor-specific variables until the spec is finalized.
var PeerConnection = window.PeerConnection || window.webkitPeerConnection00;
var URL = window.URL || window.webkitURL;

// Holds a connection to the server.
rtc._socket = null;

// Holds callbacks for certain events.
rtc._events = {};

// Holds the STUN server to use for PeerConnections.
rtc.SERVER = "STUN stun.l.google.com:19302";

// Reference to the lone PeerConnection instance.
rtc.peerConnection = null;

// Array of known peer socket ids
rtc.connections = [];

// Stream-related variables.
rtc.streams = [];
rtc.numStreams = 0;
rtc.initializedStreams = 0;

/**
 * Connects to the socket.io server.
 */
rtc.connect = function(server) {
  rtc._socket = io.connect(server);
  rtc._socket.on('connect', function() {
    rtc.fire('connect');
  });

  // TODO: Fix possible race condition if get peers is not emitted
  // before the "ready" event is fired.
  rtc._socket.on('get peers', function(data) {
    var peers = data.connections;
    rtc.connections = peers;

    // fire connections event and pass peers
    rtc.fire('connections', peers);
  });

  rtc._socket.on('receive ice candidate', function(data) {
    console.log("ICE CANDIDATE RECEIVED");
    var candidate = new IceCandidate(data.label, data.candidate);
    rtc.peerConnection.processIceMessage(candidate);
    rtc.fire('receive ice candidate', candidate);
  });

  rtc._socket.on('receive offer', function(data) {
    rtc.receiveOffer(data.socketId, data.sdp);
    rtc.fire('receive offer', data);
  });

  rtc._socket.on('receive answer', function(data) {
    rtc.receiveAnswer(data.sdp);
    rtc.fire('receive answer', data);
  });
};

rtc.sendOffers = function() {
  console.log("SENDING OFFERS...");
  for (var i = 0, len = rtc.connections.length; i < len; i++) {
    var socketId = rtc.connections[i];
    rtc.sendOffer(socketId);
  }
}

rtc.on = function(eventName, callback) {
  rtc._events[eventName] = rtc._events[eventName] || [];
  rtc._events[eventName].push(callback);
};

rtc.fire = function(eventName, _) {
  var events = rtc._events[eventName];
  var args   = Array.prototype.slice.call(arguments, 1);

  if (!events) {
    return;
  }

  for (var i = 0, len = events.length; i < len; i++) {
    events[i].apply(null, args);
  }
};

rtc.createPeerConnection = function() {
  rtc.peerConnection = new PeerConnection(rtc.SERVER, function(candidate, moreToFollow) {
    console.log("RECEIVED ICE CANDIDATE");
    if (candidate) {
      rtc._socket.emit('receive ice candidate', {
        label: candidate.label,
        candidate: candidate.toSdp()
      });
    }
    rtc.fire('ice candidate', candidate, moreToFollow);
  });

  rtc.peerConnection.onopen = function() {
    console.log("PEER CONNECTION OPENED.");
    // TODO: Finalize this API
    rtc.fire('peer connection opened');
  };

  rtc.peerConnection.onaddstream = function(event) {
    console.log("ON ADD STREAM FUCKIN DONE.");
    // TODO: Finalize this API
    rtc.fire('add remote stream', event.stream);
  };
};

rtc.sendOffer = function(socketId) {
  console.log("SENDING OFFER...");
  var pc = rtc.peerConnection;
  // TODO: Abstract away video: true, audio: true for offers
  var offer = pc.createOffer({ video: true, audio: true });
  pc.setLocalDescription(pc.SDP_OFFER, offer);
  rtc._socket.emit('send offer', { socketId: socketId, sdp: offer.toSdp() });
  pc.startIce();
};

rtc.receiveOffer = function(socketId, sdp) {
  console.log("RECEIVING OFFER...");
  var pc = rtc.peerConnection;
  pc.setRemoteDescription(pc.SDP_OFFER, new SessionDescription(sdp));
  rtc.sendAnswer(socketId);
};

rtc.sendAnswer = function(socketId) {
  console.log("SENDING ANSWER...");
  var pc = rtc.peerConnection;
  var offer = pc.remoteDescription;
  // TODO: Abstract away video: true, audio: true for answers
  var answer = pc.createAnswer(offer.toSdp(), {video: true, audio: true});
  pc.setLocalDescription(pc.SDP_ANSWER, answer);
  rtc._socket.emit('send answer', { socketId: socketId, sdp: answer.toSdp() });
  pc.startIce();
};

rtc.receiveAnswer = function(sdp) {
  console.log("RECEIVING ANSWER...");
  var pc = rtc.peerConnection;
  pc.setRemoteDescription(pc.SDP_ANSWER, new SessionDescription(sdp));
};

rtc.createStream = function(domId, onSuccess, onFail) {
  var el = document.getElementById(domId);
  var options;
  onSuccess = onSuccess || function() {};
  onFail = onFail || function() {};

  if (el.tagName.toLowerCase() === "AUDIO") {
    options = { audio: true };
  } else {
    options = { video: true, audio: true };
  }

  if(navigator.webkitGetUserMedia)  {  
    rtc.numStreams++;
    navigator.webkitGetUserMedia(options, function(stream) {
      window.bs = stream;
      el.src = webkitURL.createObjectURL(stream);
      console.log("Adding local stream.");
      rtc.streams.push(stream);
      rtc.initializedStreams++;
      onSuccess(stream);
      if (rtc.initializedStreams === rtc.numStreams) {
        rtc.fire('ready');
      }
    }, function() {
      alert("Could not connect stream.");
      onFail();
    });  
  } else {  
    alert('webRTC not available');  
  }  
}

rtc.addStreams = function() {
  for (var i = 0; i < rtc.streams.length; i++) {
    var stream = rtc.streams[i];
    rtc.peerConnection.addStream(stream);
  }
};

rtc.attachStream = function(stream, domId) {
  document.getElementById(domId).src = URL.createObjectURL(stream);
};

rtc.on('ready', function() {
  rtc.createPeerConnection();
  rtc.addStreams();
  rtc.sendOffers();
});

}).call(this);
