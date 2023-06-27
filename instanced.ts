const range = (n = 0, m = 1) => new Array(n).fill(null).map((a, b) => b * m);

export const instanced = async (
  device: GPUDevice,
  context: GPUCanvasContext
) => {
  const module = device.createShaderModule({
    label: "Main module",
    code: /*wgsl*/ `
    
    struct InstanceData {
      color: vec4<f32>,
      translate: vec2<f32>,
      scale: f32,
      rotation: f32,
    };

    struct Input {
      @builtin(vertex_index) vertexIndex: u32,
      @builtin(instance_index) instanceIndex: u32,
    }
    
    @group(0) @binding(0) var<storage, read> dataIn: array<vec2f>;
    
    @group(0) @binding(1) var<storage, read> instanceData: array<InstanceData>;


      struct VSOut {
        @builtin(position) position: vec4f,
        @location(1) color: vec4f,
      }

      @vertex fn vertexShader(input: Input) -> VSOut {
        let INSTANCE = instanceData[input.instanceIndex];
        let tr: vec2<f32> = INSTANCE.translate;
      
        var out: VSOut;
        out.position = vec4f(dataIn[input.vertexIndex] + tr, 0.0, 1.0);
        out.color = INSTANCE.color;

        return out;
      }
      
      @fragment fn fs(input: VSOut) -> @location(0) vec4<f32> {
        return input.color;
      }`,
  });

  const vb = new Float32Array([0.0, 0.5, -0.5, -0.5, 0.5, -0.5]);

  const vertexBuffer = device.createBuffer({
    label: "vertexBuffer",
    size: vb.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer, 0, vb);

  const instanceCount = 1;
  const instanceSize = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]).byteLength;

  const BUFFER_SIZE = instanceSize * instanceCount;

  const instanceBuffer = device.createBuffer({
    label: "instanceBuffer",
    size: instanceSize * instanceCount,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const instanceDataBuffer = new ArrayBuffer(BUFFER_SIZE);

  for (const instanceIndex of range(instanceCount)) {
    const instanceByteOffset = instanceSize * instanceIndex;

    const InstanceDataViews = {
      color: new Float32Array(instanceDataBuffer, instanceByteOffset + 0, 4),
      translate: new Float32Array(instanceDataBuffer,instanceByteOffset + 16,2),
      scale: new Float32Array(instanceDataBuffer, instanceByteOffset + 24, 1),
      rotation: new Float32Array(instanceDataBuffer,instanceByteOffset + 28,1),
    };

    InstanceDataViews.color.set([Math.random(), Math.random(), Math.random(), 1]);
    InstanceDataViews.translate.set([-1 + Math.random() * 2, -1 + Math.random() * 2]);
    InstanceDataViews.scale.set([0]);
    InstanceDataViews.rotation.set([0]);
  }

  device.queue.writeBuffer(instanceBuffer, 0, instanceDataBuffer);

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
        binding: 0,
        resource: { buffer: vertexBuffer },
      },
      {
        binding: 1,
        resource: { buffer: instanceBuffer },
      },
    ],
  });

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
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, instanceCount);
    pass.end();

    const buffer = encoder.finish({ label: "a" });

    device.queue.submit([buffer]);
  };
};
