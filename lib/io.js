(function() {

var rtc = this.rtc = {};

// Holds a connection to the server.
rtc._socket = null;
rtc._events = {};

/**
 * Connects to the socket.io server.
 */
rtc.sync = function(server, types) {
  rtc._socket = io.connect(server);
  rtc._socket.on('connect', function() {
    rtc._socket.emit('types', types);
    rtc.fire('sync');
  });

  rtc._socket.on('add peers', function(peers) {
    for (var i = 0, len = peers.length; i < len; i++) {
      var peer = peers[i];
      
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

rtc.connectPeer = function(peer) {
  peer;
};

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
