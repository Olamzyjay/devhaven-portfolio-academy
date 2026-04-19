/* Three.js background (lightweight, mobile-safe)
 * - Full-bleed canvas behind content
 * - Subtle 3D animation + parallax
 * - Respects prefers-reduced-motion
 */

function prefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function getMaxDevicePixelRatio() {
  // Keep it smooth but not battery-hostile on mobile.
  const dpr = Number(window.devicePixelRatio || 1);
  return Math.min(Math.max(dpr, 1), 1.6);
}

function mountCanvas() {
  const wrap = document.createElement("div");
  wrap.className = "three-bg";
  wrap.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "three-canvas";
  wrap.appendChild(canvas);

  document.body.prepend(wrap);
  document.documentElement.classList.add("has-three");

  return { wrap, canvas };
}

async function initThreeBackground() {
  if (prefersReducedMotion()) {
    document.documentElement.classList.add("reduce-motion");
    return;
  }
  if (!canUseWebGL()) {
    return;
  }

  const { canvas } = mountCanvas();

  // Load Three as an ESM module from CDN (no build step required).
  const THREE = await import("https://unpkg.com/three@0.165.0/build/three.module.js");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(getMaxDevicePixelRatio());
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 60);
  camera.position.set(0, 0.25, 7.5);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xb8fff2, 1.1);
  key.position.set(4, 6, 3);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9bd2ff, 0.85);
  rim.position.set(-6, -2, 4);
  scene.add(rim);

  const group = new THREE.Group();
  scene.add(group);

  // Main object: a glassy knot (reads as "3D" immediately).
  const knotGeo = new THREE.TorusKnotGeometry(1.35, 0.46, 220, 18);
  const knotMat = new THREE.MeshPhysicalMaterial({
    color: 0x2af3c9,
    roughness: 0.18,
    metalness: 0.12,
    transmission: 0.55,
    thickness: 0.7,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    ior: 1.4
  });
  const knot = new THREE.Mesh(knotGeo, knotMat);
  knot.position.set(-1.6, 0.4, 0);
  group.add(knot);

  // Secondary object: subtle ring to add depth.
  const ringGeo = new THREE.TorusGeometry(1.5, 0.09, 18, 120);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x7fc7ff,
    roughness: 0.3,
    metalness: 0.45,
    emissive: 0x0a2030,
    emissiveIntensity: 0.35
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(2.2, -0.35, -0.2);
  ring.rotation.set(0.6, -0.25, 0.2);
  group.add(ring);

  // Particle field for "depth" without heavy shaders.
  const particleCount = 520;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3 + 0] = (Math.random() - 0.5) * 20;
    positions[i3 + 1] = (Math.random() - 0.5) * 12;
    positions[i3 + 2] = (Math.random() - 0.5) * 16 - 4;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xd7fff6,
    size: 0.035,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.72
  });
  const points = new THREE.Points(pGeo, pMat);
  group.add(points);

  // Responsive sizing.
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize, { passive: true });

  // Parallax (gentle).
  let targetX = 0;
  let targetY = 0;
  function onPointerMove(ev) {
    const x = ("clientX" in ev ? ev.clientX : window.innerWidth * 0.5) / Math.max(window.innerWidth, 1);
    const y = ("clientY" in ev ? ev.clientY : window.innerHeight * 0.5) / Math.max(window.innerHeight, 1);
    targetX = (x - 0.5) * 0.75;
    targetY = (y - 0.5) * 0.55;
  }
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  let raf = 0;
  let last = performance.now();
  let px = 0;
  let py = 0;

  function animate(now) {
    raf = requestAnimationFrame(animate);

    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    // Ease parallax.
    px += (targetX - px) * (1 - Math.pow(0.001, dt));
    py += (targetY - py) * (1 - Math.pow(0.001, dt));

    group.rotation.y += dt * 0.22;
    group.rotation.x += dt * 0.12;

    knot.rotation.y += dt * 0.35;
    knot.rotation.x += dt * 0.22;
    ring.rotation.z -= dt * 0.22;

    camera.position.x = px * 0.7;
    camera.position.y = 0.25 + -py * 0.55;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  raf = requestAnimationFrame(animate);

  window.addEventListener("pagehide", () => cancelAnimationFrame(raf), { once: true });
}

document.addEventListener("DOMContentLoaded", () => {
  initThreeBackground().catch(() => {
    // If Three fails to load, keep the rest of the site working.
  });
});

