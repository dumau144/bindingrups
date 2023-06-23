export const compute = async (device: GPUDevice, context: GPUCanvasContext) => {

  const module = device.createShaderModule({
    label: 'compute shader',
    code: /*wgsl*/`
      @group(0)
      @binding(0)
      var<storage, read_write> data: array<f32>;

      struct In {
        @builtin(global_invocation_id) id: vec3<u32>
      }
 
      @compute
      @workgroup_size(1)
      fn computeSomething(input: In) {
        let i = input.id.x;
        data[i] += data[i];
      }`
  });

  const pipeline = device.createComputePipeline({
    label: "doubling compute pipeline",
    layout: 'auto',
    compute: {
      module,
      entryPoint: 'computeSomething',
    }
  })

  const input = new Float32Array([1, 3, 5, 8, 2, 4, 0, 3]);

  const workBuffer = device.createBuffer({
    label: 'work bf',
    size: input.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  })
  
  device.queue.writeBuffer(workBuffer, 0, input);

  const resultBuffer = device.createBuffer({
    label: 'result buffer',
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })

  // BIND GROUP
  const bindGroup = device.createBindGroup({
    label: 'bindGroup for work buffer',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: {buffer: workBuffer}}
    ]
  })

  // RENDER
  const encoder = device.createCommandEncoder({
    label: 'doubling encoder',
  })

  const pass = encoder.beginComputePass({
    label: 'doubling compute pass',
  });

  pass.setPipeline(pipeline)

  // SET BIND GROUP
  pass.setBindGroup(0, bindGroup)

  // DISPATCH WORK GROUPS
  pass.dispatchWorkgroups(input.length)
  pass.end()
  
  // copyBufferToBuffer
  encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size)

  device.queue.submit([encoder.finish()])

  // MAP ASYNC
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange())

  // console.log('input', input);
  console.log('result', result);

  // UNMAP
  resultBuffer.unmap();

  return () => {
    // frame
  }
};