import * as THREE from 'three';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import vertexShader from './shaders/vertex.glsl';
import fragmentShader from './shaders/fragment.glsl';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Video setup
const video = document.createElement('video');
video.crossOrigin = 'anonymous'; // Good practice
video.src = `${import.meta.env.BASE_URL}video.mp4`;
video.loop = true;
video.muted = true;
video.play().catch(e => console.error("Video play failed:", e));

video.addEventListener('error', (e) => {
    console.error("Video error:", video.error);
});

const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;

// Geometry & Material
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.ShaderMaterial({
    uniforms: {
        uTexture: { value: videoTexture },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uImageResolution: { value: new THREE.Vector2(1920, 1080) }, // Default to 1080p
        uThreshold: { value: 0.5 },
        uInvert: { value: 0.0 }
    },
    vertexShader,
    fragmentShader
});

const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

// Update image resolution when video metadata is loaded
video.addEventListener('loadedmetadata', () => {
    material.uniforms.uImageResolution.value.set(video.videoWidth, video.videoHeight);
    handleResize();
});

// Resize handler
// Resize handler
// Resize handler
function handleResize() {
    if (!video.videoWidth || !video.videoHeight) return;

    let width = window.innerWidth;
    let height = window.innerHeight;

    const targetAspect = video.videoWidth / video.videoHeight;
    const windowAspect = width / height;

    if (windowAspect > targetAspect) {
        // Window is wider than target, constrain width
        width = height * targetAspect;
    } else {
        // Window is taller than target, constrain height
        height = width / targetAspect;
    }

    renderer.setSize(width, height);
    material.uniforms.uResolution.value.set(width, height);

    // Center the canvas
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.left = '50%';
    renderer.domElement.style.top = '50%';
    renderer.domElement.style.transform = 'translate(-50%, -50%)';
}

window.addEventListener('resize', handleResize);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

// Threshold controls
const controls = document.getElementById('controls');
const hint = document.getElementById('hint');
const thresholdInput = document.getElementById('thresholdInput');
const invertBtn = document.getElementById('invertBtn');
const decreaseBtn = document.getElementById('decreaseBtn');
const increaseBtn = document.getElementById('increaseBtn');

// Update shader when input changes
function updateThreshold(value) {
    const clampedValue = Math.max(0, Math.min(1, parseFloat(value)));
    material.uniforms.uThreshold.value = clampedValue;
    thresholdInput.value = clampedValue.toFixed(2);
}

// Input field event
thresholdInput.addEventListener('input', (e) => {
    updateThreshold(e.target.value);
});

// Decrease button
decreaseBtn.addEventListener('click', () => {
    const newValue = parseFloat(thresholdInput.value) - 0.01;
    updateThreshold(newValue);
});

// Increase button
increaseBtn.addEventListener('click', () => {
    const newValue = parseFloat(thresholdInput.value) + 0.01;
    updateThreshold(newValue);
});

// Invert toggle
invertBtn.addEventListener('change', (e) => {
    material.uniforms.uInvert.value = e.target.checked ? 1.0 : 0.0;
});

// Get button references early so they're available for keyboard shortcuts
const exportBtn = document.getElementById('exportBtn');
const uploadBtn = document.getElementById('uploadBtn');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');

// Keyboard toggle with 'S' key
let controlsVisible = true;
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 's') {
        controlsVisible = !controlsVisible;
        controls.classList.toggle('hidden', !controlsVisible);
        hint.classList.toggle('hidden', !controlsVisible);
        exportBtn.classList.toggle('hidden', !controlsVisible);
        uploadBtn.classList.toggle('hidden', !controlsVisible);
        progressBar.classList.toggle('hidden', !controlsVisible);
    }
});

// Hide hint after 3 seconds
setTimeout(() => {
    hint.style.opacity = '0';
}, 3000);

// Video export functionality
let isExporting = false;

