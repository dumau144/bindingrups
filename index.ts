import { interStage } from "./program";

async function main() {
  const adapter = await navigator.gpu!.requestAdapter();
  const device = await adapter!.requestDevice();

  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);

  const observer = new ResizeObserver((entries) => {
    const [entry] = entries;
    const canvas = entry.target as HTMLCanvasElement;

    const width = entry.contentBoxSize[0].inlineSize;
    const height = entry.contentBoxSize[0].blockSize;

    canvas.width = Math.min(width, device.limits.maxTextureDimension2D);
    canvas.height = Math.min(height, device.limits.maxTextureDimension2D);
  });
  observer.observe(canvas);

  const context = canvas.getContext("webgpu");
  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
  });

  const render = await interStage(device, context);

  const frame = () => {
    render();
    requestAnimationFrame(frame);
  };
}
main();
