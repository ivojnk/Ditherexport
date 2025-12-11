uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uImageResolution;
uniform float uThreshold;
varying vec2 vUv;

// Bayer matrix 4x4
const float bayer[16] = float[](
    0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
    12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0,
    3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
    15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0
);

float getBayer(vec2 uv) {
    vec2 coord = floor(uv * uResolution);
    int x = int(mod(coord.x, 4.0));
    int y = int(mod(coord.y, 4.0));
    return bayer[y * 4 + x];
}

void main() {
    // Aspect ratio correction (Cover)
    vec2 ratio = vec2(
        min((uResolution.x / uResolution.y) / (uImageResolution.x / uImageResolution.y), 1.0),
        min((uResolution.y / uResolution.x) / (uImageResolution.y / uImageResolution.x), 1.0)
    );

    vec2 uv = vec2(
        vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
        vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );

    vec4 color = texture2D(uTexture, uv);
    
    // Dither
    float threshold = getBayer(vUv);
    
    float levels = 2.0;
    
    // Apply dithering to each channel
    float r = floor(color.r * levels + threshold) / levels;
    float g = floor(color.g * levels + threshold) / levels;
    float b = floor(color.b * levels + threshold) / levels;
    
    vec3 ditheredColor = vec3(r, g, b);
    
    // Calculate luminance to determine if color is dark
    float luminance = dot(ditheredColor, vec3(0.299, 0.587, 0.114));
    
    // Blue color #214EF5 in normalized RGB
    vec3 blueBase = vec3(0.129, 0.306, 0.961);
    
    // Lime green color #BDF739 in normalized RGB
    vec3 greenBase = vec3(0.741, 0.969, 0.224);
    
    // Simple threshold - dark or light, no gradients
    
    vec3 finalColor;
    if (luminance < uThreshold) {
        finalColor = blueBase;
    } else {
        finalColor = greenBase;
    }
    
    gl_FragColor = vec4(finalColor, 1.0);
}