exportBtn.addEventListener('click', async () => {
    if (isExporting) return;

    isExporting = true;
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    progressBar.classList.add('visible');

    try {
        // Use detected dimensions from the video itself
        let width = video.videoWidth;
        let height = video.videoHeight;

        // Ensure dimensions are even numbers (required by some codecs)
        width = width % 2 === 0 ? width : width - 1;
        height = height % 2 === 0 ? height : height - 1;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = width;
        exportCanvas.height = height;

        const exportRenderer = new THREE.WebGLRenderer({
            canvas: exportCanvas,
            preserveDrawingBuffer: true,
            antialias: true
        });
        exportRenderer.setSize(width, height);
        exportRenderer.setPixelRatio(1); // Ensure 1:1 pixel ratio for 4K

        // Create export material with same settings
        const exportMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTexture: { value: videoTexture },
                uResolution: { value: new THREE.Vector2(width, height) },
                uImageResolution: { value: new THREE.Vector2(video.videoWidth, video.videoHeight) },
                uThreshold: { value: material.uniforms.uThreshold.value },
                uInvert: { value: material.uniforms.uInvert.value }
            },
            vertexShader,
            fragmentShader
        });

        const exportPlane = new THREE.Mesh(geometry, exportMaterial);
        const exportScene = new THREE.Scene();
        exportScene.add(exportPlane);

        // Configure Muxer
        const muxer = new Muxer({
            target: new ArrayBufferTarget(),
            video: {
                codec: 'avc',
                width: width,
                height: height
            },
            fastStart: 'in-memory'
        });

        // Configure VideoEncoder
        let encodingError = null;
        const videoEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => {
                console.error(e);
                encodingError = e;
            }
        });

        videoEncoder.configure({
            codec: 'avc1.4d0033', // H.264 High Profile, Level 5.1 (Supports larger resolutions)
            width: width,
            height: height,
            bitrate: 60_000_000, // 60 Mbps
            framerate: 60,
            latencyMode: 'quality'
        });

        // Prepare for frame-by-frame rendering
        const fps = 60;
        const duration = video.duration;
        const totalFrames = Math.ceil(duration * fps);
        const frameDuration = 1 / fps;

        // Pause video for manual seeking
        video.pause();
        const originalTime = video.currentTime;

        for (let i = 0; i < totalFrames; i++) {
            const time = i * frameDuration;

            // Seek video
            video.currentTime = time;

            // Wait for seek to complete
            await new Promise(resolve => {
                const onSeeked = () => {
                    video.removeEventListener('seeked', onSeeked);
                    resolve();
                };
                video.addEventListener('seeked', onSeeked);
            });

            if (encodingError) throw encodingError;

            // Render frame
            exportRenderer.render(exportScene, camera);

            // Create VideoFrame from canvas
            const frame = new VideoFrame(exportCanvas, { timestamp: i * 1000000 / fps }); // timestamp in microseconds

            // Encode frame
            videoEncoder.encode(frame);
            frame.close();

            // Update progress
            const progress = (i / totalFrames) * 100;
            progressFill.style.width = `${progress}%`;
        }

        // Flush encoder and finalize muxer
        await videoEncoder.flush();
        muxer.finalize();

        const { buffer } = muxer.target;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        // Download
        const a = document.createElement('a');
        a.href = url;
        a.download = `dither-export-hd-${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);

        // Cleanup
        exportRenderer.dispose();
        exportMaterial.dispose();

        // Restore video state
        video.currentTime = originalTime;
        video.play();

    } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please check console for details.');
    } finally {
        isExporting = false;
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export HD Video';
        progressBar.classList.remove('visible');
        progressFill.style.width = '0%';
    }
});

// Handle click to play if autoplay fails
document.addEventListener('click', (e) => {
    // Don't trigger play if clicking controls
    if (e.target.closest('.controls') || e.target.closest('.export-btn') || e.target.closest('input')) return;

    if (video.paused) {
        video.play();
    }
});

// Video upload functionality
const videoInput = document.getElementById('videoInput');

uploadBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent document click listener
    videoInput.click();
});

videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        video.src = url;
        video.load();
        video.play().catch(e => console.error("Video play failed:", e));
    }
});
