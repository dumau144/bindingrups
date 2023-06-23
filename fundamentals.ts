export const fundamentals = async (
  device: GPUDevice,
  context: GPUCanvasContext
) => {
  const module = device.createShaderModule({
    label: "our hardcoded red triangle shaders",
    code: /*wgsl*/ `

      @vertex fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
        let pos = array(
          vec2f( 0.0,  0.5),
          vec2f(-0.5, -0.5),
          vec2f( 0.5, -0.5),
          vec2f( 0.0,  0.5),
        );

        return vec4f(pos[vertexIndex] * 1.0, 0.0, 1.0);
      }
      //               RENDER TARGET 0
      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    label: "our hardcoded red triangle pipeline",
    layout: "auto",
    vertex: {
      module: module,
      entryPoint: "vs",
    },
    primitive: {
      topology: 'line-strip',
    },
    fragment: {
      module: module,
      entryPoint: "fs",
      targets: [
        // RENDER TARGET 0
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
        },
      ],
    },
  });

  return () => {
    const encoder = device.createCommandEncoder({ label: "our encoder" });

    const pass = encoder.beginRenderPass({
      label: "our basic canvas renderPass",
      colorAttachments: [
        // RENDER TARGET 0
        {
          view: context.getCurrentTexture().createView(),
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.draw(4);

    pass.end();

    const buffer = encoder.finish({ label: 'a' });

    device.queue.submit([buffer]);
  };
};
