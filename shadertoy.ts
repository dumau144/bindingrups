export let resize = () => {}

export const shaderToy = (device: GPUDevice, context: GPUCanvasContext) => {
  const module = device.createShaderModule({
    label: 'Display shader module',
    code: /*wgsl*/`
      @group(0) @binding(0) var <uniform> data: vec2<f32>;

      @vertex fn vertexShader(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
        let pos = array(
          vec2f(-1.0, 1.0),
          vec2f( 1.0, 1.0),
          vec2f( 1.0,-1.0),
          vec2f(-1.0, 1.0),
          vec2f(-1.0,-1.0),
          vec2f( 1.0,-1.0),
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }
      

      struct FragIn{
        @builtin(position) coord_in: vec4<f32>
      }

      @fragment fn fs(input: FragIn) -> @location(0) vec4f {
        return vec4f(input.coord_in.x / data[0], input.coord_in.y / data[1], 0.0, 1.0);
      }
    `
  })

  const uniformBufferInput = new Float32Array([context.canvas.width * devicePixelRatio, context.canvas.height * devicePixelRatio])

  const uniformBuffer = device.createBuffer({
    label: 'uniformBuffer',
    size: uniformBufferInput.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
  })

  const pipeline = device.createRenderPipeline({
    label: "Display shader pipeline",
    layout: 'auto',
    vertex: {
      entryPoint: 'vertexShader',
      module: module,
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
  })

  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: {buffer: uniformBuffer}}
    ]
  })

  return () => {
    const encoder = device.createCommandEncoder({ label: "our encoder" })

    const pass = encoder.beginRenderPass({
      label: 'canvas renderPass',
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "load",
          storeOp: "store",
        },
      ],
    })

    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(6)
    pass.end()

    device.queue.submit([encoder.finish({ label: 'a' })]);
  }
}