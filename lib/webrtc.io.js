//CLIENT
// Fallbacks for vendor-specific variables until the spec is finalized.
var PeerConnection = window.PeerConnection || window.webkitPeerConnection00;
var URL = window.URL || window.webkitURL || window.msURL || window.oURL;
var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

// DataChannel webshim using websockets as 'underlying data transport'
var DataChannel = function()
{
  var channel = {}

  // EventTarget interface
  channel._events = {};

  channel.addEventListener = function(type, listener)
  {
    channel._events[type] = channel._events[type] || [];
    channel._events[type].push(callback);
  };

  channel.dispatchEvent = function(event)
  {
    var events = channel._events[event];
    if(!events)
      return;

    var args = Array.prototype.slice.call(arguments, 1);

    for(var i = 0, len = events.length; i < len; i++)
      events[i].apply(null, args);
  };

  channel.removeEventListener = function(type, listener)
  {
    var events = channel._events[event];
    if(!events)
      return;

    events.splice(events.indexOf(listener), 1)

    if(!events.length)
      delete channel._events[type]
  };

//  label;
//  reliable;
//  bufferedAmount;

//  onopen;
//  onerror;
//  onclose;
//  onmessage;
//  binaryType;

//  dc.close function(){};
//  dc.send: function(data){}

  channel.readyState = "open"
  channel.dispatchEvent("open")

  return dc
}

