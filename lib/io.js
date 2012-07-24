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
rtc.peerConnections = {};

/**
 * Connects to the socket.io server.
 */
rtc.sync = function(server, types) {
  rtc._socket = io.connect(server);
  rtc._socket.on('connect', function() {
    rtc._socket.emit('types', types);
    rtc.fire('sync');
  });

  rtc._socket.on('connections', function(peers) {
    for (var i = 0, len = peers.length; i < len; i++) {
      var peer = peers[i];
      rtc.createPeerConnection(peer);
    }
  });
};

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
    events[i].call(null, args);
  }
};

rtc.createPeerConnection = function(peerId) {
  var pc = new PeerConnection(rtc.SERVER, onIceCandidate);
  rtc.peerConnections[peerId] = pc;
  pc.onaddstream = function(event) {
    rtc.fire('add stream', event, peerId);
  };
};

function onIceCandidate(candidate, moreToFollow) {
  if (candidate) {
    socket.emit('receive ice candidate', {
      label: candidate.label,
      candidate: candidate.toSdp()
    });
  }
  rtc.fire('ice candidate', candidate, moreToFollow);
}

rtc.sendOffer = function(peer, sdp) {
  var offer = peer.createOffer({ video: true });
  peer.setLocalDescription(peer.SDP_OFFER, offer);
  rtc._socket.emit('send offer', { sdp: offer.toSdp() });
  peer.startIce();
};

rtc.receiveOffer = function(sdp) {
  var pc = rtc.getPeerConnection(sdp);
  pc.setRemoteDescription(pc.SDP_OFFER, new SessionDescription(sdp));
};


}).call(this);
