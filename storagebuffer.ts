export const storagebuffer = async (device: GPUDevice, context: GPUCanvasContext) => {

  const module = device.createShaderModule({
    label: 'Main module',
    code: /*wgsl*/`

    @group(0) @binding(0) var<storage, read> dataIn: array<vec2f>;


      @vertex fn vertexShader(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
        return vec4f(dataIn[vertexIndex], 0.0, 1.0);
      }
      
      @fragment fn fs() -> @location(0) vec4<f32> {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }`,
  })

  const vb = new Float32Array([0.0,  0.5, -0.5, -0.5, 0.5, -0.5])

  const vertexBuffer = device.createBuffer({
    label: 'vertexBuffer',
    size: vb.byteLength,
    usage: GPUBufferUsage.STORAGE  | GPUBufferUsage.COPY_DST
  })

  device.queue.writeBuffer(vertexBuffer, 0, vb)

  const pipeline = device.createRenderPipeline({
    label: "our hardcoded red triangle pipeline",
    layout: "auto",
    vertex: {
      module: module,
      entryPoint: "vertexShader",
    },
    fragment: {
      module: module,
      entryPoint: "fs",
      targets: [
        {
          format: navigator.gpu.getPreferredCanvasFormat(),
        },
      ],
    },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0, resource: {buffer: vertexBuffer},
      }
    ]
  })

  return () => {
    const encoder = device.createCommandEncoder({ label: "our encoder" });

    const pass = encoder.beginRenderPass({
      label: "our basic canvas renderPass",
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: [0.3, 0.3, 0.3, 1],
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup)
    pass.draw(3, 2);
    pass.end();

    const buffer = encoder.finish({ label: 'a' });

    device.queue.submit([buffer]);
  }
};
