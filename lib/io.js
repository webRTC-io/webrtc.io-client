(function() {

var rtc = this.rtc = {};

// Fallbacks for vendor-specific variables until the spec is finalized.
var PeerConnection = window.PeerConnection || window.webkitPeerConnection00;

// Holds a connection to the server.
rtc._socket = null;

// Holds callbacks for certain events.
rtc._events = {};

// Holds the STUN server to use for PeerConnections.
rtc.SERVER = "STUN stun.l.google.com:19302";

// Hash of peer connections.
rtc.peerConnection = null;
rtc.connections = [];

/**
 * Connects to the socket.io server.
 */
rtc.sync = function(server, types) {
  rtc._socket = io.connect(server);
  rtc._socket.on('connect', function() {
    rtc._socket.emit('types', types);
    rtc.fire('sync');
  });

  rtc._socket.on('connections', function(data) {
    var peers = data.connections;
    rtc.connections = peers;

    // fire connections event and pass peers
    rtc.fire('connections', peers);
  });

  rtc._socket.on('receive ice candidate', function(socketId, data) {
    console.log("ICE CANDIDATE RECEIVED");
    var candidate = new IceCandidate(data.label, data.candidate);
    rtc.peerConnections[socketId].processIceMessage(candidate);
  });

  rtc._socket.on('receive offer', function(data) {
    console.log("OFFER FUCKIN RECEIVED");
    // TODO: Get rid of silly data.data
    rtc.receiveOffer(data.socketId, data.sdp);
  });

  rtc._socket.on('receive answer', function(data) {
    console.log("ANSWER FUCKIN RECEIVED");
    // TODO: Get rid of silly data.data
    rtc.receiveAnswer(data.data.sdp);
  });

  rtc.createPeerConnection();
};

rtc.addStream = function(stream) {
  for (var peerId in rtc.peerConnections) {
    var peer = rtc.peerConnections[peerId];
    peer.addStream(stream);
  }
}

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
    if (candidate) {
      socket.emit('receive ice candidate', {
        label: candidate.label,
        candidate: candidate.toSdp()
      });
    }
    rtc.fire('ice candidate', candidate, moreToFollow);
  });

  rtc.peerConnection.onaddstream = function(event) {
    console.log("ON ADD STREAM FUCKIN DONE.");
    // TODO: Finalize this API
    rtc.fire('add remote stream', event);
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
  var offer = rtc.peerConnection.remoteDescription;
  // TODO: Abstract away video: true, audio: true for answers
  var answer = rtc.peerConnection.createAnswer(offer.toSdp(), {video: true, audio: true});
  rtc.peerConnection.setLocalDescription(rtc.peerConnection.SDP_ANSWER, answer);
  rtc._socket.emit('send answer', { socketId: socketId, sdp: answer.toSdp() });
  rtc.peerConnection.startIce();
};

rtc.receiveAnswer = function(sdp) {
  console.log("RECEIVING ANSWER...");
  var pc = rtc.peerConnection;
  pc.setRemoteDescription(pc.SDP_ANSWER, new SessionDescription(sdp));
};

rtc.streams = [];

rtc.createStream = function(options, domId) {
  var el;

  if (arguments.length === 1) {
    domId = options;
    options = null;
  }

  el = document.getElementById(domId);

  if (!options) {
    if (el.tagName.toLowerCase() === "AUDIO") {
      options = { audio: true };
    } else {
      options = { video: true, audio: true };
    }
  }

  if(navigator.webkitGetUserMedia)  {  
    navigator.webkitGetUserMedia(options, function(stream) {
      el.src = webkitURL.createObjectURL(stream);
      rtc.streams.push(stream);
    }, function() {
      alert("Could not connect stream.");
    });  
  } else {  
    alert('webRTC not available');  
  }  
}

rtc.maybeStart = function(connections) {
  console.log("MAYBE STARTING...");
  console.log(connections);
  for (var i = 0, len = connections.length; i < len; i++) {
    var socketId = connections[i];
    rtc.createPeerConnection(socketId);
  }
  for (var i = 0, len = rtc.streams.length; i < len; i++) {
    var stream = rtc.streams[i];
    rtc.addStream(stream);
  }
  rtc.sendOffers();
}

}).call(this);
