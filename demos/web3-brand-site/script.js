const canvas = document.querySelector("#chainCanvas");
const ctx = canvas.getContext("2d");
const nodes = Array.from({ length: 18 }, (_, index) => ({
  angle: (Math.PI * 2 * index) / 18,
  radius: 90 + (index % 3) * 46,
  size: 4 + (index % 4),
  speed: 0.002 + (index % 5) * 0.0005
}));

function draw() {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;

  const points = nodes.map(node => {
    node.angle += node.speed;
    return {
      x: cx + Math.cos(node.angle) * node.radius,
      y: cy + Math.sin(node.angle) * node.radius,
      size: node.size
    };
  });

  ctx.strokeStyle = "rgba(54, 211, 153, .22)";
  ctx.lineWidth = 1;
  points.forEach((point, index) => {
    const next = points[(index + 3) % points.length];
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
  });

  points.forEach(point => {
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 24);
    glow.addColorStop(0, "rgba(54, 211, 153, .8)");
    glow.addColorStop(1, "rgba(54, 211, 153, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4fffb";
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#36d399";
  ctx.font = "800 22px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("NOVA TESTNET", cx, cy + 8);
  requestAnimationFrame(draw);
}

document.querySelector("#walletButton").addEventListener("click", () => {
  const toast = document.querySelector("#toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
});

setInterval(() => {
  const value = 12.8 + Math.random() * 1.4;
  document.querySelector("#tvl").textContent = `$${value.toFixed(1)}M`;
}, 2200);

draw();
