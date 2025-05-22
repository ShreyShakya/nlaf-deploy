export const initiateVideoCall = (appointmentId, userType, callWindow = window, jwt) => {
  try {
    // Validate inputs
    if (!appointmentId) {
      throw new Error("Missing appointmentId");
    }
    if (!["lawyer", "client"].includes(userType)) {
      throw new Error(`Invalid userType: ${userType}`);
    }
    if (!callWindow || !callWindow.document) {
      throw new Error("Invalid callWindow");
    }
    if (!jwt) {
      throw new Error("Missing JWT token");
    }

    // Check if JitsiMeetExternalAPI is available
    if (!callWindow.JitsiMeetExternalAPI) {
      throw new Error("JitsiMeetExternalAPI is not available. Ensure https://8x8.vc/vpaas-magic-cookie-70206cd47ac84290b883e32da817bc72/c60c5e/external_api.js is loaded.");
    }

    const appId = "vpaas-magic-cookie-70206cd47ac84290b883e32da817bc72";
    const roomName = `${appId}/NepaliLegalAid-${appointmentId}`;
    const jitsiContainer = callWindow.document.getElementById("jitsi-container");
    
    if (!jitsiContainer) {
      throw new Error("Jitsi container not found in callWindow");
    }

    const options = {
      roomName,
      parentNode: jitsiContainer,
      jwt, // Use JWT for authentication
      configOverwrite: {
        startWithAudioMuted: userType === "lawyer",
        startWithVideoMuted: false,
        disableModeratorIndicator: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
      },
      userInfo: {
        displayName: userType === "lawyer" ? "Lawyer" : "Client",
      },
    };

    console.log("Initializing Jitsi call with options:", {
      roomName,
      userType,
      jwt: jwt.slice(0, 10) + "..." // Log partial JWT for security
    });

    const api = new callWindow.JitsiMeetExternalAPI("8x8.vc", options);
    
    // Log Jitsi API events for debugging
    api.on("videoConferenceJoined", () => console.log(`${userType} joined video conference`));
    api.on("errorOccurred", (error) => console.error("Jitsi error:", error));
    api.on("readyToClose", () => console.log("Jitsi meeting closed"));

    return api;
  } catch (err) {
    console.error("Failed to initialize Jitsi video call:", err.message, err.stack);
    throw err;
  }
};