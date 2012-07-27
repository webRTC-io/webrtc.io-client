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

  rtc._socket.on('receive ice candidate', function(data) {
    console.log("ICE CANDIDATE RECEIVED");
    var candidate = new IceCandidate(data.label, data.candidate);
    rtc.peerConnection.processIceMessage(candidate);
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

rtc.streams = [];
rtc.numStreams = 0;
rtc.initializedStreams = 0;

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
    rtc.numStreams++;
    navigator.webkitGetUserMedia(options, function(stream) {
      window.bs = stream;
      el.src = webkitURL.createObjectURL(stream);
      console.log("Adding local stream.");
      rtc.streams.push(stream);
      rtc.initializedStreams++;
      if (rtc.initializedStreams === rtc.numStreams) {
        rtc.fire('ready');
      }
    }, function() {
      alert("Could not connect stream.");
    });  
  } else {  
    alert('webRTC not available');  
  }  
}

rtc.on('ready', function() {
  console.log("STARTING... FOR REAL");
  var connections = rtc.connections;
  console.log(connections);
  rtc.createPeerConnection();

  for (var i = 0; i < rtc.streams.length; i++) {
    var stream = rtc.streams[i];
    rtc.peerConnection.addStream(stream);
  }

  rtc.sendOffers();
});

}).call(this);
