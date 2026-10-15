(() => {
    "use strict";

    const video = document.getElementById("camera");
    const status = document.getElementById("cameraStatus");

    if (!video || !status) return;

    window.fingerX = 0.5;
    window.handDetected = false;

    let stream = null;
    let hands = null;
    let active = false;
    let processing = false;
    let lastFrameTime = 0;

    function setStatus(text) {
        status.textContent = text;
    }

    async function startCamera() {
        if (active) return;

        if (!navigator.mediaDevices?.getUserMedia) {
            setStatus("Camera needs HTTPS or localhost");
            return;
        }

        if (typeof window.Hands === "undefined") {
            setStatus("Hand tracking unavailable — use keys");
            return;
        }

        try {
            setStatus("📷 Requesting camera...");

            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    width: { ideal: 320 },
                    height: { ideal: 240 },
                    frameRate: { ideal: 20, max: 24 },
                    facingMode: "user"
                }
            });

            video.srcObject = stream;

            await new Promise(resolve => {
                if (video.readyState >= 2) {
                    resolve();
                } else {
                    video.onloadedmetadata = resolve;
                }
            });

            await video.play();

            hands = new window.Hands({
                locateFile: file =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 0,
                minDetectionConfidence: 0.55,
                minTrackingConfidence: 0.5
            });

            hands.onResults(results => {
                const landmarks =
                    results.multiHandLandmarks?.[0];

                window.handDetected = Boolean(landmarks);

                if (landmarks) {
                    const indexTip = landmarks[8];

                    // Mirror the coordinate to match the preview.
                    window.fingerX = Math.max(
                        0,
                        Math.min(1, 1 - indexTip.x)
                    );

                    setStatus("🟢 Hand detected");
                } else {
                    setStatus("👆 Show your hand");
                }
            });

            active = true;
            setStatus("👆 Show your hand");

            processFrames();

        } catch (error) {
            console.error("Camera error:", error);

            window.handDetected = false;

            if (error.name === "NotAllowedError") {
                setStatus("Camera denied — use keyboard");
            } else if (error.name === "NotFoundError") {
                setStatus("No camera — use keyboard");
            } else {
                setStatus("Camera unavailable — use keyboard");
            }
        }
    }

    async function processFrames() {
        if (!active) return;

        const now = performance.now();

        // Limit hand tracking to approximately 12–15 FPS.
        // The game animation continues independently.
        if (
            !processing &&
            video.readyState >= 2 &&
            now - lastFrameTime >= 75
        ) {
            processing = true;
            lastFrameTime = now;

            try {
                await hands.send({ image: video });
            } catch (error) {
                console.warn("Hand tracking frame skipped:", error);
            } finally {
                processing = false;
            }
        }

        if (active) {
            setTimeout(processFrames, 20);
        }
    }

    window.startCamera = startCamera;

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            () => setTimeout(startCamera, 250),
            { once: true }
        );
    } else {
        setTimeout(startCamera, 250);
    }

    window.addEventListener("beforeunload", () => {
        active = false;

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        if (hands?.close) {
            hands.close();
        }
    });
})();
