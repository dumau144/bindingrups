export const compute = async (device: GPUDevice, context: GPUCanvasContext) => {
  const module = device.createShaderModule({
    label: "compute shader",
    code: /*wgsl*/ `
      @group(0)
      @binding(0)
      var<storage, read_write> dataIn: array<f32>;

      @group(0)
      @binding(1)
      var<storage, read_write> dataOut: array<f32>;

      @group(0)
      @binding(2)
      var<storage, read_write> dataAdd: array<f32>;

      struct In {
        @builtin(global_invocation_id) id: vec3<u32>
      }
 
      @compute
      @workgroup_size(1)
      fn computeSomething(input: In) {
        let i = input.id.x;
        dataOut[i] = dataIn[i] * 10.0;
      }
      
      @compute
      @workgroup_size(1)
      fn computeSomething2(input: In) {
        let i = input.id.x;
        dataOut[i] = dataIn[i] + dataAdd[i];
      }
      `,
  });

  const dataOutLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {type: "storage"},
    }, {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {type: "storage"},
    }, {
      binding: 2,
      visibility: GPUShaderStage.COMPUTE,
      buffer: {type: "storage"},
    }]
  })

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [dataOutLayout]
  })

  const pipeline = device.createComputePipeline({
    label: "doubling compute pipeline",
    layout: pipelineLayout,
    compute: {
      module,
      entryPoint: "computeSomething",
    },
  });

  const pipeline2 = device.createComputePipeline({
    label: "doubling compute pipeline",
    layout: pipelineLayout,
    compute: {
      module,
      entryPoint: "computeSomething2",
    },
  });

  const input = new Float32Array([1, 3, 5]);

  const dataInBuffer = device.createBuffer({
    label: "work bf",
    size: input.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(dataInBuffer, 0, input);

  const inputAdd = new Float32Array([1, 2, 3]);

  const dataInBufferAdd = device.createBuffer({
    label: "work bf",
    size: input.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(dataInBufferAdd, 0, inputAdd);

  const dataOutBuffer = device.createBuffer({
    label: "work bf",
    size: input.byteLength,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });

  const resultBuffer = device.createBuffer({
    label: "result buffer",
    size: input.byteLength,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // BIND GROUP
  const bindGroup = device.createBindGroup({
    label: "bindGroup for work buffer",
    layout: dataOutLayout,
    entries: [
      { binding: 0, resource: { buffer: dataInBuffer } },
      { binding: 1, resource: { buffer: dataOutBuffer } },
      { binding: 2, resource: { buffer: dataInBufferAdd } }
    ],
  });

  // RENDER
  const encoder = device.createCommandEncoder({
    label: "doubling encoder",
  });

  const pass = encoder.beginComputePass({
    label: "doubling compute pass",
  });

  pass.setPipeline(pipeline);

  // SET BIND GROUP
  pass.setBindGroup(0, bindGroup);

  // DISPATCH WORK GROUPS
  pass.dispatchWorkgroups(input.length);
  pass.end();

  // copyBufferToBuffer
  encoder.copyBufferToBuffer(dataOutBuffer, 0, dataInBuffer, 0, resultBuffer.size);

  const carPass = encoder.beginComputePass({
    label: "doubling compute pass",
  });

  carPass.setPipeline(pipeline2)
  carPass.setBindGroup(0, bindGroup);

  // DISPATCH WORK GROUPS
  carPass.dispatchWorkgroups(input.length);
  carPass.end();

  encoder.copyBufferToBuffer(dataOutBuffer, 0, resultBuffer, 0, resultBuffer.size);

  device.queue.submit([encoder.finish()]);

  // MAP ASYNC
  await resultBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(resultBuffer.getMappedRange());

  console.log("input", input);
  console.log("result", result);

  // UNMAP
  resultBuffer.unmap();

  return () => {
    // frame
  };
};
