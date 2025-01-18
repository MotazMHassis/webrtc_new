(function($, windowObject, navigatorObject) {
    /*
        References:
        --> https://shanetully.com/2014/09/a-dead-simple-webrtc-example/
        --> https://developer.mozilla.org/en-US/docs/Web/Guide/API/WebRTC/Peer-to-peer_communications_with_WebRTC
        --> https://bitbucket.org/webrtc/codelab
    */
    var oppositclent;
    var socket = io(); // Assuming `io` is defined somewhere in your environment
    
    const button = document.getElementById('startButton');
    const welcomeID = $("#welcome"); // Define welcomeID correctly
    const makeConnectionForm = $("#makeConnectionForm"); // Define makeConnectionForm
    const connectedOrDisconnected = $("#connectedOrDisconnected"); // Define connectedOrDisconnected
    const toast = $("#toast"); // Define toast element
    
    function autostart(id) {
        console.log('Auto-start initiated');
        socket.emit('makeConnection', id);
        function delayedFunction() {
            button.click(); // Simulating button click after 5 seconds
            console.log('Button clicked after auto-start');
        }
        setTimeout(delayedFunction, 5000);
    }
    
    document.getElementById('cameraSelect').onchange = function() {
        Functions.handleCameraChange();
    }
    
    var clientlist = [];
    const remoteVideo = document.getElementById('remoteVideo');
    const fullScreenButton = document.getElementById('fullScreenButton');
    const muteButton = document.getElementById('muteButton');
    
    // Full screen button functionality
    fullScreenButton.addEventListener('click', () => {
        if (remoteVideo.requestFullscreen) {
            remoteVideo.requestFullscreen();
        } else if (remoteVideo.mozRequestFullScreen) { /* Firefox */
            remoteVideo.mozRequestFullScreen();
        } else if (remoteVideo.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
            remoteVideo.webkitRequestFullscreen();
        } else if (remoteVideo.msRequestFullscreen) { /* IE/Edge */
            remoteVideo.msRequestFullscreen();
        }
    });
    
    // Mute button functionality
    muteButton.addEventListener('click', () => {
        remoteVideo.muted = !remoteVideo.muted;
        muteButton.textContent = remoteVideo.muted ? 'Unmute' : 'Mute';
    });
    
    // Setting up peer connection configuration with updated iceServers
    var peerConnectionConfig = {
        'iceServers': [
            { 'urls': 'stun:stun.services.mozilla.com' },
            { 'urls': 'stun:stun.l.google.com:19302' }
        ]
    };
    
    navigatorObject.getUserMedia = navigatorObject.getUserMedia ||
        navigatorObject.mozGetUserMedia ||
        navigatorObject.webkitGetUserMedia;
    
    windowObject.RTCPeerConnection = windowObject.RTCPeerConnection ||
        windowObject.mozRTCPeerConnection ||
        windowObject.webkitRTCPeerConnection;
    
    windowObject.RTCIceCandidate = windowObject.RTCIceCandidate ||
        windowObject.mozRTCIceCandidate ||
        windowObject.webkitRTCIceCandidate;
    
    windowObject.RTCSessionDescription = windowObject.RTCSessionDescription ||
        windowObject.mozRTCSessionDescription ||
        windowObject.webkitRTCSessionDescription;
    
    var localVideo, localStream, peerConnection;
    
    var Functions = {
        pageReady: function() {
            localVideo = document.getElementById('localVideo');
    
            // Setting up socket listeners
            socket.on('message', function(msg) {
                Functions.gotMessageFromServer(msg);
            });
    
            socket.on('chatMessage', function(msg) {
                Functions.appendChat("Friend: " + msg);
            });
    
            socket.on('allclientList', function(msg) {
                console.log(msg);
                var listelement = document.getElementById("listelement");
                function populateSelect(array) {
                    listelement.innerHTML = "";
                    array.forEach(function(item) {
                        var option = document.createElement("option");
                        option.value = item;
                        option.text = item;
                        listelement.appendChild(option);
                    });
                }
                populateSelect(msg);
                if (msg.length == 2) {
                    for (var i = 0; i < msg.length; i++) {
                        if (msg[i] !== socket.id) {
                            oppositclent = msg[i];
                        }
                    }
                    console.log(oppositclent);
                    autostart(oppositclent);
                }
            });
    
            socket.on('welcome', function(msg) {
                Functions.welcome(msg);
            });
    
            socket.on('disconnected', function(msg) {
                Functions.disconnected(msg);
            });
    
            socket.on('connected', function(msg) {
                Functions.connected(msg);
            });
    
            socket.on('toast', function(notification) {
                Functions.toast(notification);
            });
    
            // Constraints for getUserMedia
            var constraints = {
                video: {
                    facingMode: 'environment'  // 'user' for front camera, 'environment' for rear camera
                },
                audio: true,
            };
    
            // Requesting user media
            if (navigatorObject.getUserMedia) {
                navigatorObject.getUserMedia(constraints,
                    Functions.getUserMediaSuccess,
                    Functions.getUserMediaError
                );
            } else {
                alert('Your browser does not support getUserMedia API');
            }
        },
    
        getUserMediaSuccess: function(stream) {
            localStream = stream;
            if ('srcObject' in localVideo) {
                localVideo.srcObject = stream;
            } else {
                localVideo.src = URL.createObjectURL(stream);
            }
        },
    
        getUserMediaError: function(error) {
            console.log(error);
            Functions.toast("getUserMedia Error");
        },
    
        start: function(isCaller) {
            console.log("start called");
            button.textContent = "Calling";
            Functions.toast("Calling... Please Wait!!");
    
            peerConnection = new RTCPeerConnection(peerConnectionConfig);
            peerConnection.onicecandidate = Functions.gotIceCandidate;
    
            // Setting up ontrack event handler
            peerConnection.ontrack = function(event) {
                console.log('Remote track added:', event.track);
                if (event.streams && event.streams[0]) {
                    remoteVideo.srcObject = event.streams[0]; // Assuming one stream for simplicity
                } else {
                    remoteVideo.srcObject = event.stream; // Fallback for older browsers
                }
                button.textContent = "Connected";
                Functions.toast("You are in a call!!");
                button.disabled = true;
            };
    
            peerConnection.addStream(localStream);
    
            if (isCaller) {
                peerConnection.createOffer(Functions.gotDescription, Functions.createOfferError);
                console.log("Offer created");
            }
        },
    
        gotDescription: function(description) {
            console.log('Got description:', description);
            peerConnection.setLocalDescription(description)
                .then(function() {
                    socket.emit('message', JSON.stringify({'sdp': description}));
                })
                .catch(function(err) {
                    console.error('Error setting local description:', err);
                    Functions.toast("Error occurred: setDescriptionError");
                });
        },
    
        gotIceCandidate: function(event) {
            if (event.candidate) {
                socket.emit('message', JSON.stringify({'ice': event.candidate}));
            }
        },
    
        gotMessageFromServer: function(message) {
            if (!peerConnection) {
                Functions.start(false);
            }
            var signal = JSON.parse(message);
            if (signal.sdp) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    .then(function() {
                        if (peerConnection.remoteDescription.type === 'offer') {
                            peerConnection.createAnswer()
                                .then(function(description) {
                                    Functions.gotDescription(description);
                                })
                                .catch(function(err) {
                                    console.error('Error creating answer:', err);
                                    Functions.toast("Error occurred: createAnswerError");
                                });
                        }
                    })
                    .catch(function(err) {
                        console.error('Error setting remote description:', err);
                        Functions.toast("Error occurred: setRemoteDescriptionError");
                    });
            } else if (signal.ice) {
                peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice))
                    .then(function() {
                        console.log("Ice candidate added");
                    })
                    .catch(function(err) {
                        console.error('Error adding ice candidate:', err);
                    });
            }
        },
    
        createOfferError: function(error) {
            console.error('Error creating offer:', error);
            Functions.toast("Error occurred: createOfferError");
        },
    
        createAnswerError: function(error) {
            console.error('Error creating answer:', error);
            Functions.toast("Error occurred: createAnswerError");
        },
    
        appendChat: function(chat) {
            var entry = document.createElement('li');
            entry.appendChild(document.createTextNode(chat));
            chatMessagesList.appendChild(entry);
        },
    
        sendChat: function() {
            var chatMessage = chatTextField.value;
            chatTextField.value = "";
            socket.emit('chatMessage', chatMessage);
            Functions.appendChat("You: " + chatMessage);
        },
    
        welcome: function(message) {
            console.log(message);
            welcomeID.text("Ask someone to join you. Your id is: " + message);
        },
    
        connected: function(message) {
            makeConnectionForm.hide(); // Use .hide() on jQuery object
            welcomeID.hide();
            connectedOrDisconnected.text("Connected from: " + message); // Use .text() on jQuery object
            button.disabled = false;
        },
    
        disconnected: function(message) {
            makeConnectionForm.show(); // Use .show() on jQuery object
            welcomeID.show();
            connectedOrDisconnected.text("Disconnected from: " + message); // Use .text() on jQuery object
            button.textContent = "Call";
        },
    
        makeConnection: function() {
            var selectedOption = listelement.options[listelement.selectedIndex];
            var id = selectedOption.textContent;
            if (id.length == 20) {
                socket.emit('makeConnection', id);
            } else {
                console.log("Enter valid ID");
                Functions.toast("Enter valid ID");
            }
        },
    
        toast: function(notification) {
            console.log(notification);
            toast.text(notification); // Use .text() on jQuery object
        },
    
        init: function() {
            button.disabled = true;
            // Additional initialization if needed
        },
    
        handleCameraChange: function() {
            var selectedCamera = document.getElementById('cameraSelect').value;
            var constraints;
    
            if (selectedCamera === 'environment') {
                constraints = {
                    video: {
                        facingMode: { exact: 'environment' }
                    },
                    audio: true
                };
            } else if (selectedCamera === 'user') {
                constraints = {
                    video: {
                        facingMode: { exact: 'user' }
                    },
                    audio: true
                };
            }
    
            if (navigatorObject.getUserMedia) {
                navigatorObject.getUserMedia(constraints,
                    Functions.getUserMediaSuccess,
                    Functions.getUserMediaError
                );
            } else {
                alert('Your browser does not support getUserMedia API');
            }
        }
    };
    
    // Event listeners for UI interactions
    $(button).click(function() {
        Functions.start(true);
    });
    
    $("#typeMessagesForm").submit(function() {
        Functions.sendChat();
        return false;
    });
    
    $("#makeConnectionForm").submit(function() {
        Functions.makeConnection();
        return false;
    });
    
    // Initializing the page
    $(document).ready(function() {
        Functions.init();
        Functions.pageReady();
    });
})(jQuery, window, navigator);