(function() {

  var rtc;
  if ('undefined' === typeof module) {
    rtc = this.rtc = {};
  } else {
    rtc = module.exports = {};
  }

  // Holds a connection to the server.
  rtc._socket = null;

  // Holds callbacks for certain events.
  rtc._events = {};

  // Register the event callbacks
  rtc.on = function(eventName, callback) {
    rtc._events[eventName] = rtc._events[eventName] || [];
    rtc._events[eventName].push(callback);
  };

  // Fire the events
  rtc.fire = function(eventName, _) {
    var events = rtc._events[eventName];
    if(!events)
      return;

    var args = Array.prototype.slice.call(arguments, 1);

    for (var i = 0, len = events.length; i < len; i++) {
      events[i].apply(null, args);
    }
  };

  // Holds the STUN server to use for PeerConnections.
  rtc.SERVER = "STUN stun.l.google.com:19302";

  // Reference to the lone PeerConnection instance.
  rtc.peerConnections = {};

  // Array of known peer socket ids
  rtc.connections = [];

  // Stream-related variables.
  rtc.streams = [];
  rtc.numStreams = 0;
  rtc.initializedStreams = 0;

  // Connects to the websocket (signaling) server
  rtc.connect = function(server, room) {
    room = room || ""; // by default, join a room called the blank string
    rtc._socket = new WebSocket(server);

    // WebSocket have been open, init communications and attach events
    rtc._socket.onopen = function() {

      // Join to the selected room
      rtc._socket.send(JSON.stringify({
        "eventName": "join_room",
        "data": {
          "room": room
        }
      }), function(error) {
        if (error) {
          console.log(error);
        }
      });

      // WebSocket events

      // Message received
      rtc._socket.onmessage = function(msg) {
        var json = JSON.parse(msg.data);
        rtc.fire(json.eventName, json.data);
      };

      // Error on WebSocket communications
      rtc._socket.onerror = function(err) {
        console.log('onerror');
        console.log(err);
      };

      // Connection closed
      rtc._socket.onclose = function(data) {
        rtc.fire('disconnect stream', rtc._socket.id);
        delete rtc.peerConnections[rtc._socket.id];
      };

      // WebRTC.io events

      // List of previously connected peers to the room
      rtc.on('get_peers', function(data) {
        rtc.connections = data.connections;
        // fire connections event and pass peers
        rtc.fire('connections', rtc.connections);
      });

      // New ICE connection data
      rtc.on('receive_ice_candidate', function(data) {
        var candidate = new IceCandidate(data.label, data.candidate);
        rtc.peerConnections[data.socketId].processIceMessage(candidate);

        rtc.fire('receive ice candidate', candidate);
      });

      // New peer connected to the WebRTC room, connect to it
      rtc.on('new_peer_connected', function(data) {
        rtc.connections.push(data.socketId);

        var pc = rtc.createPeerConnection(data.socketId);
        for (var i = 0; i < rtc.streams.length; i++) {
          var stream = rtc.streams[i];
          pc.addStream(stream);
        }
      });

      // Remove the connection to a peer (called for example on the
      // disconnection of one peer from the room)
      rtc.on('remove_peer_connected', function(data) {
        rtc.fire('disconnect stream', data.socketId);
        delete rtc.peerConnections[data.socketId];
      });

      // New offer session data
      rtc.on('receive_offer', function(data) {
        rtc.receiveOffer(data.socketId, data.sdp);
        rtc.fire('receive offer', data);
      });

      // New answer to our offer session
      rtc.on('receive_answer', function(data) {
        rtc.receiveAnswer(data.socketId, data.sdp);
        rtc.fire('receive answer', data);
      });

      // Notify to all attached objects that we have connected successfully
      rtc.fire('connect');
    };
  };

  // Send an offer with the session data to the peers
  rtc.sendOffers = function() {
    for (var i = 0, len = rtc.connections.length; i < len; i++) {
      var socketId = rtc.connections[i];
      rtc.sendOffer(socketId);
    }
  }

  // WebRTC connection is being clossed
  rtc.onClose = function(data) {
    rtc.on('close_stream', function() {
      rtc.fire('close_stream', data);
    });
  }

  // Create a PeerConnection object for each of the other peers on the room
  rtc.createPeerConnections = function() {
    for (var i = 0; i < rtc.connections.length; i++) {
      rtc.createPeerConnection(rtc.connections[i]);
    }
  };

  // Create a new PeerConnection object
  rtc.createPeerConnection = function(socketId) {
    console.log('createPeerConnection');

    var pc = new PeerConnection(rtc.SERVER, function(candidate, moreToFollow)
    {
      if (candidate) {
        rtc._socket.send(JSON.stringify({
          "eventName": "send_ice_candidate",
          "data": {
            "label": candidate.label,
            "candidate": candidate.toSdp(),
            "socketId": socketId
          }
        }), function(error) {
          if (error) {
            console.log(error);
          }
        });
      }

      rtc.fire('ice candidate', candidate, moreToFollow);
    });

    // PeerConnection have been opened
    pc.onopen = function() {
      // TODO: Finalize this API
      rtc.fire('peer connection opened');
    };

    // Event launched when a new stream is added
    pc.onaddstream = function(event) {
      // TODO: Finalize this API
      rtc.fire('add remote stream', event.stream, socketId);
    };

    // Check for webshim for DataChannels creation
    if(!pc.createDataChannel)
    {
      rtc._initiateDataChannel = function()
      {
        rtc._socket.send(JSON.stringify(
        {
          "eventName": "create_DataChannel",
          "data":
          {
            "socketId": socketId
          }
        }),
        function(error)
        {
          if(error)
            console.log(error);
        });
      }

      rtc.on('datachannel', function(data)
      {
        if(pc.readyState == "closed")
          return;

        var configuration = data.configuration

        var channel = new DataChannel()
            channel.label = configuration.label
            channel.reliable = true

        if(configuration.reliable != undefined)
          channel.reliable = configuration.reliable

        channel.readyState = "open"

        var evt = document.createEvent('Event')
            evt.initEvent('datachannel', true, true)
            evt.channel = channel

        pc.dispatchEvent(evt);
      });

      pc.createDataChannel = function(label, dataChannelDict)
      {
        dataChannelDict = dataChannelDict || {}

        if(pc.readyState == "closed")
          throw INVALID_STATE_ERR;

        var channel = new DataChannel()
            channel.label = label || ""
            channel.reliable = true

        if(dataChannelDict.reliable != undefined)
          channel.reliable = dataChannelDict.reliable

        rtc._initiateDataChannel()

        return channel
      }
    }

    rtc.peerConnections[socketId] = pc

    return pc;
  };

  // Send an session offer to a peer
  rtc.sendOffer = function(socketId) {
    var pc = rtc.peerConnections[socketId];
    // TODO: Abstract away video: true, audio: true for offers
    var offer = pc.createOffer({
      video: true,
      audio: true
    });
    pc.setLocalDescription(pc.SDP_OFFER, offer);
    rtc._socket.send(JSON.stringify({
      "eventName": "send_offer",
      "data": {
        "socketId": socketId,
        "sdp": offer.toSdp()
      }
    }), function(error) {
      if (error) {
        console.log(error);
      }
    });
    pc.startIce();
  };

  // Process received offer
  rtc.receiveOffer = function(socketId, sdp) {
    var pc = rtc.peerConnections[socketId];
    pc.setRemoteDescription(pc.SDP_OFFER, new SessionDescription(sdp));
    rtc.sendAnswer(socketId);
  };

  // Send an answer with our own session config
  rtc.sendAnswer = function(socketId) {
    var pc = rtc.peerConnections[socketId];
    var offer = pc.remoteDescription;
    // TODO: Abstract away video: true, audio: true for answers
    var answer = pc.createAnswer(offer.toSdp(), {
      video: true,
      audio: true
    });
    pc.setLocalDescription(pc.SDP_ANSWER, answer);
    rtc._socket.send(JSON.stringify({
      "eventName": "send_answer",
      "data": {
        "socketId": socketId,
        "sdp": answer.toSdp()
      }
    }), function(error) {
      if (error) {
        console.log(error);
      }
    });
    pc.startIce();
  };

  // Process a session answer
  rtc.receiveAnswer = function(socketId, sdp) {
    var pc = rtc.peerConnections[socketId];
    pc.setRemoteDescription(pc.SDP_ANSWER, new SessionDescription(sdp));
  };

  // Create a new stream
  rtc.createStream = function(opt, onSuccess, onFail) {
    onSuccess = onSuccess ||
    function() {};
    onFail = onFail ||
    function() {};

    var options = {
        video: opt.video || false,
        audio: opt.audio || false
    };

    if (getUserMedia) {
      rtc.numStreams++;
      getUserMedia.call(navigator, options, function(stream) {
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
      alert('webRTC is not yet supported in this browser.');
    }
  }

  // Add a new stream on all peers
  rtc.addStreams = function() {
    for (var i = 0; i < rtc.streams.length; i++) {
      var stream = rtc.streams[i];
      for (var connection in rtc.peerConnections) {
        rtc.peerConnections[connection].addStream(stream);
      }
    }
  };

  // Attach a stream to a DOM object
  rtc.attachStream = function(stream, domId) {
    document.getElementById(domId).src = URL.createObjectURL(stream);
  };

  // When we are ready, create connections, add to them the streams and publish
  // it to the other peers
  rtc.on('ready', function() {
    rtc.createPeerConnections();
    rtc.addStreams();
    rtc.sendOffers();
  });

}).call(this);